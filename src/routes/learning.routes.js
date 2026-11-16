import express from "express";
import {
    getLessonDetails,
    getLessonProgress,
    updateLessonProgress,
    getCourseProgress
} from "../controllers/learning.controller.js";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

router.get(
    "/lessons/:lessonId",
    authenticate,
    getLessonDetails
);

router.get(
    "/lessons/:lessonId/progress",
    authenticate,
    authorize("STUDENT"),
    getLessonProgress
);

router.patch(
    "/lessons/:lessonId/progress",
    authenticate,
    authorize("STUDENT"),
    updateLessonProgress
);

router.get(
    "/courses/:courseId/progress",
    authenticate,
    authorize("STUDENT"),
    getCourseProgress
);

export default router;
