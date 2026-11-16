import express from "express";

import {
    enrollInCourse,
    cancelEnrollment,
    getMyEnrollments,
    getMyEnrollmentStatus,
    getAllEnrollments
} from "../controllers/enrollment.controller.js";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

// STUDENT ENROLLMENT ROUTES

router.post(
    "/courses/:courseId/enroll",
    authenticate,
    authorize("STUDENT"),
    enrollInCourse
);

router.delete(
    "/courses/:courseId/enroll",
    authenticate,
    authorize("STUDENT"),
    cancelEnrollment
);

router.get(
    "/enrollments/my-courses",
    authenticate,
    authorize("STUDENT"),
    getMyEnrollments
);

router.get(
    "/courses/:courseId/enrollment",
    authenticate,
    authorize("STUDENT"),
    getMyEnrollmentStatus
);

// ADMIN ENROLLMENT ROUTE

router.get(
    "/admin/enrollments",
    authenticate,
    authorize("ADMIN"),
    getAllEnrollments
);

export default router;
