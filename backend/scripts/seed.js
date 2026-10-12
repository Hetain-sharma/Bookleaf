require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const Author = require("../models/Author");
const Book = require("../models/Book");

async function seedDatabase() {
  try {
    await connectDB();

    const filePath = path.join(__dirname, "../data/bookleaf_sample_data.json");

    const rawData = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(rawData);

    if (!Array.isArray(data.authors)) {
      throw new Error("Expected an authors array in the JSON file");
    }

    const authors = [];
    const books = [];

    for (const author of data.authors) {
      authors.push({
        authorId: author.author_id,
        name: author.name,
        email: author.email,
        phone: author.phone,
        city: author.city,
        joinedDate: author.joined_date || null,
      });

      for (const book of author.books || []) {
        books.push({
          bookId: book.book_id,
          authorId: author.author_id,
          title: book.title,
          isbn: book.isbn,
          genre: book.genre,
          publicationDate: book.publication_date || null,
          status: book.status,
          mrp: book.mrp,
          authorRoyaltyPerCopy: book.author_royalty_per_copy,
          totalCopiesSold: book.total_copies_sold ?? 0,
          totalRoyaltyEarned: book.total_royalty_earned ?? 0,
          royaltyPaid: book.royalty_paid ?? 0,
          royaltyPending: book.royalty_pending ?? 0,
          lastRoyaltyPayoutDate: book.last_royalty_payout_date || null,
          printPartner: book.print_partner ?? null,
          availableOn: book.available_on || [],
        });
      }
    }

    // This seed script replaces records in these two collections.
    // Use a dedicated development database.
    await Book.deleteMany({});
    await Author.deleteMany({});

    await Author.insertMany(authors);
    await Book.insertMany(books);

    console.log("Sample data imported successfully!");
    console.log(`Authors imported: ${authors.length}`);
    console.log(`Books imported: ${books.length}`);
  } catch (error) {
    console.error("Database seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedDatabase();
