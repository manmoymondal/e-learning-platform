import { prisma } from "../config/db.js";

const getProfileData = (user) => {
    const profile =
        user.role === "INSTRUCTOR"
            ? user.instructorProfile
            : user.role === "STUDENT"
                ? user.studentProfile
                : null;

    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        },
        bio: profile?.bio ?? null,
        profilePicture: profile?.profilePicture ?? null,
        expertise: user.role === "INSTRUCTOR"
            ? profile?.expertise ?? null
            : null,
        experience: user.role === "INSTRUCTOR"
            ? profile?.experience ?? null
            : null,
        learningInterests: user.role === "STUDENT"
            ? profile?.learningInterests ?? []
            : []
    };
};

const profileInclude = {
    instructorProfile: true,
    studentProfile: true
};

export const getMyProfile = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: profileInclude
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Profile retrieved successfully",
            data: getProfileData(user)
        });
    } catch (error) {
        console.error("Get profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve profile"
        });
    }
};

export const updateMyProfile = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, role: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const allowedFields = {
            ADMIN: ["name"],
            INSTRUCTOR: [
                "name",
                "bio",
                "profilePictureAssetId",
                "expertise",
                "experience"
            ],
            STUDENT: [
                "name",
                "bio",
                "profilePictureAssetId",
                "learningInterests"
            ]
        };

        const allowed = allowedFields[user.role] ?? [];
        const suppliedFields = Object.keys(req.body ?? {});

        if (suppliedFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Provide at least one profile field to update"
            });
        }

        const invalidFields = suppliedFields.filter(
            (field) => !allowed.includes(field)
        );

        if (invalidFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `These fields cannot be updated for your role: ${invalidFields.join(", ")}`
            });
        }

        const data = req.body;
        const userUpdate = {};
        const profileUpdate = {};

        if (Object.hasOwn(data, "name")) {
            if (
                typeof data.name !== "string" ||
                data.name.trim().length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Name must be a non-empty string"
                });
            }

            userUpdate.name = data.name.trim();
        }

        if (Object.hasOwn(data, "bio")) {
            if (typeof data.bio !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Bio must be a string"
                });
            }

            profileUpdate.bio = data.bio.trim();
        }

        if (Object.hasOwn(data, "expertise")) {
            if (typeof data.expertise !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Expertise must be a string"
                });
            }

            profileUpdate.expertise = data.expertise.trim();
        }

        if (Object.hasOwn(data, "experience")) {
            if (
                !Number.isInteger(data.experience) ||
                data.experience < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Experience must be a non-negative integer"
                });
            }

            profileUpdate.experience = data.experience;
        }

        if (Object.hasOwn(data, "learningInterests")) {
            if (
                !Array.isArray(data.learningInterests) ||
                !data.learningInterests.every(
                    (item) => typeof item === "string"
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Learning interests must be an array of strings"
                });
            }

            profileUpdate.learningInterests =
                data.learningInterests.map((item) => item.trim());
        }

        if (Object.hasOwn(data, "profilePictureAssetId")) {
            const assetId = data.profilePictureAssetId;

            const uuidPattern =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (
                typeof assetId !== "string" ||
                !uuidPattern.test(assetId)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "A valid profile picture asset ID is required"
                });
            }

            const asset = await prisma.asset.findUnique({
                where: { id: assetId },
                select: {
                    assetType: true,
                    fileUrl: true
                }
            });

            if (!asset || asset.assetType !== "THUMBNAIL") {
                return res.status(400).json({
                    success: false,
                    message: "The selected asset must be an uploaded thumbnail image"
                });
            }

            profileUpdate.profilePicture = asset.fileUrl;
        }

        await prisma.$transaction(async (tx) => {
            if (Object.keys(userUpdate).length > 0) {
                await tx.user.update({
                    where: { id: user.id },
                    data: userUpdate
                });
            }

            if (Object.keys(profileUpdate).length > 0) {
                if (user.role === "INSTRUCTOR") {
                    await tx.instructorProfile.upsert({
                        where: { userId: user.id },
                        update: profileUpdate,
                        create: {
                            userId: user.id,
                            ...profileUpdate
                        }
                    });
                } else if (user.role === "STUDENT") {
                    await tx.studentProfile.upsert({
                        where: { userId: user.id },
                        update: profileUpdate,
                        create: {
                            userId: user.id,
                            ...profileUpdate
                        }
                    });
                }
            }
        });

        const updatedUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: profileInclude
        });

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: getProfileData(updatedUser)
        });
    } catch (error) {
        console.error("Update profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update profile"
        });
    }
};
