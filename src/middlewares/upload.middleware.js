
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const uploadRoot = path.resolve(process.cwd(), "uploads");

const createUploader = (folder, maxSize) => {
    const destination = path.join(uploadRoot, folder);

    fs.mkdirSync(destination, { recursive: true });

    return multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, destination);
            },
            filename: (req, file, cb) => {
                cb(null, randomUUID());
            }
        }),
        limits: {
            fileSize: maxSize,
            files: 1
        }
    });
};

// Development upload limits
export const videoUpload = createUploader(
    "videos",
    500 * 1024 * 1024
);

export const materialUpload = createUploader(
    "materials",
    20 * 1024 * 1024
);

export const thumbnailUpload = createUploader(
    "thumbnails",
    5 * 1024 * 1024
);

// Handle Multer errors
export const handleUpload = (uploader) => {
    return (req, res, next) => {
        uploader.single("file")(req, res, (error) => {
            if (!error) {
                return next();
            }

            if (error instanceof multer.MulterError) {
                if (error.code === "LIMIT_FILE_SIZE") {
                    return res.status(413).json({
                        success: false,
                        message: "Uploaded file exceeds the allowed size"
                    });
                }

                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            return next(error);
        });
    };
};
