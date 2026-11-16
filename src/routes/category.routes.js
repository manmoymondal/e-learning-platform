
import express from "express";

import {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} from "../controllers/category.controller.js";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

// Public routes
router.get("/", getAllCategories);
router.get("/:categoryId", getCategoryById);

// Admin-only routes
router.post(
    "/",
    authenticate,
    authorize("ADMIN"),
    createCategory
);

router.patch(
    "/:categoryId",
    authenticate,
    authorize("ADMIN"),
    updateCategory
);

router.delete(
    "/:categoryId",
    authenticate,
    authorize("ADMIN"),
    deleteCategory
);

export default router;
