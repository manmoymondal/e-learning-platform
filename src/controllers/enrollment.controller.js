import { prisma } from "../config/db.js";

const VALID_STATUSES = ["ACTIVE", "CANCELLED"];

const isValidUuid = (id) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

const getPagination = (query) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    if (
        !Number.isInteger(page) ||
        !Number.isInteger(limit) ||
        page < 1 ||
        limit < 1 ||
        limit > 100
    ) {
        return null;
    }

    return {
        page,
        limit,
        skip: (page - 1) * limit
    };
};

const sendError = (res, status, message) => {
    return res.status(status).json({
        success: false,
        message
    });
};

const enrollmentInclude = {
    course: {
        include: {
            instructor: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            },
            category: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    }
};

// ==========================================
// 1. ENROLL IN A COURSE
// POST /api/v1/courses/:courseId/enroll
// STUDENT
// ==========================================

export const enrollInCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        const studentId = req.user.id;

        if (!isValidUuid(courseId)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: {
                id: true,
                status: true
            }
        });

        if (!course) {
            return sendError(res, 404, "Course not found");
        }

        if (course.status !== "PUBLISHED") {
            return sendError(
                res,
                403,
                "This course is not available for enrollment"
            );
        }

        const existingEnrollment = await prisma.enrollment.findUnique({
            where: {
                studentId_courseId: {
                    studentId,
                    courseId
                }
            }
        });

        if (existingEnrollment?.status === "ACTIVE") {
            return sendError(
                res,
                409,
                "You are already enrolled in this course"
            );
        }

        // Reactivate the previous enrollment.
        // The existing enrollment ID is preserved, so lesson progress remains.
        if (existingEnrollment) {
            const enrollment = await prisma.enrollment.update({
                where: { id: existingEnrollment.id },
                data: {
                    status: "ACTIVE",
                    enrolledAt: new Date(),
                    cancelledAt: null
                },
                include: enrollmentInclude
            });

            return res.status(200).json({
                success: true,
                message: "Previous enrollment reactivated successfully",
                data: enrollment
            });
        }

        const enrollment = await prisma.enrollment.create({
            data: {
                studentId,
                courseId
            },
            include: enrollmentInclude
        });

        return res.status(201).json({
            success: true,
            message: "Enrolled in course successfully",
            data: enrollment
        });

    } catch (error) {
        if (error.code === "P2002") {
            return sendError(
                res,
                409,
                "You are already enrolled in this course"
            );
        }

        console.error("Enroll in course error:", error);
        return sendError(res, 500, "Failed to enroll in course");
    }
};

// ==========================================
// 2. CANCEL ENROLLMENT
// DELETE /api/v1/courses/:courseId/enroll
// STUDENT
// ==========================================

export const cancelEnrollment = async (req, res) => {
    try {
        const { courseId } = req.params;
        const studentId = req.user.id;

        if (!isValidUuid(courseId)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const enrollment = await prisma.enrollment.findUnique({
            where: {
                studentId_courseId: {
                    studentId,
                    courseId
                }
            }
        });

        if (!enrollment) {
            return sendError(res, 404, "Enrollment not found");
        }

        if (enrollment.status !== "ACTIVE") {
            return sendError(
                res,
                409,
                "No active enrollment exists"
            );
        }

        await prisma.enrollment.update({
            where: { id: enrollment.id },
            data: {
                status: "CANCELLED",
                cancelledAt: new Date()
            }
        });

        return res.status(200).json({
            success: true,
            message: "Enrollment cancelled successfully"
        });

    } catch (error) {
        console.error("Cancel enrollment error:", error);
        return sendError(res, 500, "Failed to cancel enrollment");
    }
};

// ==========================================
// 3. GET MY ENROLLED COURSES
// GET /api/v1/enrollments/my-courses
// STUDENT
// ==========================================

export const getMyEnrollments = async (req, res) => {
    try {
        const pagination = getPagination(req.query);

        if (!pagination) {
            return sendError(res, 400, "Invalid pagination parameters");
        }

        const { page, limit, skip } = pagination;
        const { status } = req.query;

        if (status && !VALID_STATUSES.includes(status)) {
            return sendError(res, 400, "Invalid enrollment status");
        }

        const where = {
            studentId: req.user.id
        };

        if (status) {
            where.status = status;
        }

        const [enrollments, total] = await Promise.all([
            prisma.enrollment.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    enrolledAt: "desc"
                },
                include: enrollmentInclude
            }),
            prisma.enrollment.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            message: "Enrolled courses retrieved successfully",
            data: enrollments,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Get my enrollments error:", error);
        return sendError(res, 500, "Failed to retrieve enrolled courses");
    }
};

// ==========================================
// 4. GET MY ENROLLMENT STATUS
// GET /api/v1/courses/:courseId/enrollment
// STUDENT
// ==========================================

export const getMyEnrollmentStatus = async (req, res) => {
    try {
        const { courseId } = req.params;

        if (!isValidUuid(courseId)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const enrollment = await prisma.enrollment.findUnique({
            where: {
                studentId_courseId: {
                    studentId: req.user.id,
                    courseId
                }
            },
            include: enrollmentInclude
        });

        if (!enrollment) {
            return sendError(res, 404, "Enrollment not found");
        }

        return res.status(200).json({
            success: true,
            message: "Enrollment status retrieved successfully",
            data: enrollment
        });

    } catch (error) {
        console.error("Get enrollment status error:", error);
        return sendError(res, 500, "Failed to retrieve enrollment status");
    }
};

// ==========================================
// 5. GET ALL PLATFORM ENROLLMENTS
// GET /api/v1/admin/enrollments
// ADMIN
// ==========================================

export const getAllEnrollments = async (req, res) => {
    try {
        const pagination = getPagination(req.query);

        if (!pagination) {
            return sendError(res, 400, "Invalid pagination parameters");
        }

        const { page, limit, skip } = pagination;
        const { status } = req.query;

        if (status && !VALID_STATUSES.includes(status)) {
            return sendError(res, 400, "Invalid enrollment status");
        }

        const where = {};

        if (status) {
            where.status = status;
        }

        const [enrollments, total] = await Promise.all([
            prisma.enrollment.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    enrolledAt: "desc"
                },
                include: {
                    ...enrollmentInclude,
                    student: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            }),
            prisma.enrollment.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            message: "Platform enrollments retrieved successfully",
            data: enrollments,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Get all enrollments error:", error);
        return sendError(res, 500, "Failed to retrieve platform enrollments");
    }
};
