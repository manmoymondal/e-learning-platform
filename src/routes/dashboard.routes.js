import express from "express";
import { getStudentDashboard } from "../controllers/dashboard.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

router.get(
    "/student/dashboard",
    authenticate,
    authorize("STUDENT"),
    getStudentDashboard
);

export default router;
