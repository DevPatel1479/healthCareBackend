import path from "path";
import { v4 as uuidv4 } from "uuid";
import { uploadToFTP } from "../../services/ftp.service.js";

export const uploadFile = async (req, res, next) => {
    console.log("========== FILE UPLOAD REQUEST ==========");
    console.log("Headers:", req.headers);
    console.log("File exists:", !!req.file);
    try {
	if (req.file) {
            console.log("Original Name:", req.file.originalname);
            console.log("Mime Type:", req.file.mimetype);
            console.log("Size:", req.file.size);
        }
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
	console.log("Generated Filename:", fileName);
        console.log("Uploading to FTP...");

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
	console.error("========== FILE UPLOAD ERROR ==========");
        console.error(error);
        console.error(error.message);
        console.error(error.stack);
	console.log(`error found ${error}`);
        next(error);
    }
};
