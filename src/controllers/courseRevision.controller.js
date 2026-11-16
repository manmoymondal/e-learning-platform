
import { prisma } from "../config/db.js";

const VALID_DIFFICULTIES = [
    "BEGINNER",
    "INTERMEDIATE",
    "ADVANCED"
];

const VALID_REVISION_STATUSES = [
    "DRAFT",
    "PENDING",
    "APPROVED",
    "REJECTED"
];

const isValidUuid = (id) => {
    return typeof id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

const sendError = (res, status, message) => {
    return res.status(status).json({
        success: false,
        message
    });
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

// ==========================================
// CHECK COURSE ACCESS
// ==========================================

const getAccessibleCourse = async (courseId, user) => {
    const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: {
            id: true,
            instructorId: true
        }
    });

    if (!course) {
        return { error: "NOT_FOUND" };
    }

    if (
        user.role !== "ADMIN" &&
        course.instructorId !== user.id
    ) {
        return { error: "FORBIDDEN" };
    }

    return { course };
};

// ==========================================
// BUILD INITIAL SNAPSHOT
// ==========================================

const buildInitialSnapshot = async (course) => {
    const fileUrls = [];

    if (course.thumbnail) {
        fileUrls.push(course.thumbnail);
    }

    for (const module of course.modules) {
        for (const lesson of module.lessons) {
            if (
                lesson.videoType === "UPLOAD" &&
                lesson.videoUrl
            ) {
                fileUrls.push(lesson.videoUrl);
            }

            for (const material of lesson.materials) {
                fileUrls.push(material.fileUrl);
            }
        }
    }

    const assets = await prisma.asset.findMany({
        where: {
            fileUrl: {
                in: [...new Set(fileUrls)]
            }
        }
    });

    const assetByUrl = new Map(
        assets.map((asset) => [asset.fileUrl, asset])
    );

    let thumbnailAssetId = null;

    if (course.thumbnail) {
        const asset = assetByUrl.get(course.thumbnail);

        if (!asset || asset.assetType !== "THUMBNAIL") {
            return {
                error: "The existing course thumbnail has no matching THUMBNAIL asset record. Please upload it again."
            };
        }

        thumbnailAssetId = asset.id;
    }

    const modules = [];

    for (const module of course.modules) {
        const lessons = [];

        for (const lesson of module.lessons) {
            let video;

            if (lesson.videoType === "YOUTUBE" && lesson.videoUrl) {
                video = {
                    type: "YOUTUBE",
                    url: lesson.videoUrl
                };
            } else if (
                lesson.videoType === "UPLOAD" &&
                lesson.videoUrl
            ) {
                const asset = assetByUrl.get(lesson.videoUrl);

                if (!asset || asset.assetType !== "VIDEO") {
                    return {
                        error: `Uploaded video for lesson "${lesson.title}" has no matching VIDEO asset record.`
                    };
                }

                video = {
                    type: "UPLOAD",
                    assetId: asset.id
                };
            }

            const materials = [];

            for (const material of lesson.materials) {
                const asset = assetByUrl.get(material.fileUrl);

                if (!asset || asset.assetType !== "PDF") {
                    return {
                        error: `Material "${material.title}" has no matching PDF asset record.`
                    };
                }

                materials.push({
                    assetId: asset.id,
                    title: material.title
                });
            }

            lessons.push({
                clientId: lesson.id,
                title: lesson.title,
                description: lesson.description,
                position: lesson.position,
                duration: lesson.duration,
                ...(video ? { video } : {}),
                materials
            });
        }

        modules.push({
            clientId: module.id,
            title: module.title,
            description: module.description,
            position: module.position,
            lessons
        });
    }

    return {
        snapshot: {
            title: course.title,
            description: course.description,
            categoryId: course.categoryId,
            difficulty: course.difficulty,
            thumbnailAssetId,
            modules
        }
    };
};

// ==========================================
// VALIDATE REVISION SNAPSHOT
// ==========================================

