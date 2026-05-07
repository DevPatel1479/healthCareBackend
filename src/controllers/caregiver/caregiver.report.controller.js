import prisma from "../../lib/prisma.js";

export const getCaregiverOverallReport = async (req, res) => {
    try {
        const { caregiver_id, start_date, end_date } = req.body;

        if (!caregiver_id || !start_date || !end_date) {
            return res.status(400).json({
                success: false,
                message: "caregiver_id, start_date and end_date are required",
            });
        }

        const startDate = new Date(`${start_date}T00:00:00`);
        const endDate = new Date(`${end_date}T23:59:59`);

        const assignments = await prisma.task_assignments.findMany({
            where: {
                caregiver_id: Number(caregiver_id),
                time_done: {
                    gte: startDate,
                    lte: endDate,
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

                patients: {
                    select: {
                        patient_id: true,
                        category: true,
                        users: {
                            select: {
                                user_id: true,
                                full_name: true,
                                phone_number: true,
                            },
                        },
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
                time_done: "desc",
            },
        });

        const report = assignments.map((task) => ({
            assignment_id: task.assignment_id,

            completed_at: task.time_done,

            status: task.status,

            flag_level: task.flag_level,

            observation: task.observation,

            photo_proof: task.photo_evidence,

            shift: task.shifts
                ? {
                    shift_id: task.shifts.shift_id,
                    shift_name: task.shifts.shift_name,
                }
                : null,

            patient: task.patients
                ? {
                    patient_id: task.patients.patient_id,
                    category: task.patients.category,

                    family_lead: task.patients.users
                        ? {
                            user_id: task.patients.users.user_id,
                            full_name: task.patients.users.full_name,
                            phone_number:
                                task.patients.users.phone_number,
                        }
                        : null,
                }
                : null,

            task: task.care_tasks
                ? {
                    task_id: task.care_tasks.task_id,
                    description:
                        task.care_tasks.description,
                    task_category:
                        task.care_tasks.task_category,
                    scheduled_time:
                        task.care_tasks.scheduled_time,
                }
                : null,
        }));

        return res.status(200).json({
            success: true,
            message: "Caregiver overall report fetched successfully",

            caregiver_id: Number(caregiver_id),

            total_tasks: report.length,

            data: report,
        });
    } catch (error) {
        console.error("Caregiver Overall Report Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


export const getCaregiverPatientWiseReport = async (req, res) => {
    try {
        const { caregiver_id, start_date, end_date } = req.body;

        if (!caregiver_id || !start_date || !end_date) {
            return res.status(400).json({
                success: false,
                message: "caregiver_id, start_date and end_date are required",
            });
        }

        const startDate = new Date(`${start_date}T00:00:00`);
        const endDate = new Date(`${end_date}T23:59:59`);

        const assignments = await prisma.task_assignments.findMany({
            where: {
                caregiver_id: Number(caregiver_id),

                time_done: {
                    gte: startDate,
                    lte: endDate,
                },
            },

            include: {
                care_tasks: true,

                patients: {
                    select: {
                        patient_id: true,
                        category: true,
                    },
                },
            },

            orderBy: {
                patient_id: "asc",
            },
        });

        // GROUPING
        const groupedReport = {};

        assignments.forEach((task) => {
            const patientId = task.patients?.patient_id;

            if (!patientId) return;

            if (!groupedReport[patientId]) {
                groupedReport[patientId] = {
                    patient_id: patientId,
                    category: task.patients.category,
                    total_tasks: 0,
                    tasks: [],
                };
            }

            groupedReport[patientId].tasks.push({
                assignment_id: task.assignment_id,

                completed_at: task.time_done,

                status: task.status,

                observation: task.observation,

                task: task.care_tasks
                    ? {
                        task_id: task.care_tasks.task_id,
                        description:
                            task.care_tasks.description,

                        task_category:
                            task.care_tasks.task_category,
                    }
                    : null,
            });

            groupedReport[patientId].total_tasks += 1;
        });

        return res.status(200).json({
            success: true,
            message:
                "Caregiver patient-wise report fetched successfully",

            caregiver_id: Number(caregiver_id),

            total_patients: Object.keys(groupedReport).length,

            data: Object.values(groupedReport),
        });
    } catch (error) {
        console.error(
            "Caregiver Patient Wise Report Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};