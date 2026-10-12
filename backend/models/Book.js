const mongoose = require("mongoose");

const reviewEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["Submitted", "Under Review", "Changes Requested", "Approved", "Rejected", "Resubmitted", "Publication Details Updated", "Published"],
      required: true,
    },
    adminId: {
      type: String,
      default: null,
    },
    adminName: {
      type: String,
      default: null,
    },
    feedback: {
      type: String,
      default: "",
      maxlength: 4000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const privateFileSchema = new mongoose.Schema(
  {
    storageName: { type: String, required: true },
    originalName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false },
);

const bookSchema = new mongoose.Schema(
  {
    bookId: {
      type: String,
      required: true,
      unique: true,
    },
    authorId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    isbn: String,
    genre: String,
    publicationDate: {
      type: Date,
      default: null,
    },
    status: String,
    mrp: {
      type: Number,
      default: null,
    },
    authorRoyaltyPerCopy: {
      type: Number,
      default: null,
    },
    totalCopiesSold: {
      type: Number,
      default: 0,
    },
    totalRoyaltyEarned: {
      type: Number,
      default: 0,
    },
    royaltyPaid: {
      type: Number,
      default: 0,
    },
    royaltyPending: {
      type: Number,
      default: 0,
    },
    lastRoyaltyPayoutDate: {
      type: Date,
      default: null,
    },
    printPartner: {
      type: String,
      default: null,
    },
    availableOn: {
      type: [String],
      default: [],
    },
    ownerUserId: {
      type: String,
      default: null,
      index: true,
    },
    subtitle: {
      type: String,
      default: "",
      maxlength: 200,
    },
    synopsis: {
      type: String,
      default: "",
      maxlength: 10000,
    },
    language: {
      type: String,
      default: "",
      maxlength: 80,
    },
    authorName: {
      type: String,
      default: "",
      maxlength: 200,
    },
    manuscript: {
      type: privateFileSchema,
      default: null,
    },
    coverImage: {
      type: privateFileSchema,
      default: null,
    },
    submissionStatus: {
      type: String,
      enum: ["Submitted", "Under Review", "Changes Requested", "Approved", "Rejected", "Publishing", "Published"],
      default: undefined,
      index: true,
    },
    submissionDate: {
      type: Date,
      default: null,
    },
    adminFeedback: {
      type: String,
      default: "",
      maxlength: 4000,
    },
    reviewHistory: {
      type: [reviewEntrySchema],
      default: undefined,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    publicationDetails: {
      mrp: { type: Number, default: null, min: 0 },
    },
  },
  { timestamps: true },
);

bookSchema.index({ submissionStatus: 1, updatedAt: -1 });

module.exports = mongoose.model("Book", bookSchema);
