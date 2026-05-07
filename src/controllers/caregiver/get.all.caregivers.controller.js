// controllers/caregiver/get.all.caregivers.controller.js

import prisma from "../../lib/prisma.js";

export const getAllCaregivers = async (req, res) => {
    try {
        let { page = 1, limit = 10 } = req.query;

        page = Number(page);
        limit = Number(limit);

        const skip = (page - 1) * limit;

        const [caregivers, totalCaregivers] = await Promise.all([
            prisma.caregiver_master.findMany({
                skip,
                take: limit,

                orderBy: {
                    caregiver_id: "desc",
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
                            last_login: true,
                        },
                    },
                },
            }),

            prisma.caregiver_master.count(),
        ]);

        const formattedCaregivers = caregivers.map((caregiver) => ({
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
                    phone_number: caregiver.users.phone_number,
                    role: caregiver.users.role,
                    is_verified: caregiver.users.is_verified,
                    last_login: caregiver.users.last_login,
                }
                : null,
        }));

        return res.status(200).json({
            success: true,
            message: "Caregivers fetched successfully",

            pagination: {
                current_page: page,
                per_page: limit,
                total_records: totalCaregivers,
                total_pages: Math.ceil(totalCaregivers / limit),
            },

            data: formattedCaregivers,
        });
    } catch (error) {
        console.error("Get Caregivers Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};