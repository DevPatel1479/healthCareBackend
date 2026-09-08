import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",

    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only JPG, PNG and WEBP files are allowed"));
    }
};

export const upload = multer({
    storage,
    limits: {
        // fileSize: 2 * 1024 * 1024, // 2 MB
        fileSize: 7 * 1024 * 1024, // 7 MB for testing

    },
    fileFilter,
});