import { v4 as uuidv4 } from 'uuid';
import prisma from "../../lib/prisma.js";
import QRCode from 'qrcode';



export const createPatientWithQR = async (req, res) => {
    try {
        const { family_lead_id, category, medical_history } = req.body;

        // Step 1: Validate input
        if (!family_lead_id || !category) {
            return res.status(400).json({
                success: false,
                message: "family_lead_id and category are required"
            });
        }
        const allowedCategories = ['1A', '1B', '2', '3'];
        if (!allowedCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: `Invalid category. Allowed values: ${allowedCategories.join(", ")}`
            });
        }
        // Step 2: Normalize medical_history
        const normalizedMedicalHistory =
            typeof medical_history === "string" && medical_history.trim() !== ""
                ? medical_history.trim()
                : null;

        // Step 3: Check if patient already exists ONLY by family_lead_id
        const existingPatient = await prisma.patients.findFirst({
            where: {
                family_lead_id
            }
        });

        if (existingPatient) {
            return res.status(200).json({
                success: false,
                message: "Patient already exists for this family_lead_id",
                data: {
                    patient_id: existingPatient.patient_id,
                    qr_code_hash: existingPatient.qr_code_hash
                }
            });
        }

        // Step 4: Generate QR value
        const qrValue = uuidv4();

        // Step 5: Create patient
        const newPatient = await prisma.patients.create({
            data: {
                family_lead_id,
                category,
                medical_history: normalizedMedicalHistory,
                qr_code_hash: qrValue
            }
        });

        // Step 6: Generate QR image
        const qrImage = await QRCode.toDataURL(qrValue);

        // Step 7: Response
        return res.status(201).json({
            success: true,
            message: "Patient created successfully",
            data: {
                patient_id: newPatient.patient_id,
                qr_code_hash: qrValue,
                qr_image: qrImage
            }
        });

    } catch (error) {
        console.error("Error creating patient with QR:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};