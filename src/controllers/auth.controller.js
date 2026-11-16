import bcrypt from "bcryptjs";
import { prisma } from "../config/db.js";
import jwt from "jsonwebtoken";

export const registerStudent = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 1. Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        // 2. Validate email
        const normalizedEmail = email.trim().toLowerCase();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address"
            });
        }

        // 3. Validate password
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long"
            });
        }

        // 4. Check whether email already exists
        const existingUser = await prisma.user.findUnique({
            where: {
                email: normalizedEmail
            }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email is already registered"
            });
        }

        // 5. Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // 6. Create student and student profile
        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: normalizedEmail,
                passwordHash,

                // Role defaults to STUDENT in Prisma
                studentProfile: {
                    create: {}
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                studentProfile: true
            }
        });

        // 7. Return response
        return res.status(201).json({
            success: true,
            message: "Student registered successfully",
            data: {
                user
            }
        });

    } catch (error) {
        console.error("Student registration error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


/---Login---/

export const loginStudent = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // 2. Find user by email
        const normalizedEmail = email.trim().toLowerCase();

        const user = await prisma.user.findUnique({
            where: {
                email: normalizedEmail
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // 3. Verify password
        const isPasswordValid = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // 4. Check account status
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated"
            });
        }

        // 5. Generate JWT
        const accessToken = jwt.sign(
            {
                sub: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        // 6. Return token and user information
        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                accessToken,
                tokenType: "Bearer",
                expiresIn: "1d",
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            }
        });

    } catch (error) {
        console.error("Student login error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};



export const getCurrentUser = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                studentProfile: true,
                instructorProfile: true
            }
        });

        return res.status(200).json({
            success: true,
            message: "User profile retrieved successfully",
            data: {
                user
            }
        });

    } catch (error) {
        console.error("Get current user error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


/--Changing Password--/

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // 1. Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required"
            });
        }

        // 2. Validate new password
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 8 characters long"
            });
        }

        // 3. Get authenticated user
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // 4. Verify current password
        const isPasswordValid = await bcrypt.compare(
            currentPassword,
            user.passwordHash
        );

        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // 5. Prevent using the same password
        const isSamePassword = await bcrypt.compare(
            newPassword,
            user.passwordHash
        );

        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: "New password must be different from current password"
            });
        }

        // 6. Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 12);

        // 7. Update password in database
        await prisma.user.update({
            where: {
                id: req.user.id
            },
            data: {
                passwordHash: newPasswordHash
            }
        });

        return res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });

    } catch (error) {
        console.error("Change password error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};
