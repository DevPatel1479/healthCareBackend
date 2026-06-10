import ftp from "basic-ftp";
import { Readable } from "stream";

export const uploadToFTP = async (buffer, fileName) => {
    const client = new ftp.Client();

    try {
        await client.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false,
        });

        await client.ensureDir("/uploads");

        await client.uploadFrom(
            Readable.from(buffer),
            `/uploads/${fileName}`
        );

        return `${process.env.FILE_BASE_URL}/${fileName}`;
    } finally {
        client.close();
    }
};