import QRCode from "qrcode";
import { uploadToFTP } from "./ftp.service.js";

export const generatePatientQR = async (
    patientId
) => {

    const qrValue = String(patientId);

    const qrBuffer =
        await QRCode.toBuffer(qrValue, {
            type: "png",
            width: 500,
            margin: 2,
        });

    const fileName =
        `patient-${patientId}.png`;

    const qrUrl =
        await uploadToFTP(
            qrBuffer,
            fileName
        );

    return {
        qrValue,
        qrUrl,
    };
};