const validateSnapshot = async (snapshot) => {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
        return { error: "Invalid revision content" };
    }

    if (
        typeof snapshot.title !== "string" ||
        snapshot.title.trim().length < 3 ||
        snapshot.title.trim().length > 200
    ) {
        return { error: "Title must contain between 3 and 200 characters" };
    }

    if (
        typeof snapshot.description !== "string" ||
        !snapshot.description.trim()
    ) {
        return { error: "Description must be a non-empty string" };
    }

    if (!isValidUuid(snapshot.categoryId)) {
        return { error: "Invalid category ID" };
    }

    if (!VALID_DIFFICULTIES.includes(snapshot.difficulty)) {
        return { error: "Invalid difficulty" };
    }

    if (
        snapshot.thumbnailAssetId !== undefined &&
        snapshot.thumbnailAssetId !== null &&
        !isValidUuid(snapshot.thumbnailAssetId)
    ) {
        return { error: "Invalid thumbnail asset ID" };
    }

    if (!Array.isArray(snapshot.modules)) {
        return { error: "Modules must be an array" };
    }

    const category = await prisma.category.findUnique({
        where: { id: snapshot.categoryId },
        select: { id: true }
    });

    if (!category) {
        return { error: "Category not found" };
    }

    const assetIds = [];

    if (snapshot.thumbnailAssetId) {
        assetIds.push(snapshot.thumbnailAssetId);
    }

    const moduleClientIds = new Set();
    const modulePositions = new Set();

    for (const module of snapshot.modules) {
        if (
            !module ||
            typeof module.clientId !== "string" ||
            !module.clientId.trim() ||
            moduleClientIds.has(module.clientId) ||
            typeof module.title !== "string" ||
            !module.title.trim() ||
            !Number.isInteger(module.position) ||
            module.position < 1 ||
            modulePositions.has(module.position) ||
            !Array.isArray(module.lessons)
        ) {
            return {
                error: "Invalid module data. Check clientId, title, position and lessons."
            };
        }

        moduleClientIds.add(module.clientId);
        modulePositions.add(module.position);

        if (
            module.description !== undefined &&
            module.description !== null &&
            typeof module.description !== "string"
        ) {
            return { error: "Invalid module description" };
        }

        const lessonClientIds = new Set();
        const lessonPositions = new Set();

        for (const lesson of module.lessons) {
            if (
                !lesson ||
                typeof lesson.clientId !== "string" ||
                !lesson.clientId.trim() ||
                lessonClientIds.has(lesson.clientId) ||
                typeof lesson.title !== "string" ||
                !lesson.title.trim() ||
                !Number.isInteger(lesson.position) ||
                lesson.position < 1 ||
                lessonPositions.has(lesson.position)
            ) {
                return {
                    error: "Invalid lesson data. Check clientId, title and position."
                };
            }

            lessonClientIds.add(lesson.clientId);
            lessonPositions.add(lesson.position);

            if (
                lesson.description !== undefined &&
                lesson.description !== null &&
                typeof lesson.description !== "string"
            ) {
                return { error: "Invalid lesson description" };
            }

            if (
                lesson.duration !== undefined &&
                lesson.duration !== null &&
                (!Number.isInteger(lesson.duration) || lesson.duration < 0)
            ) {
                return { error: "Lesson duration must be a non-negative integer or null" };
            }

            if (lesson.video !== undefined) {
                if (
                    !lesson.video ||
                    typeof lesson.video !== "object"
                ) {
                    return { error: "Invalid lesson video" };
                }

                if (lesson.video.type === "YOUTUBE") {
                    if (
                        typeof lesson.video.url !== "string" ||
                        !URL.canParse(lesson.video.url)
                    ) {
                        return { error: "Invalid YouTube video URL" };
                    }
                } else if (lesson.video.type === "UPLOAD") {
                    if (!isValidUuid(lesson.video.assetId)) {
                        return { error: "Invalid uploaded video asset ID" };
                    }

                    assetIds.push(lesson.video.assetId);
                } else {
                    return { error: "Video type must be YOUTUBE or UPLOAD" };
                }
            }

            if (
                lesson.materials !== undefined &&
                !Array.isArray(lesson.materials)
            ) {
                return { error: "Lesson materials must be an array" };
            }

            for (const material of lesson.materials || []) {
                if (
                    !material ||
                    !isValidUuid(material.assetId) ||
                    typeof material.title !== "string" ||
                    !material.title.trim() ||
                    material.title.length > 150
                ) {
                    return { error: "Invalid material data" };
                }

                assetIds.push(material.assetId);
            }
        }
    }

    const uniqueAssetIds = [...new Set(assetIds)];

    const assets = await prisma.asset.findMany({
        where: {
            id: {
                in: uniqueAssetIds
            }
        }
    });

    const assetMap = new Map(
        assets.map((asset) => [asset.id, asset])
    );

    if (snapshot.thumbnailAssetId) {
        const asset = assetMap.get(snapshot.thumbnailAssetId);

        if (!asset || asset.assetType !== "THUMBNAIL") {
            return { error: "Thumbnail asset not found or invalid asset type" };
        }
    }

    for (const module of snapshot.modules) {
        for (const lesson of module.lessons) {
            if (lesson.video?.type === "UPLOAD") {
                const asset = assetMap.get(lesson.video.assetId);

                if (!asset || asset.assetType !== "VIDEO") {
                    return { error: "Video asset not found or invalid asset type" };
                }
            }

            for (const material of lesson.materials || []) {
                const asset = assetMap.get(material.assetId);

                if (!asset || asset.assetType !== "PDF") {
                    return { error: "PDF asset not found or invalid asset type" };
                }
            }
        }
    }

    return { assets: assetMap };
};

