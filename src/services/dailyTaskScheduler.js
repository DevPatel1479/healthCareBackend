import prisma from "../lib/prisma.js";
import { io } from "../server.js";

let lastProcessedDate = new Date().toDateString();

export const startDailyTaskScheduler = () => {

    console.log("Daily task scheduler started...");

    setInterval(async () => {

        try {

            const currentDate = new Date().toDateString();

            // =================================================
            // CHECK IF NEW DAY STARTED
            // =================================================

            if (currentDate !== lastProcessedDate) {

                console.log("New day detected. Regenerating tasks...");

                // =============================================
                // 1. MOVE COMPLETED TASKS TO HISTORY
                // =============================================

                await prisma.$executeRaw`

                    INSERT IGNORE INTO completed_tasks (
                        task_id,
                        patient_id,
                        caregiver_id,
                        shift_id,
                        assignment_id,
                        scheduled_time,
                        actual_time_done,
                        status,
                        flag_level,
                        observation,
                        photo_evidence
                    )

                    SELECT
                        ta.task_id,
                        ta.patient_id,
                        ta.caregiver_id,
                        ta.shift_id,
                        ta.assignment_id,
                        NULL,
                        ta.time_done,
                        ta.status,
                        ta.flag_level,
                        ta.observation,
                        ta.photo_evidence

                    FROM task_assignments ta

                    JOIN care_tasks ct
                      ON ta.task_id = ct.task_id

                    WHERE ct.task_category = 'Daily/Routine'
                      AND ta.status IN ('completed', 'skipped', 'refused')
                `;

                // =============================================
                // 2. DELETE OLD DAILY TASKS
                // =============================================

                await prisma.$executeRaw`

                    DELETE ta

                    FROM task_assignments ta

                    JOIN care_tasks ct
                      ON ta.task_id = ct.task_id

                    WHERE ct.task_category = 'Daily/Routine'
                `;

                // =============================================
                // 3. CREATE FRESH DAILY TASKS
                // =============================================

                const generatedTasks = await prisma.$queryRaw`

    SELECT
        ct.task_id,
        cs.patient_id,
        cs.caregiver_id,
        cs.shift_id

    FROM care_tasks ct

    JOIN caregiver_shifts cs

    WHERE ct.task_category = 'Daily/Routine'
`;


                // =============================================
                // 4. INSERT FRESH DAILY TASKS
                // =============================================

                await prisma.task_assignments.createMany({

                    data: generatedTasks.map(task => ({

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
                const caregiverIds = new Set();
                const patientIds = new Set();

                for (const task of generatedTasks) {

                    caregiverIds.add(task.caregiver_id);
                    patientIds.add(task.patient_id);
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
                // Notify patients/family
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

                // UPDATE LAST DATE
                lastProcessedDate = currentDate;
            }

        } catch (err) {

            console.error("Scheduler Error:", err);
        }

    }, 5000); // every 5 seconds
};