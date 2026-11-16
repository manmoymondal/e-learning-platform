
import { fileTypeFromFile } from "file-type";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { prisma } from "../config/db.js";

const ALLOWED_TYPES = {
    VIDEO: {
        folder: "videos",
        types: {
            "video/mp4": "mp4",
            "video/webm": "webm",
            "video/quicktime": "mov",
            "video/x-msvideo": "avi",
            "video/x-matroska": "mkv"
        }
    },

    PDF: {
        folder: "materials",
        types: {
            "application/pdf": "pdf"
        }
    },

    THUMBNAIL: {
        folder: "thumbnails",
        types: {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif"
        }
    }
};

const removeFile = async (filePath) => {
    if (!filePath) return;

    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("File cleanup error:", error);
        }
    }
};

const uploadAsset = (assetType) => {
    return async (req, res) => {
        let storedPath = req.file?.path;

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a file"
                });
            }

            // Validate PDF title
            let title = null;

            if (assetType === "PDF") {
                title = req.body.title?.trim();

                if (
                    typeof title !== "string" ||
                    title.length < 1 ||
                    title.length > 150
                ) {
                    await removeFile(storedPath);

                    return res.status(400).json({
                        success: false,
                        message: "Title is required and must be between 1 and 150 characters"
                    });
                }
            }

            // Detect actual file type from file contents
            const detectedType = await fileTypeFromFile(req.file.path);

            const config = ALLOWED_TYPES[assetType];
            const extension = detectedType
                ? config.types[detectedType.mime]
                : null;

            if (!extension) {
                await removeFile(storedPath);

                return res.status(400).json({
                    success: false,
                    message: `Invalid ${assetType.toLowerCase()} file type`
                });
            }

            // Generate a safe filename using the detected extension
            const filename = `${randomUUID()}.${extension}`;

            const destination = path.resolve(
                process.cwd(),
                "uploads",
                config.folder,
                filename
            );

            await fs.rename(req.file.path, destination);
            storedPath = destination;

            const fileUrl =
                `${req.protocol}://${req.get("host")}` +
                `/uploads/${config.folder}/${filename}`;

            // Save metadata in PostgreSQL
            const asset = await prisma.asset.create({
                data: {
                    assetType,
                    title,
                    fileUrl,
                    originalFilename: path.basename(
                        req.file.originalname
                    ),
                    mimeType: detectedType.mime,
                    fileSize: BigInt(req.file.size)
                }
            });

            return res.status(201).json({
                success: true,
                message: `${assetType} uploaded successfully`,
                data: {
                    ...asset,
                    fileSize: Number(asset.fileSize)
                }
            });

        } catch (error) {
            await removeFile(storedPath);

            console.error("Upload error:", error);

            return res.status(500).json({
                success: false,
                message: "File upload failed"
            });
        }
    };
};

export const uploadVideo = uploadAsset("VIDEO");

export const uploadMaterial = uploadAsset("PDF");

export const uploadThumbnail = uploadAsset("THUMBNAIL");
