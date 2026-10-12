require("dotenv").config();

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const User = require("../models/User");

async function ensureAdminEmailIsAvailable(adminEmail) {
  const existingUser = await User.findOne({ email: adminEmail }).select(
    "_id email role authorId name",
  );

  if (!existingUser) {
    return;
  }

  if (existingUser.role === "admin") {
    return;
  }

  throw new Error(
    `ADMIN_EMAIL conflicts with an existing author account (${existingUser.name}, authorId: ${existingUser.authorId || "n/a"}). Change ADMIN_EMAIL before running this setup script.`,
  );
}

async function createDemoUsers() {
  try {
    const { DEMO_AUTHOR_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

    if (!DEMO_AUTHOR_PASSWORD || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error(
        "Set DEMO_AUTHOR_PASSWORD, ADMIN_EMAIL and ADMIN_PASSWORD in .env before running this script.",
      );
    }

    if (ADMIN_PASSWORD.length < 12) {
      throw new Error("ADMIN_PASSWORD must be at least 12 characters long.");
    }

    if (DEMO_AUTHOR_PASSWORD.length < 12) {
      throw new Error("DEMO_AUTHOR_PASSWORD must be at least 12 characters long.");
    }

    await connectDB();

    const adminEmail = ADMIN_EMAIL.trim().toLowerCase();
    await ensureAdminEmailIsAvailable(adminEmail);

    const filePath = path.join(__dirname, "../data/bookleaf_sample_data.json");
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const authorPasswordHash = await bcrypt.hash(DEMO_AUTHOR_PASSWORD, 12);

    let authorsUpdated = 0;

    for (const author of data.authors) {
      const authorEmail = author.email.trim().toLowerCase();
      const existingUser = await User.findOne({ email: authorEmail }).select(
        "_id role authorId",
      );

      if (existingUser && existingUser.role === "admin") {
        throw new Error(
          `Author account email ${authorEmail} conflicts with an admin account. Fix the sample data before provisioning author users.`,
        );
      }

      const result = await User.updateOne(
        { email: authorEmail },
        {
          $set: {
            name: author.name,
            email: authorEmail,
            passwordHash: authorPasswordHash,
            role: "author",
            authorId: author.author_id,
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount || result.modifiedCount > 0) {
        authorsUpdated += 1;
      }
    }

    const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const adminResult = await User.updateOne(
      { email: adminEmail },
      {
        $set: {
          name: "BookLeaf Admin",
          email: adminEmail,
          passwordHash: adminPasswordHash,
          role: "admin",
          authorId: null,
        },
      },
      { upsert: true },
    );

    console.log("Demo account setup complete.");
    console.log(`Author accounts updated: ${authorsUpdated}`);
    console.log(
      `Admin account: ${adminResult.upsertedCount ? "created" : "updated"}`,
    );
    console.log("Use the passwords configured in your .env file.");
  } catch (error) {
    console.error("Demo account setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

createDemoUsers();
