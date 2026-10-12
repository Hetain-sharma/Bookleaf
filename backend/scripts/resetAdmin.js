require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const User = require("../models/User");

async function resetAdmin() {
  try {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must both be set in .env");
    }

    if (password.length < 12) {
      throw new Error("ADMIN_PASSWORD must be at least 12 characters long");
    }

    await connectDB();

    const conflictingUser = await User.findOne({ email }).select(
      "_id name role authorId",
    );

    if (conflictingUser && conflictingUser.role !== "admin") {
      throw new Error(
        `ADMIN_EMAIL conflicts with an existing author account (${conflictingUser.name}, authorId: ${conflictingUser.authorId || "n/a"}). Use a dedicated admin email before resetting.`,
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await User.updateOne(
      { email },
      {
        $set: {
          name: "BookLeaf Admin",
          email,
          passwordHash,
          role: "admin",
          authorId: null,
        },
      },
      { upsert: true },
    );

    console.log("Admin account created/reset successfully.");
    console.log(`Email: ${email}`);
    console.log(
      `Result: ${result.upsertedCount ? "created" : "updated"}`,
    );
  } catch (error) {
    console.error("Admin reset failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

resetAdmin();
