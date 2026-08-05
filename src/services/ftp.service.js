import fs from "fs/promises";
import path from "path";

export const uploadToFTP = async (buffer, fileName) => {
    const uploadDir = path.join(process.cwd(), "uploads");

    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, fileName);

    await fs.writeFile(filePath, buffer);

    return `${process.env.FILE_BASE_URL}/${fileName}`;
};