// ==========================================
// APPLY SNAPSHOT TO COURSE
// ==========================================


const applySnapshot = async (tx, courseId, snapshot, assetMap) => {
    const thumbnail = snapshot.thumbnailAssetId
        ? assetMap.get(snapshot.thumbnailAssetId).fileUrl
        : null;

    // Update course information.
    await tx.course.update({
        where: { id: courseId },
        data: {
            title: snapshot.title.trim(),
            description: snapshot.description.trim(),
            categoryId: snapshot.categoryId,
            difficulty: snapshot.difficulty,
            thumbnail
        }
    });

    // Fetch existing modules and lessons.
    const existingModules = await tx.module.findMany({
        where: { courseId },
        include: {
            lessons: true
        }
    });

    const moduleMap = new Map(
        existingModules.map((module) => [module.id, module])
    );

    const existingLessons = existingModules.flatMap(
        (module) => module.lessons
    );

    const lessonMap = new Map(
        existingLessons.map((lesson) => [lesson.id, lesson])
    );

    // Existing database IDs are preserved when supplied as clientId.
    const retainedModuleIds = new Set(
        snapshot.modules
            .filter((module) => moduleMap.has(module.clientId))
            .map((module) => module.clientId)
    );

    const retainedLessonIds = new Set(
        snapshot.modules.flatMap((module) =>
            module.lessons
                .filter((lesson) => lessonMap.has(lesson.clientId))
                .map((lesson) => lesson.clientId)
        )
    );

    // Move existing positions temporarily to avoid unique-position
    // conflicts when modules or lessons are reordered.
    for (let i = 0; i < existingModules.length; i++) {
        await tx.module.update({
            where: { id: existingModules[i].id },
            data: { position: -(i + 1) }
        });
    }

    for (let i = 0; i < existingLessons.length; i++) {
        await tx.lesson.update({
            where: { id: existingLessons[i].id },
            data: { position: -(i + 1) }
        });
    }

    // Delete only lessons removed from the new snapshot.
    const existingModuleIds = existingModules.map(
        (module) => module.id
    );

    if (existingModuleIds.length > 0) {
        if (retainedLessonIds.size > 0) {
            await tx.lesson.deleteMany({
                where: {
                    moduleId: { in: existingModuleIds },
                    id: {
                        notIn: [...retainedLessonIds]
                    }
                }
            });
        } else {
            await tx.lesson.deleteMany({
                where: {
                    moduleId: { in: existingModuleIds }
                }
            });
        }
    }

    // Reconcile modules and lessons.
    for (const module of snapshot.modules) {
        let moduleId;

        if (moduleMap.has(module.clientId)) {
            const updatedModule = await tx.module.update({
                where: { id: module.clientId },
                data: {
                    title: module.title.trim(),
                    description: module.description?.trim() || null,
                    position: module.position
                }
            });

            moduleId = updatedModule.id;
        } else {
            const createdModule = await tx.module.create({
                data: {
                    courseId,
                    title: module.title.trim(),
                    description: module.description?.trim() || null,
                    position: module.position
                }
            });

            moduleId = createdModule.id;
        }

        for (const lesson of module.lessons) {
            let lessonId;

            let videoType = null;
            let videoUrl = null;

            if (lesson.video?.type === "YOUTUBE") {
                videoType = "YOUTUBE";
                videoUrl = lesson.video.url;
            } else if (lesson.video?.type === "UPLOAD") {
                const asset = assetMap.get(lesson.video.assetId);

                videoType = "UPLOAD";
                videoUrl = asset.fileUrl;
            }

            const lessonData = {
                moduleId,
                title: lesson.title.trim(),
                description: lesson.description?.trim() || null,
                position: lesson.position,
                duration: lesson.duration ?? null,
                videoType,
                videoUrl
            };

            if (lessonMap.has(lesson.clientId)) {
                const updatedLesson = await tx.lesson.update({
                    where: { id: lesson.clientId },
                    data: lessonData
                });

                lessonId = updatedLesson.id;

                // Replace materials while preserving lesson progress.
                await tx.material.deleteMany({
                    where: { lessonId }
                });
            } else {
                const createdLesson = await tx.lesson.create({
                    data: lessonData
                });

                lessonId = createdLesson.id;
            }

            for (const material of lesson.materials || []) {
                const asset = assetMap.get(material.assetId);

                await tx.material.create({
                    data: {
                        lessonId,
                        title: material.title.trim(),
                        fileUrl: asset.fileUrl,
                        originalFilename: asset.originalFilename,
                        fileSize: asset.fileSize,
                        mimeType: asset.mimeType
                    }
                });
            }
        }
    }

    // Delete modules removed from the snapshot.
    if (existingModuleIds.length > 0) {
        if (retainedModuleIds.size > 0) {
            await tx.module.deleteMany({
                where: {
                    courseId,
                    id: {
                        notIn: [...retainedModuleIds]
                    }
                }
            });
        } else {
            await tx.module.deleteMany({
                where: { courseId }
            });
        }
    }
};


