import express from "express";
import {
    getMyProfile,
    updateMyProfile
} from "../controllers/profile.controller.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = express.Router();

router.get("/profile/me", authenticate, getMyProfile);
router.patch("/profile/me", authenticate, updateMyProfile);

export default router;
