// import { v4 as uuidv4 } from 'uuid';

// import QRCode from 'qrcode';

import prisma from "../../lib/prisma.js";
import { generatePatientQR } from "../../services/patientQr.service.js";

export const generateOrUpdatePatientQR =
    async (req, res) => {

        try {

            const { patient_id } = req.body;

            const patient =
                await prisma.patients.findUnique({
                    where: { patient_id },
                });

            if (!patient) {
                return res.status(404).json({
                    success: false,
                    message: "Patient not found",
                });
            }

            const {
                qrValue,
                qrUrl
            } = await generatePatientQR(
                patient_id
            );

            await prisma.patients.update({
                where: { patient_id },
                data: {
                    qr_code_hash: qrValue,
                    qr_code_url: qrUrl,
                },
            });

            return res.status(200).json({
                success: true,
                message:
                    "QR generated successfully",
                data: {
                    patient_id,
                    qr_code_hash: qrValue,
                    qr_code_url: qrUrl,
                },
            });

        } catch (error) {

            console.error(error);

            return res.status(500).json({
                success: false,
                message:
                    "Internal server error",
            });
        }
    };