// ==========================================
// 1. CREATE COURSE REVISION
// POST /courses/:courseId/revisions
// ==========================================

export const createCourseRevision = async (req, res) => {
    try {
        const { courseId } = req.params;

        if (!isValidUuid(courseId)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const access = await getAccessibleCourse(courseId, req.user);

        if (access.error === "NOT_FOUND") {
            return sendError(res, 404, "Course not found");
        }

        if (access.error === "FORBIDDEN") {
            return sendError(res, 403, "You do not own this course");
        }

        const existingRevision = await prisma.courseRevision.findFirst({
            where: {
                courseId,
                status: {
                    in: ["DRAFT", "PENDING"]
                }
            }
        });

        if (existingRevision) {
            return sendError(
                res,
                409,
                "An editable or pending revision already exists"
            );
        }

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: {
                modules: {
                    orderBy: { position: "asc" },
                    include: {
                        lessons: {
                            orderBy: { position: "asc" },
                            include: {
                                materials: true
                            }
                        }
                    }
                }
            }
        });

        const result = await buildInitialSnapshot(course);

        if (result.error) {
            return sendError(res, 409, result.error);
        }

        const revision = await prisma.courseRevision.create({
            data: {
                courseId,
                contentSnapshot: result.snapshot,
                status: "DRAFT"
            }
        });

        return res.status(201).json({
            success: true,
            message: "Course revision created successfully",
            data: revision
        });

    } catch (error) {
        console.error("Create course revision error:", error);
        return sendError(res, 500, "Failed to create course revision");
    }
};

// ==========================================
// 2. GET COURSE REVISIONS
// GET /courses/:courseId/revisions
// ==========================================

