import prisma from "../lib/prisma.js";
import { io } from "../server.js";

/**
 * Get today in IST (safe + consistent)
 */
function getISTDate() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

/**
 * Main job
 */
async function runDailyJob() {
    const today = getISTDate();

    // 🔥 ATOMIC LOCK (prevents double execution)
    const lock = await prisma.scheduler_state.updateMany({
        where: {
            id: 1,
            last_processed_date: { not: today },
        },
        data: {
            last_processed_date: today,
        },
    });

    if (lock.count === 0) {
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
        // 🔥 1. DELETE OLD DAILY TASKS
        await tx.$executeRaw`
      DELETE ta
      FROM task_assignments ta
      JOIN care_tasks ct ON ta.task_id = ct.task_id
      WHERE ct.task_category = 'Daily/Routine'
    `;

        // 🔥 2. RECREATE FRESH TASKS
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

    // 🔥 SOCKET NOTIFICATIONS
    const caregivers = new Set();
    const patients = new Set();

    for (const t of oldDailyTasks) {
        if (t.caregiver_id) caregivers.add(t.caregiver_id);
        if (t.patient_id) patients.add(t.patient_id);
    }

    caregivers.forEach((id) =>
        io.to(`caregiver_${id}`).emit("daily_tasks_regenerated", {
            message: "New daily tasks available",
        })
    );

    patients.forEach((id) =>
        io.to(`patient_${id}`).emit("daily_tasks_regenerated", {
            message: "Daily tasks refreshed",
        })
    );

    console.log("✅ Scheduler completed successfully");
}

/**
 * Scheduler loop (production-safe)
 */
export const startDailyTaskScheduler = () => {
    console.log("🟢 Scheduler started");

    setInterval(async () => {
        try {
            await runDailyJob();
        } catch (err) {
            console.error("❌ Scheduler error:", err);
        }
    }, 10 * 1000); // 1 minute safe polling
};