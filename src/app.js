
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import yaml from "yaml";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import courseRoutes from "./routes/course.routes.js";
import enrollmentRoutes from "./routes/enrollment.routes.js";
import learningRoutes from "./routes/learning.routes.js";
import userRoutes from "./routes/user.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

const app = express();

// Resolve project directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use(
    "/uploads",
    express.static(path.join(projectRoot, "uploads"))
);

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1", profileRoutes);
app.use("/api/v1", courseRoutes);
app.use("/api/v1", enrollmentRoutes);
app.use("/api/v1", learningRoutes);
app.use("/api/v1", uploadRoutes);

// Load OpenAPI documentation
const openApiPath = path.join(
    projectRoot,
    "docs",
    "openapi.yaml"
);

if (!fs.existsSync(openApiPath)) {
    throw new Error("OpenAPI file not found: " + openApiPath);
}

const openApiDocument = yaml.parse(
    fs.readFileSync(openApiPath, "utf8")
);

// Swagger UI
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument)
);

// Health check
app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "E-Learning Platform API is running"
    });
});

export default app;