export const getCourseRevisions = async (req, res) => {
    try {
        const { courseId } = req.params;

        if (!isValidUuid(courseId)) {
            return sendError(res, 400, "Invalid course ID");
        }

        const access = await getAccessibleCourse(courseId, req.user);

        if (access.error === "NOT_FOUND") {
            return sendError(res, 404, "Course not found");
        }

        if (access.error === "FORBIDDEN") {
            return sendError(res, 403, "You do not own this course");
        }

        const revisions = await prisma.courseRevision.findMany({
            where: { courseId },
            orderBy: { createdAt: "desc" }
        });

        return res.status(200).json({
            success: true,
            message: "Course revisions retrieved successfully",
            data: revisions,
            pagination: {
                page: 1,
                limit: revisions.length,
                total: revisions.length,
                totalPages: revisions.length ? 1 : 0
            }
        });

    } catch (error) {
        console.error("Get course revisions error:", error);
        return sendError(res, 500, "Failed to retrieve course revisions");
    }
};

// ==========================================
// 3. GET REVISION DETAILS
// GET /courses/:courseId/revisions/:revisionId
// ==========================================

export const getCourseRevisionById = async (req, res) => {
    try {
        const { courseId, revisionId } = req.params;

        if (!isValidUuid(courseId) || !isValidUuid(revisionId)) {
            return sendError(res, 400, "Invalid course or revision ID");
        }

        const access = await getAccessibleCourse(courseId, req.user);

        if (access.error === "NOT_FOUND") {
            return sendError(res, 404, "Course not found");
        }

        if (access.error === "FORBIDDEN") {
            return sendError(res, 403, "You do not own this course");
        }

        const revision = await prisma.courseRevision.findFirst({
            where: {
                id: revisionId,
                courseId
            }
        });

        if (!revision) {
            return sendError(res, 404, "Course revision not found");
        }

        return res.status(200).json({
            success: true,
            message: "Course revision retrieved successfully",
            data: revision
        });

    } catch (error) {
        console.error("Get course revision error:", error);
        return sendError(res, 500, "Failed to retrieve course revision");
    }
};

// ==========================================
// 4. UPDATE REVISION CONTENT
// PUT /courses/:courseId/revisions/:revisionId/content
// ==========================================

export const updateCourseRevisionContent = async (req, res) => {
    try {
        const { courseId, revisionId } = req.params;

        if (!isValidUuid(courseId) || !isValidUuid(revisionId)) {
            return sendError(res, 400, "Invalid course or revision ID");
        }

        const access = await getAccessibleCourse(courseId, req.user);

        if (access.error === "NOT_FOUND") {
            return sendError(res, 404, "Course not found");
        }

        if (access.error === "FORBIDDEN") {
            return sendError(res, 403, "You do not own this course");
        }

        const revision = await prisma.courseRevision.findFirst({
            where: {
                id: revisionId,
                courseId
            }
        });

        if (!revision) {
            return sendError(res, 404, "Course revision not found");
        }

        if (revision.status !== "DRAFT") {
            return sendError(res, 409, "Only DRAFT revisions can be edited");
        }

        const validation = await validateSnapshot(req.body);

        if (validation.error) {
            return sendError(res, 400, validation.error);
        }

        const updatedRevision = await prisma.courseRevision.update({
            where: { id: revisionId },
            data: {
                contentSnapshot: req.body
            }
        });

        return res.status(200).json({
            success: true,
            message: "Course revision content updated successfully",
            data: updatedRevision
        });

    } catch (error) {
        console.error("Update revision content error:", error);
        return sendError(res, 500, "Failed to update revision content");
    }
};

// ==========================================
// 5. SUBMIT REVISION
// POST /courses/:courseId/revisions/:revisionId/submit
// ==========================================

