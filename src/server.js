
import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/db.js";

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        // Connect to PostgreSQL through Prisma
        await prisma.$connect();

        console.log("Database connected successfully");

        // Start Express server
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
            console.log(`Swagger documentation: http://localhost:${PORT}/api-docs`);
        });

    } catch (error) {
        console.error("Failed to start server:", error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

startServer();
