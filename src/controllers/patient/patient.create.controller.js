import { v4 as uuidv4 } from 'uuid';
import prisma from "../../lib/prisma.js";
import QRCode from 'qrcode';

export const generateOrUpdatePatientQR = async (req, res) => {
    try {
        const { patient_id } = req.body;

        // Step 1: Validate input
        if (!patient_id) {
            return res.status(400).json({
                success: false,
                message: "patient_id is required"
            });
        }

        // Step 2: Check if patient exists
        const patient = await prisma.patients.findUnique({
            where: { patient_id }
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: "Patient not found"
            });
        }

        // Step 3: Generate NEW QR every time (regenerate)
        const newQRValue = uuidv4();

        // Step 4: Update QR in DB
        const updatedPatient = await prisma.patients.update({
            where: { patient_id },
            data: {
                qr_code_hash: newQRValue
            }
        });

        // Step 5: Generate QR image
        const qrImage = await QRCode.toDataURL(newQRValue);

        // Step 6: Response
        return res.status(200).json({
            success: true,
            message: "QR code generated/updated successfully",
            data: {
                patient_id: updatedPatient.patient_id,
                qr_code_hash: newQRValue,
                qr_image: qrImage
            }
        });

    } catch (error) {
        console.error("Error generating/updating QR:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};