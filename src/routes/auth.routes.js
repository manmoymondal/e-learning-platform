
import express from "express";

import {
    registerStudent,
    loginStudent,
    getCurrentUser,
    changePassword
} from "../controllers/auth.controller.js";

import { authenticate } from "../middlewares/authenticate.js";

const router = express.Router();

// Public routes
router.post("/register", registerStudent);
router.post("/login", loginStudent);

// Protected route
router.get("/me", authenticate, getCurrentUser);

router.patch(
    "/change-password",
    authenticate,
    changePassword
);

export default router;

