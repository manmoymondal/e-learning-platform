
import { prisma } from "../config/db.js";

const VALID_DIFFICULTIES = [
    "BEGINNER",
    "INTERMEDIATE",
    "ADVANCED"
];

const VALID_STATUSES = [
    "DRAFT",
    "PUBLISHED",
    "ARCHIVED"
];

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

// ==========================================
// 1. BROWSE PUBLISHED COURSES
// GET /api/v1/courses
// PUBLIC
// ==========================================

export const getAllPublishedCourses = async (req, res) => {
    try {
        const pagination = getPagination(req.query);

        if (!pagination) {
            return sendError(res, 400, "Invalid pagination parameters");
        }

        const { page, limit, skip } = pagination;
        const { search, categoryId, difficulty } = req.query;

        if (categoryId && !isValidUuid(categoryId)) {
            return sendError(res, 400, "Invalid category ID");
        }

        if (difficulty && !VALID_DIFFICULTIES.includes(difficulty)) {
            return sendError(res, 400, "Invalid difficulty");
        }

        const where = {
            status: "PUBLISHED"
        };

        if (search && search.trim()) {
            where.OR = [
                {
                    title: {
                        contains: search.trim(),
                        mode: "insensitive"
                    }
                },
                {
                    description: {
                        contains: search.trim(),
                        mode: "insensitive"
                    }
                }
            ];
        }

        if (categoryId) {
            where.categoryId = categoryId;
        }

        if (difficulty) {
            where.difficulty = difficulty;
        }

        const [courses, total] = await Promise.all([
            prisma.course.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc"
                },
                include: {
                    instructor: {
                        select: {
                            id: true,
                            name: true,
                            instructorProfile: {
                                select: {
                                    bio: true,
                                    expertise: true,
                                    profilePicture: true
                                }
                            }
                        }
                    },
                    category: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    _count: {
                        select: {
                            enrollments: {
                                where: {
                                    status: "ACTIVE"
                                }
                            }
                        }
                    }
                }
            }),
            prisma.course.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            message: "Published courses retrieved successfully",
            data: courses,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Get published courses error:", error);

        return sendError(res, 500, "Failed to retrieve courses");
    }
};

// ==========================================
// 2. CREATE COURSE
// POST /api/v1/courses
// INSTRUCTOR
// ==========================================

export const createCourse = async (req, res) => {
    try {
        const {
            title,
            description,
            thumbnail,
            categoryId,
            difficulty
        } = req.body;

        if (
            typeof title !== "string" ||
            title.trim().length < 3 ||
            title.trim().length > 200 ||
            typeof description !== "string" ||
            !description.trim() ||
            typeof categoryId !== "string" ||
            typeof difficulty !== "string"
        ) {
            return sendError(
                res,
                400,
                "Title, description, categoryId and difficulty are required"
            );
        }

        if (!isValidUuid(categoryId)) {
            return sendError(res, 400, "Invalid category ID");
        }

        if (!VALID_DIFFICULTIES.includes(difficulty)) {
            return sendError(res, 400, "Invalid difficulty");
        }

        if (
            thumbnail !== undefined &&
            thumbnail !== null &&
            (typeof thumbnail !== "string" || thumbnail.trim().length === 0)
        ) {
            return sendError(res, 400, "Thumbnail must be a valid string or null");
        }

        const category = await prisma.category.findUnique({
            where: {
                id: categoryId
            }
        });

        if (!category) {
            return sendError(res, 404, "Category not found");
        }

        const course = await prisma.course.create({
            data: {
                title: title.trim(),
                description: description.trim(),
                thumbnail: thumbnail?.trim() || null,
                categoryId,
                instructorId: req.user.id,
                difficulty,
                status: "DRAFT"
            },
            include: {
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
                }
            }
        });

        return res.status(201).json({
            success: true,
            message: "Course created successfully",
            data: course
        });

    } catch (error) {
        console.error("Create course error:", error);

        return sendError(res, 500, "Failed to create course");
    }
};

// ==========================================
// 3. GET PUBLISHED COURSE DETAILS
// GET /api/v1/courses/:courseId
// PUBLIC
// ==========================================

