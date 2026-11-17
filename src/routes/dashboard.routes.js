import express from "express";
import {
    getStudentDashboard,
    getInstructorDashboard
} from "../controllers/dashboard.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

router.get(
    "/student/dashboard",
    authenticate,
    authorize("STUDENT"),
    getStudentDashboard
);

router.get(
    "/instructor/dashboard",
    authenticate,
    authorize("INSTRUCTOR"),
    getInstructorDashboard
);

export default router;
