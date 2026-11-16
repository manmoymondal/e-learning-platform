import { prisma } from "../config/db.js";

const isValidUUID = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const badId = (res) =>
    res.status(400).json({
        success: false,
        message: "Invalid ID format"
    });

const serverError = (res, error) => {
    console.error("Learning API error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
};

// GET /lessons/:lessonId
export const getLessonDetails = async (req, res) => {
    try {
        const { lessonId } = req.params;

        if (!isValidUUID(lessonId)) return badId(res);

        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                module: {
                    include: {
                        course: {
                            select: {
                                id: true,
                                instructorId: true
                            }
                        }
                    }
                },
                materials: {
                    orderBy: { createdAt: "asc" }
                }
            }
        });

        if (!lesson) {
            return res.status(404).json({
                success: false,
                message: "Lesson not found"
            });
        }

        const { role, id: userId } = req.user;
        const course = lesson.module.course;

        if (role === "INSTRUCTOR" && course.instructorId !== userId) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to access this lesson"
            });
        }

        if (role === "STUDENT") {
            const enrollment = await prisma.enrollment.findFirst({
                where: {
                    studentId: userId,
                    courseId: course.id,
                    status: "ACTIVE"
                }
            });

            if (!enrollment) {
                return res.status(403).json({
                    success: false,
                    message: "Active enrollment is required to access this lesson"
                });
            }
        } else if (role !== "ADMIN" && role !== "INSTRUCTOR") {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to access this lesson"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lesson details retrieved successfully",
            data: {
                id: lesson.id,
                title: lesson.title,
                description: lesson.description,
                position: lesson.position,
                duration: lesson.duration,
                video: lesson.videoType && lesson.videoUrl
                    ? {
                        type: lesson.videoType,
                        url: lesson.videoUrl
                    }
                    : null,
                materials: lesson.materials.map((material) => ({
                    id: material.id,
                    title: material.title,
                    fileUrl: material.fileUrl,
                    originalFilename: material.originalFilename,
                    fileSize: material.fileSize === null
                        ? null
                        : Number(material.fileSize),
                    mimeType: material.mimeType
                }))
            }
        });
    } catch (error) {
        return serverError(res, error);
    }
};

// GET /lessons/:lessonId/progress
export const getLessonProgress = async (req, res) => {
    try {
        const { lessonId } = req.params;

        if (!isValidUUID(lessonId)) return badId(res);

        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            select: {
                id: true,
                module: {
                    select: {
                        courseId: true
                    }
                }
            }
        });

        if (!lesson) {
            return res.status(404).json({
                success: false,
                message: "Lesson not found"
            });
        }

        const enrollment = await prisma.enrollment.findFirst({
            where: {
                studentId: req.user.id,
                courseId: lesson.module.courseId,
                status: "ACTIVE"
            }
        });

        if (!enrollment) {
            return res.status(403).json({
                success: false,
                message: "Active enrollment is required to access lesson progress"
            });
        }

        const progress = await prisma.lessonProgress.findUnique({
            where: {
                enrollmentId_lessonId: {
                    enrollmentId: enrollment.id,
                    lessonId
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: "Lesson progress retrieved successfully",
            data: {
                lessonId,
                isCompleted: progress?.isCompleted ?? false,
                completedAt: progress?.completedAt ?? null
            }
        });
    } catch (error) {
        return serverError(res, error);
    }
};

// PATCH /lessons/:lessonId/progress
export const updateLessonProgress = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const { isCompleted } = req.body;

        if (!isValidUUID(lessonId)) return badId(res);

        if (typeof isCompleted !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "isCompleted must be a boolean"
            });
        }

        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            select: {
                id: true,
                module: {
                    select: {
                        courseId: true
                    }
                }
            }
        });

        if (!lesson) {
            return res.status(404).json({
                success: false,
                message: "Lesson not found"
            });
        }

        const enrollment = await prisma.enrollment.findFirst({
            where: {
                studentId: req.user.id,
                courseId: lesson.module.courseId,
                status: "ACTIVE"
            }
        });

        if (!enrollment) {
            return res.status(403).json({
                success: false,
                message: "Active enrollment is required to update lesson progress"
            });
        }

        const completedAt = isCompleted ? new Date() : null;

        const progress = await prisma.lessonProgress.upsert({
            where: {
                enrollmentId_lessonId: {
                    enrollmentId: enrollment.id,
                    lessonId
                }
            },
            update: {
                isCompleted,
                completedAt
            },
            create: {
                enrollmentId: enrollment.id,
                lessonId,
                isCompleted,
                completedAt
            }
        });

        return res.status(200).json({
            success: true,
            message: "Lesson progress updated successfully",
            data: {
                lessonId: progress.lessonId,
                isCompleted: progress.isCompleted,
                completedAt: progress.completedAt
            }
        });
    } catch (error) {
        return serverError(res, error);
    }
};

// GET /courses/:courseId/progress
export const getCourseProgress = async (req, res) => {
    try {
        const { courseId } = req.params;

        if (!isValidUUID(courseId)) return badId(res);

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: { id: true }
        });

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        const enrollment = await prisma.enrollment.findFirst({
            where: {
                studentId: req.user.id,
                courseId,
                status: "ACTIVE"
            }
        });

        if (!enrollment) {
            return res.status(403).json({
                success: false,
                message: "Active enrollment is required to access course progress"
            });
        }

        const totalLessons = await prisma.lesson.count({
            where: {
                module: { courseId }
            }
        });

        const completedLessons = await prisma.lessonProgress.count({
            where: {
                enrollmentId: enrollment.id,
                isCompleted: true,
                lesson: {
                    module: { courseId }
                }
            }
        });

        const progressPercentage = totalLessons === 0
            ? 0
            : Number(((completedLessons / totalLessons) * 100).toFixed(2));

        return res.status(200).json({
            success: true,
            message: "Course progress retrieved successfully",
            data: {
                courseId,
                totalLessons,
                completedLessons,
                progressPercentage
            }
        });
    } catch (error) {
        return serverError(res, error);
    }
};
