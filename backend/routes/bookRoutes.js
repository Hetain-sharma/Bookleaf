const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const Book = require("../models/Book");
const authMiddleware = require("../middleware/authMiddleware");
const { requireAdmin, requireAuthor } = require("../middleware/authMiddleware");
const {
  PRIVATE_UPLOAD_DIR,
  MAX_COVER_SIZE,
  parseBookFiles,
  removeUploadedFiles,
  toPrivateFile,
  validateFileSignature,
} = require("../middleware/bookUpload");

const router = express.Router();
const SUBMISSION_STATUSES = [
  "Submitted",
  "Under Review",
  "Changes Requested",
  "Approved",
  "Rejected",
  "Publishing",
  "Published",
];

router.param("bookId", (req, res, next, bookId) => {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(bookId)) {
    return res.status(400).json({ success: false, message: "Invalid book ID" });
  }
  next();
});

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateISBN(value) {
  if (!value) return true;
  const isbn = value.replace(/[-\s]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce((total, digit, index) => (
      total + (digit === "X" ? 10 : Number(digit)) * (10 - index)
    ), 0);
    return sum % 11 === 0;
  }
  if (/^\d{13}$/.test(isbn)) {
    const sum = [...isbn].reduce(
      (total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
      0,
    );
    return sum % 10 === 0;
  }
  return false;
}

function validateSubmissionFields(fields) {
  const data = {
    title: normalizeText(fields.title),
    subtitle: normalizeText(fields.subtitle),
    synopsis: normalizeText(fields.synopsis),
    genre: normalizeText(fields.genre),
    language: normalizeText(fields.language),
    isbn: normalizeText(fields.isbn),
  };

  if (!data.title || !data.synopsis || !data.genre || !data.language) {
    return { error: "Title, synopsis, genre, and language are required" };
  }
  if (data.title.length > 200 || data.subtitle.length > 200) {
    return { error: "Book title or subtitle exceeds the supported length" };
  }
  if (data.synopsis.length < 30 || data.synopsis.length > 10000) {
    return { error: "Synopsis must be between 30 and 10000 characters" };
  }
  if (data.genre.length > 100 || data.language.length > 80) {
    return { error: "Genre or language exceeds the supported length" };
  }
  if (data.isbn && !validateISBN(data.isbn)) {
    return { error: "ISBN must be a valid ISBN-10 or ISBN-13" };
  }

  return { data };
}

function validatePublicationDetails(fields) {
  const publicationDate = normalizeText(fields.publicationDate);
  const mrp = Number(fields.mrp);
  const date = new Date(publicationDate);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(publicationDate) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== publicationDate
  ) {
    return { error: "A valid publication date is required" };
  }
  if (!Number.isFinite(mrp) || mrp <= 0 || mrp > 10000000) {
    return { error: "Publication price must be greater than zero" };
  }

  return { data: { publicationDate: date, mrp } };
}

function actorEntry(action, actor, feedback = "") {
  return {
    action,
    adminId: actor?.role === "admin" ? actor.id : null,
    adminName: actor?.role === "admin" ? actor.name : actor?.name || null,
    feedback,
    createdAt: new Date(),
  };
}

function sanitizeFile(file) {
  if (!file) return null;
  return {
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
  };
}

function sanitizeBook(book) {
  const isSubmission = Boolean(book.submissionStatus);
  return {
    id: book._id?.toString(),
    bookId: book.bookId,
    authorId: book.authorId,
    title: book.title,
    subtitle: book.subtitle || "",
    synopsis: book.synopsis || "",
    genre: book.genre || "",
    language: book.language || "",
    authorName: book.authorName || "",
    isbn: book.isbn || "",
    status: book.submissionStatus || book.status || "Published",
    submissionStatus: book.submissionStatus || book.status || "Published",
    submissionDate: book.submissionDate || (isSubmission ? book.createdAt : null),
    updatedAt: book.updatedAt || null,
    createdAt: book.createdAt || null,
    adminFeedback: isSubmission ? book.adminFeedback || "" : "",
    reviewHistory: isSubmission ? book.reviewHistory || [] : [],
    manuscript: sanitizeFile(book.manuscript),
    coverImage: sanitizeFile(book.coverImage),
    publicationDate: book.publicationDate || null,
    publishedAt: book.publishedAt || null,
    publicationDetails: book.publicationDetails || null,
    mrp: book.mrp ?? null,
    totalCopiesSold: book.totalCopiesSold || 0,
    totalRoyaltyEarned: book.totalRoyaltyEarned || 0,
    royaltyPaid: book.royaltyPaid || 0,
    royaltyPending: book.royaltyPending || 0,
  };
}

