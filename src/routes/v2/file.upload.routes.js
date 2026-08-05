import express from "express";
import { upload } from "../../middlewares/upload.middleware.js";
import { uploadFile } from "../../controllers/file_upload/file.upload.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post(
    "/upload",
    upload.single("file"),
    uploadFile
);

export default router;