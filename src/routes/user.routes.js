import express from "express";

import {
    getAllUsers,
    createInstructor,
    getUserById,
    updateUser,
    updateUserStatus
} from "../controllers/user.controller.js";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

// All user management routes require ADMIN authentication
router.use(authenticate, authorize("ADMIN"));

// Get all users
router.get("/", getAllUsers);

// Create instructor
router.post("/instructors", createInstructor);

// Get user by ID
router.get("/:userId", getUserById);

// Update user details
router.patch("/:userId", updateUser);

// Activate or deactivate user
router.patch("/:userId/status", updateUserStatus);

export default router;