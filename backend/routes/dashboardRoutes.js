const express = require("express");
const Book = require("../models/Book");
const authMiddleware = require("../middleware/authMiddleware");
const { requireAuthor } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/author", authMiddleware, requireAuthor, async (req, res) => {
  try {
    const authorId = req.user.authorId;
    const books = await Book.find({ authorId }).lean();

    const dashboard = books.reduce(
      (totals, book) => {
        totals.totalBooks += 1;
        totals.copiesSold += book.totalCopiesSold || 0;
        totals.royaltyEarned += book.totalRoyaltyEarned || 0;
        totals.royaltyPending += book.royaltyPending || 0;
        totals.royaltyPaid += book.royaltyPaid || 0;

        return totals;
      },
      {
        totalBooks: 0,
        copiesSold: 0,
        royaltyEarned: 0,
        royaltyPending: 0,
        royaltyPaid: 0,
      },
    );

    return res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("Author dashboard error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch author dashboard",
    });
  }
});

module.exports = router;
