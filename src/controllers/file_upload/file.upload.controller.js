import path from "path";
import { v4 as uuidv4 } from "uuid";
import { uploadToFTP } from "../../services/ftp.service.js";

export const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded",
            });
        }

        const extension = path.extname(
            req.file.originalname
        );

        const fileName = `${uuidv4()}${extension}`;

        const fileUrl = await uploadToFTP(
            req.file.buffer,
            fileName
        );

        return res.status(200).json({
            success: true,
            message: "File uploaded successfully",
            url: fileUrl,
        });
    } catch (error) {
        next(error);
    }
};