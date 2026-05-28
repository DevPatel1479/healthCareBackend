import prisma from "../lib/prisma.js";
import { io } from "../server.js";

let lastProcessedDate = new Date().toDateString();

let isSchedulerRunning = false;
export const startDailyTaskScheduler = () => {

    console.log("Daily task scheduler started...");

    setInterval(async () => {
        if (isSchedulerRunning) {

            console.log("Scheduler already running...");
            return;
        }

        isSchedulerRunning = true;
        try {

            const currentDate = new Date().toDateString();
            if (currentDate === lastProcessedDate) {

                console.log("Same day detected. No regeneration needed.");
                isSchedulerRunning = false;
                return;
            }

            // =================================================
            // ENABLE THIS IN PRODUCTION
            // =================================================

            // if (currentDate !== lastProcessedDate) {

            console.log("New day detected. Regenerating tasks...");

            // =================================================
            // 1. GET OLD DAILY TASK ASSIGNMENTS
            // =================================================

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

                JOIN care_tasks ct
                    ON ta.task_id = ct.task_id

                WHERE ct.task_category = 'Daily/Routine'
            `;

            // =================================================
            // 2. MOVE COMPLETED TASKS TO HISTORY
            // =================================================


            // =================================================
            // 3. DELETE OLD DAILY TASKS
            // =================================================

            await prisma.$transaction(async (tx) => {

                await tx.$executeRaw`

        DELETE ta

        FROM task_assignments ta

        JOIN care_tasks ct
            ON ta.task_id = ct.task_id

        WHERE ct.task_category = 'Daily/Routine'
    `;

                await tx.task_assignments.createMany({

                    data: oldDailyTasks.map(task => ({

                        task_id: task.task_id,

                        patient_id: task.patient_id,

                        caregiver_id: task.caregiver_id,

                        shift_id: task.shift_id,

                        status: "pending",

                        time_done: null,

                        flag_level: "green",

                        observation: null,

                        photo_evidence: null,

                        supervisor_val: false
                    }))
                });

            });
            // =================================================
            // 5. SEND WEBSOCKET NOTIFICATIONS
            // =================================================

            const caregiverIds = new Set();
            const patientIds = new Set();

            for (const task of oldDailyTasks) {

                if (task.caregiver_id) {
                    caregiverIds.add(task.caregiver_id);
                }

                if (task.patient_id) {
                    patientIds.add(task.patient_id);
                }
            }

            // Notify caregivers

            for (const caregiverId of caregiverIds) {

                io.to(`caregiver_${caregiverId}`).emit(
                    "daily_tasks_regenerated",
                    {
                        message: "New daily tasks are available."
                    }
                );
            }

            // Notify patients

            for (const patientId of patientIds) {

                io.to(`patient_${patientId}`).emit(
                    "daily_tasks_regenerated",
                    {
                        message: "Daily care tasks refreshed."
                    }
                );
            }

            console.log("Websocket notifications sent.");

            console.log("Daily tasks regenerated successfully.");

            lastProcessedDate = currentDate;

            // }

        } catch (err) {

            console.error("Scheduler Error:", err);
        } finally {

            isSchedulerRunning = false;

        }

    }, 5000); // every 2 minutes for testing
};