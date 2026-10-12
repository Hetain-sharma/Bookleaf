const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      set: (value) => value.trim().toLowerCase(),
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["author", "admin"],
      required: true,
    },
    authorId: {
      type: String,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