function isOwner(book, user) {
  if (user.role === "admin") return true;
  if (book.ownerUserId) return book.ownerUserId === user.id;
  return Boolean(user.authorId && book.authorId === user.authorId);
}

function getUploadedFiles(req) {
  return req.files || {};
}

function firstUploaded(req, fieldName) {
  return getUploadedFiles(req)[fieldName]?.[0] || null;
}

function buildPrivateFile(file, fieldName) {
  if (!file) return undefined;
  return {
    ...toPrivateFile(file),
    mimeType: fieldName === "manuscript" && path.extname(file.originalname).toLowerCase() === ".pdf"
      ? "application/pdf"
      : file.mimetype,
  };
}

async function validateUploadedFiles(req) {
  const manuscript = firstUploaded(req, "manuscript");
  const cover = firstUploaded(req, "cover");
  if (manuscript && !(await validateFileSignature(manuscript, "manuscript"))) {
    return "Manuscript contents do not match a supported document format";
  }
  if (cover && !(await validateFileSignature(cover, "cover"))) {
    return "Cover image contents do not match the selected image format";
  }
  return "";
}

async function rejectUploadedFiles(req, res, status, message) {
  await removeUploadedFiles(getUploadedFiles(req));
  return res.status(status).json({ success: false, message });
}

router.post("/submissions", authMiddleware, requireAuthor, parseBookFiles, async (req, res) => {
  try {
    const validation = validateSubmissionFields(req.body);
    if (validation.error) return rejectUploadedFiles(req, res, 400, validation.error);
    if (!firstUploaded(req, "manuscript") || !firstUploaded(req, "cover")) {
      return rejectUploadedFiles(req, res, 400, "A PDF or DOCX manuscript and a cover image are required");
    }
    if (firstUploaded(req, "cover").size > MAX_COVER_SIZE) {
      return rejectUploadedFiles(req, res, 413, "Cover image exceeds the 5 MB size limit");
    }

    const fileError = await validateUploadedFiles(req);
    if (fileError) return rejectUploadedFiles(req, res, 400, fileError);
    if (firstUploaded(req, "cover")?.size > MAX_COVER_SIZE) {
      return rejectUploadedFiles(req, res, 413, "Cover image exceeds the 5 MB size limit");
    }

    const submissionDate = new Date();
    const book = await Book.create({
      bookId: `SUB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      ownerUserId: req.user.id,
      authorId: req.user.authorId,
      authorName: req.user.name,
      ...validation.data,
      manuscript: buildPrivateFile(firstUploaded(req, "manuscript"), "manuscript"),
      coverImage: buildPrivateFile(firstUploaded(req, "cover"), "cover"),
      submissionStatus: "Submitted",
      status: "Submitted",
      submissionDate,
      reviewHistory: [actorEntry("Submitted", req.user)],
      totalCopiesSold: 0,
      totalRoyaltyEarned: 0,
      royaltyPaid: 0,
      royaltyPending: 0,
    });

    return res.status(201).json({
      success: true,
      message: "Book submission received",
      data: sanitizeBook(book),
    });
  } catch (error) {
    await removeUploadedFiles(getUploadedFiles(req));
    console.error("Create book submission error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to submit this book" });
  }
});

router.get("/my-books", authMiddleware, requireAuthor, async (req, res) => {
  try {
    const books = await Book.find({
      authorId: req.user.authorId,
      $or: [
        { ownerUserId: req.user.id },
        { ownerUserId: null },
        { ownerUserId: { $exists: false } },
      ],
    }).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: books.length,
      data: books.map(sanitizeBook),
    });
  } catch (error) {
    console.error("Fetch books error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch books" });
  }
});

router.get("/submissions", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { search, status, genre } = req.query;
    const query = { submissionStatus: { $exists: true } };

    if (status && status !== "all") {
      if (!SUBMISSION_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: "Unsupported submission status" });
      }
      query.submissionStatus = status;
    }
    if (genre && genre !== "all") query.genre = genre;
    if (typeof search === "string" && search.trim()) {
      const term = escapeRegex(search.trim().slice(0, 100));
      query.$or = [
        { title: { $regex: term, $options: "i" } },
        { authorName: { $regex: term, $options: "i" } },
        { genre: { $regex: term, $options: "i" } },
      ];
    }

    const books = await Book.find(query).sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, count: books.length, data: books.map(sanitizeBook) });
  } catch (error) {
    console.error("List book submissions error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to fetch book submissions" });
  }
});

router.get("/:bookId/files/:fileType", authMiddleware, async (req, res) => {
  try {
    const { bookId, fileType } = req.params;
    if (!["manuscript", "cover"].includes(fileType)) {
      return res.status(400).json({ success: false, message: "Unsupported private file type" });
    }

    const book = await Book.findOne({ bookId });
    if (!book) return res.status(404).json({ success: false, message: "Book not found" });
    if (!isOwner(book, req.user)) {
      return res.status(403).json({ success: false, message: "You do not have access to this book" });
    }

    const file = book[fileType];
    if (!file?.storageName || path.basename(file.storageName) !== file.storageName) {
      return res.status(404).json({ success: false, message: "File not found" });
    }
    const absolutePath = path.join(PRIVATE_UPLOAD_DIR, file.storageName);
    if (!/^[0-9a-f-]{36}\.upload$/i.test(file.storageName)) {
      return res.status(404).json({ success: false, message: "File not found" });
    }
    await fs.promises.access(absolutePath, fs.constants.R_OK);

    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", file.mimeType);
    if (fileType === "manuscript" && file.mimeType !== "application/pdf") {
      res.setHeader("Content-Disposition", `attachment; filename="${path.basename(file.originalName).replace(/["\r\n]/g, "")}"`);
    } else {
      res.setHeader("Content-Disposition", "inline");
    }
    return res.sendFile(absolutePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({ success: false, message: "Stored file is unavailable" });
    }
    console.error("Fetch private book file error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to fetch private file" });
  }
});

