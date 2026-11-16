
import express from "express";

import {
    uploadVideo,
    uploadMaterial,
    uploadThumbnail
} from "../controllers/upload.controller.js";

import {
    videoUpload,
    materialUpload,
    thumbnailUpload,
    handleUpload
} from "../middlewares/upload.middleware.js";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

// VIDEO UPLOAD - INSTRUCTOR
router.post(
    "/uploads/videos",
    authenticate,
    authorize("INSTRUCTOR"),
    handleUpload(videoUpload),
    uploadVideo
);

// PDF MATERIAL UPLOAD - INSTRUCTOR
router.post(
    "/uploads/materials",
    authenticate,
    authorize("INSTRUCTOR"),
    handleUpload(materialUpload),
    uploadMaterial
);

// THUMBNAIL UPLOAD - AUTHENTICATED USER
router.post(
    "/uploads/thumbnails",
    authenticate,
    handleUpload(thumbnailUpload),
    uploadThumbnail
);

export default router;
