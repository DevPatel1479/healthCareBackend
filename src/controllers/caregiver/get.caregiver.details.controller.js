import prisma from "../../lib/prisma.js";

export const getCaregiverDetails = async (req, res) => {
    try {
        const { caregiver_id } = req.params;

        // ✅ Validation
        if (!caregiver_id || isNaN(caregiver_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid caregiver_id is required",
            });
        }

        // ✅ Fetch caregiver
        const caregiver = await prisma.caregiver_master.findUnique({
            where: {
                caregiver_id: Number(caregiver_id),
            },

            include: {
                users: {
                    select: {
                        user_id: true,
                        full_name: true,
                        email: true,
                        phone_number: true,
                        role: true,
                        is_verified: true,
                        created_at: true,
                        updated_at: true,
                        last_login: true,
                    },
                },
            },
        });

        // ✅ Not found
        if (!caregiver) {
            return res.status(404).json({
                success: false,
                message: "Caregiver not found",
            });
        }

        // ✅ Recent assignments
        const recentAssignments =
            await prisma.task_assignments.findMany({
                where: {
                    caregiver_id: Number(caregiver_id),
                },

                include: {
                    patients: {
                        select: {
                            patient_id: true,
                            category: true,
                        },
                    },

                    care_tasks: {
                        select: {
                            task_id: true,
                            description: true,
                            task_category: true,
                        },
                    },

                    shifts: {
                        select: {
                            shift_id: true,
                            shift_name: true,
                        },
                    },
                },

                orderBy: {
                    assignment_id: "desc",
                },

                take: 10,
            });

        // ✅ Response formatting
        const formattedCaregiver = {
            caregiver_id: caregiver.caregiver_id,

            specialization: caregiver.specialization,

            experience_years: caregiver.experience_years,

            assigned_area: caregiver.assigned_area,

            is_active: caregiver.is_active,

            joining_date: caregiver.joining_date,

            created_at: caregiver.created_at,

            updated_at: caregiver.updated_at,

            user: caregiver.users
                ? {
                    user_id: caregiver.users.user_id,
                    full_name: caregiver.users.full_name,
                    email: caregiver.users.email,
                    phone_number:
                        caregiver.users.phone_number,
                    role: caregiver.users.role,
                    is_verified:
                        caregiver.users.is_verified,
                    last_login:
                        caregiver.users.last_login,
                    created_at:
                        caregiver.users.created_at,
                }
                : null,

            recent_assignments: recentAssignments.map(
                (task) => ({
                    assignment_id: task.assignment_id,

                    status: task.status,

                    time_done: task.time_done,

                    flag_level: task.flag_level,

                    observation: task.observation,

                    supervisor_val:
                        task.supervisor_val,

                    patient: task.patients
                        ? {
                            patient_id:
                                task.patients.patient_id,

                            category:
                                task.patients.category,
                        }
                        : null,

                    task: task.care_tasks
                        ? {
                            task_id:
                                task.care_tasks.task_id,

                            description:
                                task.care_tasks
                                    .description,

                            task_category:
                                task.care_tasks
                                    .task_category,
                        }
                        : null,

                    shift: task.shifts
                        ? {
                            shift_id:
                                task.shifts.shift_id,

                            shift_name:
                                task.shifts.shift_name,
                        }
                        : null,
                })
            ),
        };

        return res.status(200).json({
            success: true,
            message:
                "Caregiver details fetched successfully",

            data: formattedCaregiver,
        });
    } catch (error) {
        console.error(
            "Get Caregiver Details Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};