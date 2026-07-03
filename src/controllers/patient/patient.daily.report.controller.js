import prisma from "../../lib/prisma.js";

export const getPatientDailyReport = async (req, res) => {
    try {

        const {
            patient_id,
            date,
            returnPending = false,
        } = req.body;

        // ✅ Validation
        if (!patient_id || !date) {

            return res.status(400).json({
                success: false,
                message: "patient_id and date are required",
            });
        }

        // ✅ Date range
        const startOfDay = new Date(`${date}T00:00:00.000Z`);

        const endOfDay = new Date(`${date}T23:59:59.999Z`);

        // ✅ FETCH FROM completed_tasks
        // const completedTasks = await prisma.completed_tasks.findMany({

        //     where: {

        //         patient_id: Number(patient_id),

        //         actual_time_done: {
        //             gte: startOfDay,
        //             lte: endOfDay,
        //         },
        //     },

        //     include: {

        //         care_tasks: {

        //             select: {
        //                 task_id: true,
        //                 description: true,
        //                 task_category: true,
        //                 scheduled_time: true,
        //             },
        //         },

        //         users: {

        //             select: {
        //                 user_id: true,
        //                 full_name: true,
        //                 phone_number: true,
        //             },
        //         },
        //     },

        //     orderBy: {
        //         actual_time_done: "asc",
        //     },
        // });


        const completedTasksPromise = prisma.completed_tasks.findMany({
            where: {
                patient_id: Number(patient_id),
                actual_time_done: {
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
                actual_time_done: "asc",
            },
        });
        const pendingTasksPromise = returnPending
            ? prisma.task_assignments.findMany({
                where: {
                    patient_id: Number(patient_id),
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
                    created_at: "asc",
                },
            })
            : Promise.resolve([]);



        const [completedTasks, pendingTasks] = await Promise.all([
            completedTasksPromise,
            pendingTasksPromise,
        ]);
        const completedAssignmentIds = new Set(
            completedTasks
                .filter(task => task.assignment_id !== null)
                .map(task => task.assignment_id)
        );

        const completedTaskIds = new Set(
            completedTasks
                .filter(task => task.task_id !== null)
                .map(task => task.task_id)
        );

        const actualPendingTasks = returnPending
            ? pendingTasks.filter((task) => {

                const category = task.care_tasks?.task_category;

                // Daily/Routine
                if (category === "Daily_Routine") {
                    return !completedAssignmentIds.has(task.assignment_id);
                }

                // Periodic & Unplanned/As Required
                return !completedTaskIds.has(task.task_id);
            })
            : [];
        // ✅ FORMAT RESPONSE
        const completedReport = completedTasks.map((task) => ({

            completed_task_id: task.completed_task_id,

            assignment_id: task.assignment_id,

            task_id: task.task_id,

            task_description:
                task.care_tasks?.description ?? null,

            task_category:
                task.care_tasks?.task_category ?? null,

            scheduled_time:
                task.care_tasks?.scheduled_time ?? null,

            status: task.status,

            completed_at: task.actual_time_done,

            observation_notes:
                task.observation ?? null,

            caregiver: task.users
                ? {
                    caregiver_id: task.users.user_id,
                    full_name: task.users.full_name,
                    phone_number: task.users.phone_number,
                }
                : null,

            photo_proof:
                task.photo_evidence &&
                    /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/i.test(
                        task.photo_evidence
                    )
                    ? task.photo_evidence
                    : null,
        }));

        const pendingReport = actualPendingTasks.map((task) => ({
            completed_task_id: null,

            assignment_id: task.assignment_id,

            task_id: task.task_id,

            task_description:
                task.care_tasks?.description ?? null,

            task_category:
                task.care_tasks?.task_category ?? null,

            scheduled_time:
                task.care_tasks?.scheduled_time ?? null,

            status: "pending",

            completed_at: null,

            observation_notes: null,

            caregiver: task.users
                ? {
                    caregiver_id: task.users.user_id,
                    full_name: task.users.full_name,
                    phone_number: task.users.phone_number,
                }
                : null,

            photo_proof: null,
        }));

        const report = [...completedReport, ...pendingReport].sort((a, b) => {

            const timeA = a.completed_at
                ? new Date(a.completed_at).getTime()
                : Number.MAX_SAFE_INTEGER;

            const timeB = b.completed_at
                ? new Date(b.completed_at).getTime()
                : Number.MAX_SAFE_INTEGER;

            return timeA - timeB;
        });

        return res.status(200).json({

            success: true,

            message:
                "Patient daily report fetched successfully",

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