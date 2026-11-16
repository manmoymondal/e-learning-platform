
import express from "express";

import {
    getAllPublishedCourses,
    createCourse,
    getPublishedCourseById,
    updateCourse,
    deleteCourse,
    getMyCourses,
    getMyCourseDetails,
    getCourseCurriculum,
    getCourseStudents,
    getAllCoursesForAdmin
} from "../controllers/course.controller.js";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

// ==========================================
// PUBLIC COURSE ROUTES
// ==========================================

router.get("/courses", getAllPublishedCourses);

router.get("/courses/:courseId/modules", getCourseCurriculum);

router.get("/courses/:courseId", getPublishedCourseById);

// ==========================================
// INSTRUCTOR COURSE ROUTES
// ==========================================

router.get(
    "/instructor/courses",
    authenticate,
    authorize("INSTRUCTOR"),
    getMyCourses
);

router.get(
    "/instructor/courses/:courseId",
    authenticate,
    authorize("INSTRUCTOR"),
    getMyCourseDetails
);

// ==========================================
// ADMIN COURSE ROUTES
// ==========================================

router.get(
    "/admin/courses",
    authenticate,
    authorize("ADMIN"),
    getAllCoursesForAdmin
);

// ==========================================
// COURSE CREATION AND MANAGEMENT
// ==========================================

router.post(
    "/courses",
    authenticate,
    authorize("INSTRUCTOR"),
    createCourse
);

router.patch(
    "/courses/:courseId",
    authenticate,
    authorize("INSTRUCTOR"),
    updateCourse
);

router.delete(
    "/courses/:courseId",
    authenticate,
    authorize("INSTRUCTOR", "ADMIN"),
    deleteCourse
);

router.get(
    "/courses/:courseId/students",
    authenticate,
    authorize("INSTRUCTOR", "ADMIN"),
    getCourseStudents
);

export default router;
