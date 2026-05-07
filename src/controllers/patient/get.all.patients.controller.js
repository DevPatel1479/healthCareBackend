// controllers/patient/get.all.patients.controller.js

import prisma from "../../lib/prisma.js";

export const getAllPatients = async (req, res) => {
    try {
        let { page = 1, limit = 10 } = req.query;

        page = Number(page);
        limit = Number(limit);

        const skip = (page - 1) * limit;

        const [patients, totalPatients] = await Promise.all([
            prisma.patients.findMany({
                skip,
                take: limit,
                orderBy: {
                    patient_id: "desc",
                },
                include: {
                    users: {
                        select: {
                            user_id: true,
                            full_name: true,
                            email: true,
                            phone_number: true,
                        },
                    },
                },
            }),

            prisma.patients.count(),
        ]);

        const formattedPatients = patients.map((patient) => ({
            patient_id: patient.patient_id,
            family_lead_id: patient.family_lead_id,
            qr_code_hash: patient.qr_code_hash,
            category: patient.category,
            medical_history: patient.medical_history,
            status: patient.status,
            created_at: patient.created_at,
            updated_at: patient.updated_at,

            family_lead: patient.users
                ? {
                    user_id: patient.users.user_id,
                    full_name: patient.users.full_name,
                    email: patient.users.email,
                    phone_number: patient.users.phone_number,
                }
                : null,
        }));

        return res.status(200).json({
            success: true,
            message: "Patients fetched successfully",

            pagination: {
                current_page: page,
                per_page: limit,
                total_records: totalPatients,
                total_pages: Math.ceil(totalPatients / limit),
            },

            data: formattedPatients,
        });
    } catch (error) {
        console.error("Get Patients Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};