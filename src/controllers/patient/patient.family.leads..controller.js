import prisma from "../../lib/prisma.js";

export const getFamilyLeadContacts = async (req, res) => {
    try {
        const { patient_id } = req.params;

        if (!patient_id) {
            return res.status(400).json({
                success: false,
                message: "patient_id is required",
            });
        }

        /**
         * STEP 1: Get family_lead_id from patient
         */
        const patient = await prisma.patients.findUnique({
            where: {
                patient_id: Number(patient_id),
            },
            select: {
                family_lead_id: true,
            },
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: "Patient not found",
            });
        }

        /**
         * STEP 2: Fetch contacts for that family lead
         */
        const contacts = await prisma.family_lead_contacts.findMany({
            where: {
                user_id: patient.family_lead_id,
            },
            select: {
                contact_name: true,
                phone_number: true,
            },
            orderBy: {
                priority: "asc",
            },
        });

        return res.status(200).json({
            success: true,
            data: contacts,
        });

    } catch (error) {
        console.error("getFamilyLeadContacts error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};