router.get("/:bookId", authMiddleware, async (req, res) => {
  try {
    const book = await Book.findOne({ bookId: req.params.bookId });
    if (!book) return res.status(404).json({ success: false, message: "Book not found" });
    if (!isOwner(book, req.user)) {
      return res.status(403).json({ success: false, message: "You do not have access to this book" });
    }
    return res.status(200).json({ success: true, data: sanitizeBook(book) });
  } catch (error) {
    console.error("Fetch book submission error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to fetch this book" });
  }
});

router.patch("/:bookId", authMiddleware, requireAuthor, parseBookFiles, async (req, res) => {
  try {
    const book = await Book.findOne({ bookId: req.params.bookId });
    if (!book) return rejectUploadedFiles(req, res, 404, "Book not found");
    if (!isOwner(book, req.user)) return rejectUploadedFiles(req, res, 403, "You do not have access to this book");
    if (book.submissionStatus !== "Changes Requested") {
      return rejectUploadedFiles(req, res, 409, "Only submissions with requested changes can be edited");
    }

    const validation = validateSubmissionFields({
      title: req.body.title ?? book.title,
      subtitle: req.body.subtitle ?? book.subtitle,
      synopsis: req.body.synopsis ?? book.synopsis,
      genre: req.body.genre ?? book.genre,
      language: req.body.language ?? book.language,
      isbn: req.body.isbn ?? book.isbn,
    });
    if (validation.error) return rejectUploadedFiles(req, res, 400, validation.error);
    const fileError = await validateUploadedFiles(req);
    if (fileError) return rejectUploadedFiles(req, res, 400, fileError);

    const previousFiles = [
      firstUploaded(req, "manuscript") ? book.manuscript?.storageName : null,
      firstUploaded(req, "cover") ? book.coverImage?.storageName : null,
    ].filter(Boolean);
    Object.assign(book, validation.data);
    if (firstUploaded(req, "manuscript")) {
      book.manuscript = buildPrivateFile(firstUploaded(req, "manuscript"), "manuscript");
    }
    if (firstUploaded(req, "cover")) {
      book.coverImage = buildPrivateFile(firstUploaded(req, "cover"), "cover");
    }
    book.submissionStatus = "Under Review";
    book.status = "Under Review";
    book.adminFeedback = "";
    book.reviewHistory.push(actorEntry("Resubmitted", req.user));
    await book.save();
    try {
      await Promise.all(previousFiles.map((name) => fs.promises.rm(path.join(PRIVATE_UPLOAD_DIR, name), { force: true })));
    } catch (cleanupError) {
      console.error("Unable to remove replaced submission files:", cleanupError.message);
    }

    return res.status(200).json({ success: true, message: "Book changes resubmitted for review", data: sanitizeBook(book) });
  } catch (error) {
    await removeUploadedFiles(getUploadedFiles(req));
    console.error("Resubmit book error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to resubmit this book" });
  }
});

