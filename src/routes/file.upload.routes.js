import express from "express";
import { upload } from "../middlewares/upload.middleware.js";
import { uploadFile } from "../controllers/file_upload/file.upload.controller.js";

const router = express.Router();

router.post(
    "/upload",
    upload.single("file"),
    uploadFile
);

export default router;