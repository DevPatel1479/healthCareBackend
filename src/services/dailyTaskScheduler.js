import prisma from "../lib/prisma.js";
import { io } from "../server.js";

/**
 * Get IST date normalized to midnight (Date object)
 */
function getISTMidnightDate() {
    const now = new Date();

    // convert to IST string then back to Date
    const ist = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    ist.setHours(0, 0, 0, 0);
    return ist;
}

/**
 * Compare only YYYY-MM-DD safely
 */
function isSameDay(date1, date2) {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

/**
 * Main job
 */
async function runDailyJob() {
    const today = getISTMidnightDate();

    const state = await prisma.scheduler_state.findUnique({
        where: { id: 1 },
    });

    // -------------------------
    // INIT CASE
    // -------------------------
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

    const last = state.last_processed_date;

    // -------------------------
    // ALREADY PROCESSED TODAY
    // -------------------------
    if (last && isSameDay(new Date(last), today)) {
        console.log("⛔ Already processed today. Skipping...");
        return;
    }

    console.log("🚀 New day detected. Running scheduler...");

    // -------------------------
    // FETCH OLD TASKS
    // -------------------------
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

    // -------------------------
    // TRANSACTION (STATE FIRST!)
    // -------------------------
    await prisma.$transaction(async (tx) => {

        // 1. update scheduler state FIRST (idempotent lock)
        await tx.scheduler_state.update({
            where: { id: 1 },
            data: {
                last_processed_date: today,
            },
        });

        // 2. delete old tasks
        await tx.$executeRaw`
            DELETE ta
            FROM task_assignments ta
            JOIN care_tasks ct ON ta.task_id = ct.task_id
            WHERE ct.task_category = 'Daily/Routine'
        `;

        // 3. recreate fresh tasks
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

    // -------------------------
    // SOCKET NOTIFICATIONS
    // -------------------------
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
 * Scheduler loop (10 seconds polling as requested)
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