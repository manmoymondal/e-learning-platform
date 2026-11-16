
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/db.js";

async function main() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    }

    const existingAdmin = await prisma.user.findUnique({
        where: { email }
    });

    if (existingAdmin) {
        console.log("Admin account already exists");
        return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.user.create({
        data: {
            name: "Platform Admin",
            email,
            passwordHash,
            role: "ADMIN"
        }
    });

    console.log("Admin created successfully:", admin.email);
}

main()
    .catch((error) => {
        console.error("Admin seeding failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

