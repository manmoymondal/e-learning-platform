import express from "express";
import {
    getStudentDashboard,
    getInstructorDashboard,
    getInstructorStudents
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

router.get(
    "/instructor/students",
    authenticate,
    authorize("INSTRUCTOR"),
    getInstructorStudents
);

export default router;
