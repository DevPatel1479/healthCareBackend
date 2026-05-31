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
        return;
    }

    console.log("🚀 New day detected");

    // update scheduler state
    await prisma.scheduler_state.update({
        where: { id: 1 },
        data: {
            last_processed_date: today,
        },
    });

    // notify all connected caregivers
    io?.emit("daily_tasks_regenerated", {
        message: "New day started",
        date: today,
    });

    console.log("✅ New-day notification emitted");
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