import bcrypt from "bcryptjs";
import { prisma } from "../config/db.js";

const VALID_ROLES = ["ADMIN", "INSTRUCTOR", "STUDENT"];

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidUuid = (id) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
};

// Fields safe to return. Never return passwordHash.
const userSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    instructorProfile: true,
    studentProfile: true
};

// ==========================================
// 1. GET ALL USERS - ADMIN ONLY
// GET /api/v1/users
// ==========================================

export const getAllUsers = async (req, res) => {
    try {
        const page = Number(req.query.page ?? 1);
        const limit = Number(req.query.limit ?? 10);
        const { role } = req.query;

        if (
            !Number.isInteger(page) ||
            page < 1 ||
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Page must be positive and limit must be between 1 and 100"
            });
        }

        if (role && !VALID_ROLES.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role filter"
            });
        }

        const where = role ? { role } : {};

        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: userSelect,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit
            }),

            prisma.user.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            message: "Users retrieved successfully",
            data: {
                users,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error("Get all users error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// ==========================================
// 2. CREATE INSTRUCTOR - ADMIN ONLY
// POST /api/v1/users/instructors
// ==========================================

export const createInstructor = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            bio,
            expertise,
            experience
        } = req.body;

        // Validate required fields
        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof email !== "string" ||
            !email.trim() ||
            typeof password !== "string" ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long"
            });
        }

        if (
            bio !== undefined &&
            typeof bio !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Bio must be a string"
            });
        }

        if (
            expertise !== undefined &&
            typeof expertise !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Expertise must be a string"
            });
        }

        if (
            experience !== undefined &&
            (!Number.isInteger(experience) || experience < 0)
        ) {
            return res.status(400).json({
                success: false,
                message: "Experience must be a non-negative integer"
            });
        }

        // Check duplicate email
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists"
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Create User and InstructorProfile together
        const instructor = await prisma.user.create({
            data: {
                name: name.trim(),
                email: normalizedEmail,
                passwordHash,
                role: "INSTRUCTOR",

                instructorProfile: {
                    create: {
                        bio: bio?.trim() || null,
                        expertise: expertise?.trim() || null,
                        experience: experience ?? null
                    }
                }
            },
            select: userSelect
        });

        return res.status(201).json({
            success: true,
            message: "Instructor created successfully",
            data: { user: instructor }
        });

    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists"
            });
        }

        console.error("Create instructor error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// ==========================================
// 3. GET USER BY ID - ADMIN ONLY
// GET /api/v1/users/:userId
// ==========================================

export const getUserById = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!isValidUuid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: userSelect
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "User retrieved successfully",
            data: { user }
        });

    } catch (error) {
        console.error("Get user error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// ==========================================
// 4. UPDATE USER - ADMIN ONLY
// PATCH /api/v1/users/:userId
// ==========================================

export const updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, email } = req.body;

        if (!isValidUuid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        if (name === undefined && email === undefined) {
            return res.status(400).json({
                success: false,
                message: "At least one field must be provided"
            });
        }

        if (name !== undefined && (
            typeof name !== "string" || !name.trim()
        )) {
            return res.status(400).json({
                success: false,
                message: "Name must be a non-empty string"
            });
        }

        if (email !== undefined && (
            typeof email !== "string" ||
            !isValidEmail(email.trim().toLowerCase())
        )) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address"
            });
        }

        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(email !== undefined && {
                    email: email.trim().toLowerCase()
                })
            },
            select: userSelect
        });

        return res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: { user: updatedUser }
        });

    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists"
            });
        }

        console.error("Update user error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// ==========================================
// 5. ACTIVATE / DEACTIVATE USER - ADMIN ONLY
// PATCH /api/v1/users/:userId/status
// ==========================================

export const updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;

        if (!isValidUuid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "isActive must be a boolean"
            });
        }

        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { isActive },
            select: userSelect
        });

        return res.status(200).json({
            success: true,
            message: isActive
                ? "User activated successfully"
                : "User deactivated successfully",
            data: { user: updatedUser }
        });

    } catch (error) {
        console.error("Update user status error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};