router.patch("/:bookId/review", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const book = await Book.findOne({ bookId: req.params.bookId });
    if (!book) return res.status(404).json({ success: false, message: "Book not found" });
    if (!["Submitted", "Under Review"].includes(book.submissionStatus)) {
      return res.status(409).json({ success: false, message: "This submission cannot be reviewed in its current status" });
    }

    const action = normalizeText(req.body.action);
    const feedback = normalizeText(req.body.feedback);
    if (!["Approved", "Rejected", "Changes Requested"].includes(action)) {
      return res.status(400).json({ success: false, message: "Unsupported review action" });
    }
    if (feedback.length > 4000) {
      return res.status(400).json({ success: false, message: "Review explanation exceeds 4000 characters" });
    }
    if (action !== "Approved" && !feedback) {
      return res.status(400).json({ success: false, message: "An explanation is required for this review action" });
    }

    book.submissionStatus = action;
    book.status = action;
    book.adminFeedback = feedback;
    book.reviewHistory.push(actorEntry(action, req.user, feedback));
    await book.save();
    return res.status(200).json({ success: true, message: `Book ${action.toLowerCase()}`, data: sanitizeBook(book) });
  } catch (error) {
    console.error("Review book submission error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to review this book" });
  }
});

router.patch("/:bookId/start-review", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const book = await Book.findOne({ bookId: req.params.bookId });
    if (!book) return res.status(404).json({ success: false, message: "Book not found" });
    if (book.submissionStatus !== "Submitted") {
      return res.status(409).json({ success: false, message: "Only newly submitted books can enter review" });
    }

    book.submissionStatus = "Under Review";
    book.status = "Under Review";
    book.reviewHistory.push(actorEntry("Under Review", req.user));
    await book.save();
    return res.status(200).json({ success: true, message: "Book review started", data: sanitizeBook(book) });
  } catch (error) {
    console.error("Start book review error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to start this review" });
  }
});

router.patch("/:bookId/publication-details", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const book = await Book.findOne({ bookId: req.params.bookId });
    if (!book) return res.status(404).json({ success: false, message: "Book not found" });
    if (!["Approved", "Publishing"].includes(book.submissionStatus)) {
      return res.status(409).json({ success: false, message: "Only approved, unpublished books can receive publication details" });
    }
    const validation = validatePublicationDetails(req.body);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });
    const isbn = normalizeText(req.body.isbn);
    if (isbn && !validateISBN(isbn)) {
      return res.status(400).json({ success: false, message: "ISBN must be a valid ISBN-10 or ISBN-13" });
    }

    book.publicationDate = validation.data.publicationDate;
    book.publicationDetails = { mrp: validation.data.mrp };
    book.mrp = validation.data.mrp;
    if (isbn) book.isbn = isbn;
    if (book.submissionStatus === "Approved") {
      book.submissionStatus = "Publishing";
      book.status = "Publishing";
    }
    book.reviewHistory.push(actorEntry("Publication Details Updated", req.user));
    await book.save();
    return res.status(200).json({ success: true, message: "Publication details saved", data: sanitizeBook(book) });
  } catch (error) {
    console.error("Save publication details error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to save publication details" });
  }
});

router.post("/:bookId/publish", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const book = await Book.findOne({ bookId: req.params.bookId });
    if (!book) return res.status(404).json({ success: false, message: "Book not found" });
    if (book.submissionStatus !== "Publishing") {
      return res.status(409).json({ success: false, message: "Publication details must be saved for an approved book before publishing" });
    }
    if (!book.publicationDate || !Number.isFinite(book.publicationDetails?.mrp) || book.publicationDetails.mrp <= 0) {
      return res.status(400).json({ success: false, message: "Required publication details are missing" });
    }
    if (book.isbn && !validateISBN(book.isbn)) {
      return res.status(400).json({ success: false, message: "Book ISBN is invalid" });
    }

    const publishedAt = new Date();
    book.submissionStatus = "Published";
    book.status = "Published";
    book.publishedAt = publishedAt;
    book.reviewHistory.push(actorEntry("Published", req.user));
    await book.save();
    return res.status(200).json({ success: true, message: "Book marked as published", data: sanitizeBook(book) });
  } catch (error) {
    console.error("Publish book error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to publish this book" });
  }
});

module.exports = router;
