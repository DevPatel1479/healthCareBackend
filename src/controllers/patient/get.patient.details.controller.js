import prisma from "../../lib/prisma.js";

export const getPatientDetails = async (req, res) => {
    try {
        const { patient_id } = req.params;

        // ✅ Validation
        if (!patient_id || isNaN(patient_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid patient_id is required",
            });
        }

        // ✅ Fetch patient
        const patient = await prisma.patients.findUnique({
            where: {
                patient_id: Number(patient_id),
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
                    },
                },

                task_assignments: {
                    select: {
                        assignment_id: true,
                        status: true,
                        time_done: true,
                        flag_level: true,
                    },

                    orderBy: {
                        assignment_id: "desc",
                    },

                    take: 10,
                },
            },
        });

        // ✅ Not found
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: "Patient not found",
            });
        }

        // ✅ Response formatting
        const formattedPatient = {
            patient_id: patient.patient_id,

            category: patient.category,

            medical_history: patient.medical_history,

            qr_code_hash: patient.qr_code_hash,

            status: patient.status,

            created_at: patient.created_at,

            updated_at: patient.updated_at,

            family_lead: patient.users
                ? {
                    user_id: patient.users.user_id,
                    full_name: patient.users.full_name,
                    email: patient.users.email,
                    phone_number: patient.users.phone_number,
                    role: patient.users.role,
                    is_verified: patient.users.is_verified,
                    created_at: patient.users.created_at,
                }
                : null,

            recent_assignments:
                patient.task_assignments.map((task) => ({
                    assignment_id: task.assignment_id,
                    status: task.status,
                    time_done: task.time_done,
                    flag_level: task.flag_level,
                })) || [],
        };

        return res.status(200).json({
            success: true,
            message: "Patient details fetched successfully",
            data: formattedPatient,
        });
    } catch (error) {
        console.error("Get Patient Details Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};