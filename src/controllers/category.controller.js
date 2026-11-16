
import { prisma } from "../config/db.js";

// CREATE CATEGORY - ADMIN ONLY
export const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        const category = await prisma.category.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null
            }
        });

        return res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: { category }
        });

    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "A category with this name already exists"
            });
        }

        console.error("Create category error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET ALL CATEGORIES - PUBLIC
export const getAllCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: {
                name: "asc"
            },
            include: {
                _count: {
                    select: {
                        courses: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: "Categories retrieved successfully",
            data: { categories }
        });

    } catch (error) {
        console.error("Get categories error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET SINGLE CATEGORY - PUBLIC
export const getCategoryById = async (req, res) => {
    try {
        const { categoryId } = req.params;

        const category = await prisma.category.findUnique({
            where: {
                id: categoryId
            },
            include: {
                _count: {
                    select: {
                        courses: true
                    }
                }
            }
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Category retrieved successfully",
            data: { category }
        });

    } catch (error) {
        console.error("Get category error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// UPDATE CATEGORY - ADMIN ONLY
export const updateCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { name, description } = req.body;

        if (name === undefined && description === undefined) {
            return res.status(400).json({
                success: false,
                message: "At least one field must be provided"
            });
        }

        if (name !== undefined && !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Category name cannot be empty"
            });
        }

        const existingCategory = await prisma.category.findUnique({
            where: { id: categoryId }
        });

        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        const category = await prisma.category.update({
            where: { id: categoryId },
            data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(description !== undefined && {
                    description: description?.trim() || null
                })
            }
        });

        return res.status(200).json({
            success: true,
            message: "Category updated successfully",
            data: { category }
        });

    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "A category with this name already exists"
            });
        }

        console.error("Update category error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// DELETE CATEGORY - ADMIN ONLY
export const deleteCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;

        const category = await prisma.category.findUnique({
            where: { id: categoryId }
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        const courseCount = await prisma.course.count({
            where: {
                categoryId
            }
        });

        if (courseCount > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete a category that has courses assigned to it"
            });
        }

        await prisma.category.delete({
            where: { id: categoryId }
        });

        return res.status(200).json({
            success: true,
            message: "Category deleted successfully"
        });

    } catch (error) {
        // Also handle a concurrent course assignment.
        if (error.code === "P2003") {
            return res.status(409).json({
                success: false,
                message: "Cannot delete a category that has courses assigned to it"
            });
        }

        console.error("Delete category error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};
