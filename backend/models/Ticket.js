const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
  {
    authorId: {
      type: String,
      required: true,
      trim: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    authorRole: {
      type: String,
      enum: ["author", "admin"],
      required: true,
    },
    clientMessageId: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
  },
  { timestamps: true },
);

const auditEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },
    actorId: {
      type: String,
      default: null,
      trim: true,
    },
    actorName: {
      type: String,
      default: null,
      trim: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8000,
    },
    category: {
      type: String,
      required: true,
      enum: ["Royalty", "Publishing", "Book updates", "Distribution", "Account", "General"],
    },
    priority: {
      type: String,
      required: true,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    status: {
      type: String,
      required: true,
      enum: ["Open", "In progress", "Waiting for author", "Resolved", "Closed"],
      default: "Open",
    },
    authorId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    authorEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    assignedTo: {
      type: String,
      default: null,
      trim: true,
    },
    assignedAgentName: {
      type: String,
      default: null,
      trim: true,
    },
    aiDraft: {
      type: {
        message: { type: String, default: "" },
        provider: { type: String, default: "fallback" },
        createdAt: { type: Date, default: null },
      },
      default: null,
    },
    replies: [replySchema],
    auditTrail: [auditEntrySchema],
    resolution: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true },
);

ticketSchema.index({ authorId: 1, createdAt: -1 });
ticketSchema.index({ status: 1, priority: 1, createdAt: -1 });

module.exports = mongoose.model("Ticket", ticketSchema);
