// controllers/login/login.controller.js

import prisma from "../../lib/prisma.js";

export const loginController = async (req, res) => {
    try {
        const { phone_number } = req.body;

        // Validation
        if (!phone_number) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required",
            });
        }

        // Find user by phone number
        const user = await prisma.users.findFirst({
            where: {
                phone_number,
            },
            select: {
                user_id: true,
                role: true,
                full_name: true,
                is_verified: true,
                caregiver_master: {
                    select: {
                        caregiver_id: true,
                    },
                },
                patients: {
                    select: {
                        patient_id: true,
                    },
                    take: 1,
                },
            },
        });

        // User not found
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        let reference_id = null;

        // Role based ID mapping
        switch (user.role) {
            case "family_lead":
                reference_id = user.patients?.[0]?.patient_id || null;
                break;

            case "caregiver":
                reference_id = user.caregiver_master?.caregiver_id || null;
                break;

            case "admin":
            case "doctor":
                reference_id = user.user_id;
                break;

            default:
                reference_id = user.user_id;
        }

        // Update last login asynchronously
        prisma.users.update({
            where: {
                user_id: user.user_id,
            },
            data: {
                last_login: new Date(),
            },
        }).catch((err) => {
            console.error("Last login update failed:", err);
        });

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user_id: user.user_id,
                role: user.role,
                reference_id,
                full_name: user.full_name,
                is_verified: user.is_verified,
            },
        });

    } catch (error) {
        console.error("Login Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};