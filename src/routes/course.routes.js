
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

import {
    createCourseRevision,
    getCourseRevisions,
    getCourseRevisionById,
    updateCourseRevisionContent,
    submitCourseRevision,
    getRevisionsForAdmin,
    reviewCourseRevision
} from "../controllers/courseRevision.controller.js";

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

// ==========================================
// COURSE REVISION ROUTES
// ==========================================

// Instructor: create revision
router.post(
    "/courses/:courseId/revisions",
    authenticate,
    authorize("INSTRUCTOR"),
    createCourseRevision
);

// Instructor or Admin: list revisions
router.get(
    "/courses/:courseId/revisions",
    authenticate,
    authorize("INSTRUCTOR", "ADMIN"),
    getCourseRevisions
);

// Instructor or Admin: revision details
router.get(
    "/courses/:courseId/revisions/:revisionId",
    authenticate,
    authorize("INSTRUCTOR", "ADMIN"),
    getCourseRevisionById
);

// Instructor: update draft content
router.put(
    "/courses/:courseId/revisions/:revisionId/content",
    authenticate,
    authorize("INSTRUCTOR"),
    updateCourseRevisionContent
);

// Instructor: submit revision
router.post(
    "/courses/:courseId/revisions/:revisionId/submit",
    authenticate,
    authorize("INSTRUCTOR"),
    submitCourseRevision
);

// Admin: list revisions for review
router.get(
    "/admin/revisions",
    authenticate,
    authorize("ADMIN"),
    getRevisionsForAdmin
);

// Admin: approve or reject revision
router.patch(
    "/admin/revisions/:revisionId/review",
    authenticate,
    authorize("ADMIN"),
    reviewCourseRevision
);

export default router;
