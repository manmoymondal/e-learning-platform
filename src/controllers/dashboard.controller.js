import { prisma } from "../config/db.js";

// GET /student/dashboard
export const getStudentDashboard = async (req, res) => {
    try {
        const enrollments = await prisma.enrollment.findMany({
            where: {
                studentId: req.user.id,
                status: "ACTIVE"
            },
            orderBy: {
                enrolledAt: "desc"
            },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        thumbnail: true,
                        difficulty: true,
                        status: true,
                        publishedAt: true,
                        instructor: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        category: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        modules: {
                            select: {
                                lessons: {
                                    select: {
                                        id: true
                                    }
                                }
                            }
                        }
                    }
                },
                progress: {
                    where: {
                        isCompleted: true
                    },
                    select: {
                        lessonId: true
                    }
                }
            }
        });

        const dashboardEnrollments = enrollments.map((enrollment) => {
            const { modules, ...course } = enrollment.course;

            const lessonIds = modules.flatMap((module) =>
                module.lessons.map((lesson) => lesson.id)
            );

            const completedLessonIds = new Set(
                enrollment.progress.map((item) => item.lessonId)
            );

            const totalLessons = lessonIds.length;
            const completedLessons = lessonIds.filter((id) =>
                completedLessonIds.has(id)
            ).length;

            const progressPercentage = totalLessons === 0
                ? 0
                : Number(
                    ((completedLessons / totalLessons) * 100).toFixed(2)
                );

            return {
                id: enrollment.id,
                course,
                status: enrollment.status,
                enrolledAt: enrollment.enrolledAt,
                cancelledAt: enrollment.cancelledAt,
                progress: {
                    totalLessons,
                    completedLessons,
                    progressPercentage
                }
            };
        });

        const completedCourses = dashboardEnrollments.filter(
            (enrollment) =>
                enrollment.progress.totalLessons > 0 &&
                enrollment.progress.completedLessons ===
                    enrollment.progress.totalLessons
        ).length;

        return res.status(200).json({
            success: true,
            message: "Student dashboard retrieved successfully",
            data: {
                enrolledCourses: enrollments.length,
                completedCourses,
                recentCourses: dashboardEnrollments.slice(0, 5)
            }
        });
    } catch (error) {
        console.error("Student dashboard error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// GET /instructor/dashboard
export const getInstructorDashboard = async (req, res) => {
    try {
        const instructorId = req.user.id;

        const [
            totalCourses,
            publishedCourses,
            pendingCourses,
            activeStudents,
            courses
        ] = await Promise.all([
            prisma.course.count({
                where: {
                    instructorId
                }
            }),

            prisma.course.count({
                where: {
                    instructorId,
                    status: "PUBLISHED"
                }
            }),

            prisma.course.count({
                where: {
                    instructorId,
                    revisions: {
                        some: {
                            status: "PENDING"
                        }
                    }
                }
            }),

            prisma.enrollment.findMany({
                where: {
                    status: "ACTIVE",
                    course: {
                        instructorId
                    }
                },
                distinct: ["studentId"],
                select: {
                    studentId: true
                }
            }),

            prisma.course.findMany({
                where: {
                    instructorId
                },
                orderBy: {
                    createdAt: "desc"
                },
                take: 5,
                select: {
                    id: true,
                    title: true,
                    description: true,
                    thumbnail: true,
                    difficulty: true,
                    status: true,
                    publishedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    instructor: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                            isActive: true,
                            createdAt: true
                        }
                    },
                    category: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            createdAt: true
                        }
                    }
                }
            })
        ]);

        return res.status(200).json({
            success: true,
            message: "Instructor dashboard retrieved successfully",
            data: {
                totalCourses,
                publishedCourses,
                pendingCourses,
                totalStudents: activeStudents.length,
                courses
            }
        });
    } catch (error) {
        console.error("Instructor dashboard error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

/**
 * GET /instructor/students
 * Returns unique students with active enrollments in this instructor's courses.
 */
export const getInstructorStudents = async (req, res) => {
    try {
        const page = req.query.page === undefined
            ? 1
            : Number(req.query.page);

        const limit = req.query.limit === undefined
            ? 10
            : Number(req.query.limit);

        if (
            !Number.isInteger(page) ||
            !Number.isInteger(limit) ||
            page < 1 ||
            limit < 1 ||
            limit > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid pagination parameters"
            });
        }

        const where = {
            role: "STUDENT",
            enrollments: {
                some: {
                    status: "ACTIVE",
                    course: {
                        is: {
                            instructorId: req.user.id
                        }
                    }
                }
            }
        };

        const [students, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    createdAt: "desc"
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isActive: true,
                    createdAt: true
                }
            }),

            prisma.user.count({
                where
            })
        ]);

        return res.status(200).json({
            success: true,
            message: "Instructor students retrieved successfully",
            data: students,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Get instructor students error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve instructor students"
        });
    }
};

