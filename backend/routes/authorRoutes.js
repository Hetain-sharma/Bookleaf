const express = require("express");
const Author = require("../models/Author");
const authMiddleware = require("../middleware/authMiddleware");
const { requireAdmin, requireOwnerOrAdmin, requireAuthor } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/me", authMiddleware, requireAuthor, async (req, res) => {
  try {
    const author = await Author.findOne({ authorId: req.user.authorId }).select("-__v");

    if (!author) {
      return res.status(404).json({
        success: false,
        message: "Author profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: author,
    });
  } catch (error) {
    console.error("Fetch own author profile error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch author profile" });
  }
});

router.get("/", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};

    if (search && String(search).trim()) {
      const term = String(search).trim();
      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
        { authorId: { $regex: term, $options: "i" } },
      ];
    }

    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(50, Math.max(1, Number(limit) || 20));
    const skip = (pageNumber - 1) * limitNumber;
    const [authors, total] = await Promise.all([
      Author.find(query).skip(skip).limit(limitNumber).sort({ name: 1 }).lean(),
      Author.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: authors.length,
      data: authors,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.max(1, Math.ceil(total / limitNumber)),
      },
    });
  } catch (error) {
    console.error("List authors error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch authors" });
  }
});

router.patch("/me", authMiddleware, requireAuthor, async (req, res) => {
  try {
    const updateFields = {};
    const allowed = ["name", "phone", "city"];

    for (const field of allowed) {
      if (field in req.body && req.body[field] !== undefined) {
        const value = typeof req.body[field] === "string" ? req.body[field].trim() : req.body[field];
        updateFields[field] = value;
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, message: "No valid profile changes supplied" });
    }

    const author = await Author.findOneAndUpdate(
      { authorId: req.user.authorId },
      { $set: updateFields },
      { new: true, runValidators: true },
    ).select("-__v");

    if (!author) {
      return res.status(404).json({ success: false, message: "Author profile not found" });
    }

    return res.status(200).json({ success: true, data: author });
  } catch (error) {
    console.error("Update author profile error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update author profile" });
  }
});

router.get("/:authorId", authMiddleware, requireOwnerOrAdmin, async (req, res) => {
  try {
    const author = await Author.findOne({
      authorId: req.params.authorId,
    }).select("-__v");

    if (!author) {
      return res.status(404).json({
        success: false,
        message: "Author not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: author,
    });
  } catch (error) {
    console.error("Fetch author error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch author",
    });
  }
});

module.exports = router;
