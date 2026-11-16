
import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";

export const authenticate = async (req, res, next) => {
    try {
        // 1. Read Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is required"
            });
        }

        // 2. Extract token
        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization header"
            });
        }

        // 3. Verify JWT
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // 4. Find user in database
        const user = await prisma.user.findUnique({
            where: {
                id: decoded.sub
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User account not found"
            });
        }

        // 5. Check account status
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated"
            });
        }

        // 6. Attach authenticated user to request
        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        // 7. Continue to next middleware/controller
        next();

    } catch (error) {
        if (
            error.name === "TokenExpiredError" ||
            error.name === "JsonWebTokenError" ||
            error.name === "NotBeforeError"
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired authentication token"
            });
        }

        console.error("Authentication error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};