export const getPublishedCourseById = async (req, res) => {
    try {
        const { courseId } = req.params;

        if (!isValidUuid(courseId)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const course = await prisma.course.findFirst({
            where: {
                id: courseId,
                status: "PUBLISHED"
            },
            include: {
                instructor: {
                    select: {
                        id: true,
                        name: true,
                        instructorProfile: {
                            select: {
                                bio: true,
                                expertise: true,
                                experience: true,
                                profilePicture: true
                            }
                        }
                    }
                },
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                modules: {
                    orderBy: {
                        position: "asc"
                    },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        position: true,
                        lessons: {
                            orderBy: {
                                position: "asc"
                            },
                            select: {
                                id: true,
                                title: true,
                                description: true,
                                duration: true,
                                position: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        enrollments: {
                            where: {
                                status: "ACTIVE"
                            }
                        }
                    }
                }
            }
        });

        if (!course) {
            return sendError(res, 404, "Published course not found");
        }

        return res.status(200).json({
            success: true,
            message: "Course retrieved successfully",
            data: course
        });

    } catch (error) {
        console.error("Get published course error:", error);

        return sendError(res, 500, "Failed to retrieve course");
    }
};

// ==========================================
// 4. UPDATE DRAFT COURSE
// PATCH /api/v1/courses/:courseId
// COURSE OWNER ONLY
// ==========================================

export const updateCourse = async (req, res) => {
    try {
        const { courseId } = req.params;

        if (!isValidUuid(courseId)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const allowedFields = [
            "title",
            "description",
            "thumbnail",
            "categoryId",
            "difficulty"
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return sendError(res, 400, "No valid fields provided for update");
        }

        if (
            updates.title !== undefined &&
            (
                typeof updates.title !== "string" ||
                updates.title.trim().length < 3 ||
                updates.title.trim().length > 200
            )
        ) {
            return sendError(res, 400, "Title must contain between 3 and 200 characters");
        }

        if (
            updates.description !== undefined &&
            (
                typeof updates.description !== "string" ||
                !updates.description.trim()
            )
        ) {
            return sendError(res, 400, "Description must be a non-empty string");
        }

        if (
            updates.thumbnail !== undefined &&
            updates.thumbnail !== null &&
            (
                typeof updates.thumbnail !== "string" ||
                !updates.thumbnail.trim()
            )
        ) {
            return sendError(res, 400, "Thumbnail must be a valid string or null");
        }

        if (
            updates.difficulty !== undefined &&
            !VALID_DIFFICULTIES.includes(updates.difficulty)
        ) {
            return sendError(res, 400, "Invalid difficulty");
        }

        if (updates.categoryId !== undefined) {
            if (!isValidUuid(updates.categoryId)) {
                return sendError(res, 400, "Invalid category ID");
            }

            const category = await prisma.category.findUnique({
                where: {
                    id: updates.categoryId
                }
            });

            if (!category) {
                return sendError(res, 404, "Category not found");
            }
        }

        if (updates.title !== undefined) {
            updates.title = updates.title.trim();
        }

        if (updates.description !== undefined) {
            updates.description = updates.description.trim();
        }

        if (updates.thumbnail !== undefined && updates.thumbnail !== null) {
            updates.thumbnail = updates.thumbnail.trim();
        }

        const existingCourse = await prisma.course.findUnique({
            where: {
                id: courseId
            }
        });

        if (!existingCourse) {
            return sendError(res, 404, "Course not found");
        }

        if (existingCourse.instructorId !== req.user.id) {
            return sendError(res, 403, "You do not own this course");
        }

        if (existingCourse.status !== "DRAFT") {
            return sendError(
                res,
                409,
                "Only draft courses can be updated directly. Use course revisions for published courses."
            );
        }

        const course = await prisma.course.update({
            where: {
                id: courseId
            },
            data: updates,
            include: {
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
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: "Course updated successfully",
            data: course
        });

    } catch (error) {
        console.error("Update course error:", error);

        return sendError(res, 500, "Failed to update course");
    }
};

// ==========================================
// 5. DELETE COURSE
// DELETE /api/v1/courses/:courseId
// OWNER OR ADMIN
// ==========================================

export const deleteCourse = async (req, res) => {
    try {
        const { courseId } = req.params;

        if (!isValidUuid(courseId)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const course = await prisma.course.findUnique({
            where: {
                id: courseId
            },
            select: {
                id: true,
                instructorId: true
            }
        });

        if (!course) {
            return sendError(res, 404, "Course not found");
        }

        if (
            req.user.role !== "ADMIN" &&
            course.instructorId !== req.user.id
        ) {
            return sendError(res, 403, "You do not own this course");
        }

        await prisma.course.delete({
            where: {
                id: courseId
            }
        });

        return res.status(200).json({
            success: true,
            message: "Course deleted successfully"
        });

    } catch (error) {
        console.error("Delete course error:", error);

        return sendError(res, 500, "Failed to delete course");
    }
};

// ==========================================
// 6. GET MY COURSES
// GET /api/v1/instructor/courses
// INSTRUCTOR
// ==========================================

export const getMyCourses = async (req, res) => {
    try {
        const pagination = getPagination(req.query);

        if (!pagination) {
            return sendError(res, 400, "Invalid pagination parameters");
        }

        const { page, limit, skip } = pagination;

        const where = {
            instructorId: req.user.id
        };

        const [courses, total] = await Promise.all([
            prisma.course.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc"
                },
                include: {
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
                    _count: {
                        select: {
                            enrollments: {
                                where: {
                                    status: "ACTIVE"
                                }
                            },
                            modules: true
                        }
                    }
                }
            }),
            prisma.course.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            message: "Your courses retrieved successfully",
            data: courses,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Get instructor courses error:", error);

        return sendError(res, 500, "Failed to retrieve your courses");
    }
};

// ==========================================
// 7. GET MY COURSE DETAILS
// GET /api/v1/instructor/courses/:courseId
// COURSE OWNER ONLY
// ==========================================

export const getMyCourseDetails = async (req, res) => {
    try {
        const { courseId } = req.params;

        if (!isValidUuid(courseId)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const course = await prisma.course.findUnique({
            where: {
                id: courseId
            },
            include: {
                instructor: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                category: true,
                modules: {
                    orderBy: {
                        position: "asc"
                    },
                    include: {
                        lessons: {
                            orderBy: {
                                position: "asc"
                            },
                            include: {
                                materials: true
                            }
                        }
                    }
                },
                revisions: {
                    orderBy: {
                        submittedAt: "desc"
                    },
                    take: 1
                },
                _count: {
                    select: {
                        enrollments: {
                            where: {
                                status: "ACTIVE"
                            }
                        }
                    }
                }
            }
        });

        if (!course) {
            return sendError(res, 404, "Course not found");
        }

        if (course.instructorId !== req.user.id) {
            return sendError(res, 403, "You do not own this course");
        }

        const latestRevision = course.revisions[0] || null;

        const { revisions, ...courseData } = course;

        return res.status(200).json({
            success: true,
            message: "Your course details retrieved successfully",
            data: {
                ...courseData,
                latestRevision
            }
        });

    } catch (error) {
        console.error("Get instructor course details error:", error);

        return sendError(res, 500, "Failed to retrieve course details");
    }
};

// ==========================================
// 8. GET PUBLIC COURSE CURRICULUM
// GET /api/v1/courses/:courseId/modules
// PUBLIC
// ==========================================

export const getCourseCurriculum = async (req, res) => {
    try {
        const { courseId } = req.params;

        if (!isValidUuid(courseId)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const course = await prisma.course.findFirst({
            where: {
                id: courseId,
                status: "PUBLISHED"
            },
            select: {
                modules: {
                    orderBy: {
                        position: "asc"
                    },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        position: true,
                        lessons: {
                            orderBy: {
                                position: "asc"
                            },
                            select: {
                                id: true,
                                title: true,
                                description: true,
                                position: true,
                                duration: true
                            }
                        }
                    }
                }
            }
        });

        if (!course) {
            return sendError(res, 404, "Published course not found");
        }

        return res.status(200).json({
            success: true,
            message: "Course curriculum retrieved successfully",
            data: course.modules
        });

    } catch (error) {
        console.error("Get course curriculum error:", error);

        return sendError(res, 500, "Failed to retrieve course curriculum");
    }
};

// ==========================================
// 9. GET ENROLLED STUDENTS
// GET /api/v1/courses/:courseId/students
// COURSE OWNER OR ADMIN
// ==========================================

export const getCourseStudents = async (req, res) => {
    try {
        const { courseId } = req.params;

        if (!isValidUuid(courseId)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const pagination = getPagination(req.query);

        if (!pagination) {
            return sendError(res, 400, "Invalid pagination parameters");
        }

        const course = await prisma.course.findUnique({
            where: {
                id: courseId
            },
            select: {
                id: true,
                instructorId: true
            }
        });

        if (!course) {
            return sendError(res, 404, "Course not found");
        }

        if (
            req.user.role !== "ADMIN" &&
            course.instructorId !== req.user.id
        ) {
            return sendError(res, 403, "You do not own this course");
        }

        const { page, limit, skip } = pagination;

        const where = {
            courseId,
            status: "ACTIVE"
        };

        const [enrollments, total] = await Promise.all([
            prisma.enrollment.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    enrolledAt: "desc"
                },
                include: {
                    student: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                            isActive: true,
                            studentProfile: true
                        }
                    }
                }
            }),
            prisma.enrollment.count({ where })
        ]);

        const students = enrollments.map((enrollment) => ({
            ...enrollment.student,
            enrolledAt: enrollment.enrolledAt
        }));

        return res.status(200).json({
            success: true,
            message: "Enrolled students retrieved successfully",
            data: {
                users: students,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error("Get course students error:", error);

        return sendError(res, 500, "Failed to retrieve enrolled students");
    }
};

// ==========================================
// 10. ADMIN: GET ALL COURSES
// GET /api/v1/admin/courses
// ADMIN
// ==========================================

export const getAllCoursesForAdmin = async (req, res) => {
    try {
        const pagination = getPagination(req.query);

        if (!pagination) {
            return sendError(res, 400, "Invalid pagination parameters");
        }

        const { page, limit, skip } = pagination;
        const { status } = req.query;

        if (status && !VALID_STATUSES.includes(status)) {
            return sendError(res, 400, "Invalid course status");
        }

        const where = {};

        if (status) {
            where.status = status;
        }

        const [courses, total] = await Promise.all([
            prisma.course.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc"
                },
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
                    },
                    _count: {
                        select: {
                            enrollments: {
                                where: {
                                    status: "ACTIVE"
                                }
                            },
                            modules: true
                        }
                    }
                }
            }),
            prisma.course.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            message: "Courses retrieved successfully",
            data: courses,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Admin get courses error:", error);

        return sendError(res, 500, "Failed to retrieve courses");
    }
};


// ==========================================
// 11. ADMIN: PUBLISH COURSE
// PATCH /api/v1/admin/courses/:courseId/publish
// ADMIN
// ==========================================

export const publishCourse = async (req, res) => {
    try {
        const { courseId } = req.params;

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

        if (course.status !== "DRAFT") {
            return sendError(
                res,
                409,
                "Only draft courses can be published"
            );
        }

        // Only consider revisions that have actually been submitted.
        const latestSubmittedRevision = await prisma.courseRevision.findFirst({
            where: {
                courseId,
                submittedAt: {
                    not: null
                }
            },
            orderBy: [
                { submittedAt: "desc" },
                { createdAt: "desc" }
            ],
            select: {
                id: true,
                status: true
            }
        });

        if (!latestSubmittedRevision) {
            return sendError(
                res,
                409,
                "Course must have a submitted and approved revision before publishing"
            );
        }

        if (latestSubmittedRevision.status !== "APPROVED") {
            return sendError(
                res,
                409,
                "The latest submitted revision must be approved before publishing"
            );
        }

        // Update only if the course is still a draft.
        const result = await prisma.course.updateMany({
            where: {
                id: courseId,
                status: "DRAFT"
            },
            data: {
                status: "PUBLISHED",
                publishedAt: new Date()
            }
        });

        if (result.count === 0) {
            return sendError(
                res,
                409,
                "Course is no longer in draft status"
            );
        }

        const publishedCourse = await prisma.course.findUnique({
            where: { id: courseId },
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
        });

        return res.status(200).json({
            success: true,
            message: "Course published successfully",
            data: publishedCourse
        });

    } catch (error) {
        console.error("Publish course error:", error);

        return sendError(res, 500, "Failed to publish course");
    }
};
