// controllers/report/patient.daily.report.controller.js

import prisma from "../../lib/prisma.js";

export const getPatientDailyReport = async (req, res) => {
    try {
        const { patient_id, date } = req.body;

        // ✅ Validation
        if (!patient_id || !date) {
            return res.status(400).json({
                success: false,
                message: "patient_id and date are required",
            });
        }

        // ✅ Parse date safely
        const startOfDay = new Date(`${date}T00:00:00.000Z`);
        const endOfDay = new Date(`${date}T23:59:59.999Z`);

        const assignments = await prisma.task_assignments.findMany({
            where: {
                patient_id: Number(patient_id),
                time_done: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            include: {
                care_tasks: {
                    select: {
                        task_id: true,
                        description: true,
                        task_category: true,
                        scheduled_time: true,
                    },
                },
                users: {
                    select: {
                        user_id: true,
                        full_name: true,
                        phone_number: true,
                    },
                },
            },
            orderBy: {
                time_done: "asc",
            },
        });

        const report = assignments.map((task) => ({
            assignment_id: task.assignment_id,
            task_id: task.task_id,
            task_description: task.care_tasks?.description ?? null,
            task_category: task.care_tasks?.task_category ?? null,
            scheduled_time: task.care_tasks?.scheduled_time ?? null,
            status: task.status,
            completed_at: task.time_done,
            observation_notes: task.observation ?? null,
            caregiver: task.users
                ? {
                    caregiver_id: task.users.user_id,
                    full_name: task.users.full_name,
                    phone_number: task.users.phone_number,
                }
                : null,
            photo_proof:
                task.photo_evidence &&
                    /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/i.test(task.photo_evidence)
                    ? task.photo_evidence
                    : null,
        }));

        return res.status(200).json({
            success: true,
            message: "Patient daily report fetched successfully",
            selected_date: date,
            patient_id: Number(patient_id),
            total_tasks: report.length,
            data: report,
        });
    } catch (error) {
        console.error("Daily Report Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};