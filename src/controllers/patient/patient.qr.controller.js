import prisma from "../../lib/prisma.js";

export const getPatientQrCode = async (req, res) => {
    try {
        const { patient_id } = req.params;

        if (!patient_id) {
            return res.status(400).json({
                success: false,
                message: "patient_id is required",
            });
        }

        const patient = await prisma.patients.findUnique({
            where: {
                patient_id: Number(patient_id),
            },
            select: {
                patient_id: true,
                qr_code_url: true,
            },
        });

        // Patient doesn't exist
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: "Patient not found",
            });
        }

        // Patient exists but QR not generated yet
        if (!patient.qr_code_url) {
            return res.status(404).json({
                success: false,
                message: "QR code has not been generated yet",
            });
        }

        return res.status(200).json({
            success: true,
            message: "QR code fetched successfully",
            qr_code_url: patient.qr_code_url,
        });

    } catch (error) {
        console.error("Get Patient QR Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};