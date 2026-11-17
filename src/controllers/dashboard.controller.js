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