export const submitCourseRevision = async (req, res) => {
    try {
        const { courseId, revisionId } = req.params;

        if (!isValidUuid(courseId) || !isValidUuid(revisionId)) {
            return sendError(res, 400, "Invalid course or revision ID");
        }

        const access = await getAccessibleCourse(courseId, req.user);

        if (access.error === "NOT_FOUND") {
            return sendError(res, 404, "Course not found");
        }

        if (access.error === "FORBIDDEN") {
            return sendError(res, 403, "You do not own this course");
        }

        const revision = await prisma.courseRevision.findFirst({
            where: {
                id: revisionId,
                courseId
            }
        });

        if (!revision) {
            return sendError(res, 404, "Course revision not found");
        }

        if (revision.status !== "DRAFT") {
            return sendError(
                res,
                409,
                "Only DRAFT revisions can be submitted"
            );
        }

        const validation = await validateSnapshot(revision.contentSnapshot);

        if (validation.error) {
            return sendError(res, 400, validation.error);
        }

        const updatedRevision = await prisma.courseRevision.update({
            where: { id: revisionId },
            data: {
                status: "PENDING",
                submittedAt: new Date()
            }
        });

        return res.status(200).json({
            success: true,
            message: "Course revision submitted successfully",
            data: updatedRevision
        });

    } catch (error) {
        console.error("Submit revision error:", error);
        return sendError(res, 500, "Failed to submit course revision");
    }
};

// ==========================================
// 6. ADMIN: GET REVISIONS FOR REVIEW
// GET /admin/revisions
// ==========================================

export const getRevisionsForAdmin = async (req, res) => {
    try {
        const pagination = getPagination(req.query);

        if (!pagination) {
            return sendError(res, 400, "Invalid pagination parameters");
        }

        const status = req.query.status || "PENDING";

        if (!VALID_REVISION_STATUSES.includes(status)) {
            return sendError(res, 400, "Invalid revision status");
        }

        const { page, limit, skip } = pagination;

        const where = { status };

        const [revisions, total] = await Promise.all([
            prisma.courseRevision.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    submittedAt: "asc"
                },
                include: {
                    course: {
                        select: {
                            id: true,
                            title: true,
                            instructorId: true,
                            instructor: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.courseRevision.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            message: "Revisions retrieved successfully",
            data: revisions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Admin get revisions error:", error);
        return sendError(res, 500, "Failed to retrieve revisions");
    }
};

// ==========================================
// 7. ADMIN: APPROVE OR REJECT REVISION
// PATCH /admin/revisions/:revisionId/review
// ==========================================

export const reviewCourseRevision = async (req, res) => {
    try {
        const { revisionId } = req.params;
        const { status, reviewComment } = req.body;

        if (!isValidUuid(revisionId)) {
            return sendError(res, 400, "Invalid revision ID");
        }

        if (!["APPROVED", "REJECTED"].includes(status)) {
            return sendError(
                res,
                400,
                "Status must be APPROVED or REJECTED"
            );
        }

        if (
            reviewComment !== undefined &&
            (
                typeof reviewComment !== "string" ||
                reviewComment.length > 2000
            )
        ) {
            return sendError(
                res,
                400,
                "Review comment must be a string with at most 2000 characters"
            );
        }

        const revision = await prisma.courseRevision.findUnique({
            where: { id: revisionId }
        });

        if (!revision) {
            return sendError(res, 404, "Course revision not found");
        }

        if (revision.status !== "PENDING") {
            return sendError(
                res,
                409,
                "Only PENDING revisions can be reviewed"
            );
        }

        let updatedRevision;

        if (status === "REJECTED") {
            updatedRevision = await prisma.courseRevision.update({
                where: { id: revisionId },
                data: {
                    status: "REJECTED",
                    reviewComment: reviewComment?.trim() || null,
                    reviewerId: req.user.id,
                    reviewedAt: new Date()
                }
            });
        } else {
            const validation = await validateSnapshot(
                revision.contentSnapshot
            );

            if (validation.error) {
                return sendError(res, 400, validation.error);
            }

            updatedRevision = await prisma.$transaction(async (tx) => {
                await applySnapshot(
                    tx,
                    revision.courseId,
                    revision.contentSnapshot,
                    validation.assets
                );

                return tx.courseRevision.update({
                    where: { id: revisionId },
                    data: {
                        status: "APPROVED",
                        reviewComment: reviewComment?.trim() || null,
                        reviewerId: req.user.id,
                        reviewedAt: new Date()
                    }
                });
            });
        }

        return res.status(200).json({
            success: true,
            message: `Course revision ${status.toLowerCase()} successfully`,
            data: updatedRevision
        });

    } catch (error) {
        console.error("Review course revision error:", error);
        return sendError(res, 500, "Failed to review course revision");
    }
};
