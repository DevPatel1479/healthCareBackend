import prisma from "../lib/prisma.js";
import { io } from "../server.js";

/**
 * Convert IST date → safe DATE (no time)
 */
function getISTMidnightDate() {
    const now = new Date();

    const ist = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    ist.setHours(0, 0, 0, 0);

    // IMPORTANT: strip time drift
    return new Date(ist.toISOString().split("T")[0]);
}

/**
 * Safe comparison
 */
function isSameDay(d1, d2) {
    return d1.getTime() === d2.getTime();
}

async function runDailyJob() {
    const today = getISTMidnightDate();

    let state = await prisma.scheduler_state.findUnique({
        where: { id: 1 },
    });

    // ---------------- INIT ----------------
    if (!state) {
        await prisma.scheduler_state.create({
            data: {
                id: 1,
                last_processed_date: today,
            },
        });

        console.log("🟢 Scheduler initialized");
        return;
    }

    const last = new Date(state.last_processed_date);

    // ---------------- ALREADY RUN ----------------
    if (isSameDay(last, today)) {
        console.log("⛔ Already processed today. Skipping...");
        return;
    }

    console.log("🚀 New day detected. Running scheduler...");

    const oldDailyTasks = await prisma.$queryRaw`
        SELECT
            ta.assignment_id,
            ta.task_id,
            ta.patient_id,
            ta.caregiver_id,
            ta.shift_id,
            ta.status,
            ta.time_done,
            ta.flag_level,
            ta.observation,
            ta.photo_evidence
        FROM task_assignments ta
        JOIN care_tasks ct ON ta.task_id = ct.task_id
        WHERE ct.task_category = 'Daily/Routine'
    `;

    if (!oldDailyTasks.length) {
        console.log("⚠️ No tasks found.");
        return;
    }

    await prisma.$transaction(async (tx) => {

        // IMPORTANT: update state first (lock)
        await tx.scheduler_state.update({
            where: { id: 1 },
            data: {
                last_processed_date: today,
            },
        });

        await tx.$executeRaw`
            DELETE ta
            FROM task_assignments ta
            JOIN care_tasks ct ON ta.task_id = ct.task_id
            WHERE ct.task_category = 'Daily/Routine'
        `;

        await tx.task_assignments.createMany({
            data: oldDailyTasks.map((t) => ({
                task_id: t.task_id,
                patient_id: t.patient_id,
                caregiver_id: t.caregiver_id,
                shift_id: t.shift_id,
                status: "pending",
                time_done: null,
                flag_level: "green",
                observation: null,
                photo_evidence: null,
                supervisor_val: false,
            })),
        });
    });

    const caregivers = new Set();
    const patients = new Set();

    for (const t of oldDailyTasks) {
        if (t.caregiver_id) caregivers.add(t.caregiver_id);
        if (t.patient_id) patients.add(t.patient_id);
    }

    caregivers.forEach((id) =>
        io?.to(`caregiver_${id}`).emit("daily_tasks_regenerated", {
            message: "New daily tasks available",
        })
    );

    patients.forEach((id) =>
        io?.to(`patient_${id}`).emit("daily_tasks_regenerated", {
            message: "Daily tasks refreshed",
        })
    );

    console.log("✅ Scheduler completed successfully");
}

/**
 * 10 second polling
 */
export const startDailyTaskScheduler = () => {
    console.log("🟢 Scheduler started (10s polling)");

    setInterval(async () => {
        try {
            await runDailyJob();
        } catch (err) {
            console.error("❌ Scheduler error:", err);
        }
    }, 10 * 1000);
};