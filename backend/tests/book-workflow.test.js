const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const uploadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "bookleaf-book-workflow-"));
process.env.BOOK_UPLOAD_DIR = uploadDirectory;
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

const app = require("../server");
const User = require("../models/User");
const Book = require("../models/Book");

const users = [
  {
    _id: "author-one-user",
    name: "Asha Author",
    email: "asha@example.com",
    role: "author",
    authorId: "AUTH-ONE",
    passwordHash: "hashed",
  },
  {
    _id: "author-two-user",
    name: "Other Author",
    email: "other@example.com",
    role: "author",
    authorId: "AUTH-TWO",
    passwordHash: "hashed",
  },
  {
    _id: "admin-user",
    name: "BookLeaf Admin",
    email: "admin@example.com",
    role: "admin",
    authorId: null,
    passwordHash: "hashed",
  },
];
const records = new Map();

function tokenFor(user) {
  return jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

function copy(value) {
  return structuredClone(value);
}

function documentFor(record) {
  const document = copy(record);
  Object.defineProperty(document, "save", {
    value: async function save() {
      const stored = {};
      for (const [key, value] of Object.entries(this)) stored[key] = copy(value);
      records.set(this.bookId, stored);
      return this;
    },
  });
  return document;
}

function matches(record, query) {
  if (query.authorId && record.authorId !== query.authorId) return false;
  if (query.submissionStatus && typeof query.submissionStatus === "string" &&
      record.submissionStatus !== query.submissionStatus) return false;
  if (query.genre && record.genre !== query.genre) return false;
  if (query.submissionStatus?.$exists && !record.submissionStatus) return false;
  if (query.$or && !query.$or.some((filter) => {
    if ("ownerUserId" in filter) {
      if (filter.ownerUserId?.$exists === false) return !record.ownerUserId;
      return filter.ownerUserId === null
        ? !record.ownerUserId
        : record.ownerUserId === filter.ownerUserId;
    }
    const [field, expression] = Object.entries(filter)[0];
    return String(record[field] || "").toLowerCase().includes(expression.$regex.toLowerCase());
  })) return false;
  return true;
}

User.findById = async (id) => {
  const user = users.find((record) => record._id === String(id));
  return user ? { ...user, select() { return this; } } : null;
};
User.findOne = ({ email }) => {
  const user = users.find((record) => record.email === email);
  return {
    select() {
      return user ? { ...user, select() { return this; } } : null;
    },
  };
};
bcrypt.compare = async () => true;

Book.create = async (data) => {
  const record = {
    _id: `db-${data.bookId}`,
    ...copy(data),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  records.set(record.bookId, copy(record));
  return documentFor(record);
};
Book.find = (query) => ({
  sort() {
    return [...records.values()].filter((record) => matches(record, query)).map(copy);
  },
});
Book.findOne = async ({ bookId }) => {
  const record = records.get(bookId);
  return record ? documentFor(record) : null;
};

const authorToken = tokenFor(users[0]);
const secondAuthorToken = tokenFor(users[1]);
const adminToken = tokenFor(users[2]);
const manuscript = Buffer.from("%PDF-1.7\nBookLeaf manuscript test");
const cover = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

function validSubmission() {
  return {
    title: "The Lantern River",
    subtitle: "A novel",
    synopsis: "A young cartographer returns home to uncover a hidden river and a lost family story.",
    genre: "Literary fiction",
    language: "English",
    isbn: "",
  };
}

function attachValidFiles(req) {
  return req
    .attach("manuscript", manuscript, { filename: "lantern.pdf", contentType: "application/pdf" })
    .attach("cover", cover, { filename: "cover.png", contentType: "image/png" });
}

test.after(async () => {
  await fs.promises.rm(uploadDirectory, { recursive: true, force: true });
});

test("book submissions move through private review and explicit publication", async () => {
  const invalidMetadata = await attachValidFiles(
    request(app).post("/api/books/submissions")
      .set("Authorization", `Bearer ${authorToken}`),
  )
    .field("title", "Missing genre")
    .field("synopsis", "This synopsis is long enough to pass its own required length check.")
    .field("language", "English");
  assert.equal(invalidMetadata.status, 400);
  assert.match(invalidMetadata.body.message, /genre/i);
  assert.equal(records.size, 0);

  const invalidType = await request(app)
    .post("/api/books/submissions")
    .set("Authorization", `Bearer ${authorToken}`)
    .field("title", "Bad file")
    .attach("manuscript", Buffer.from("not a document"), {
      filename: "manuscript.txt",
      contentType: "text/plain",
    });
  assert.equal(invalidType.status, 400);

  const invalidSignature = await request(app)
    .post("/api/books/submissions")
    .set("Authorization", `Bearer ${authorToken}`)
    .field("title", "Forged PDF")
    .field("synopsis", validSubmission().synopsis)
    .field("genre", "Literary fiction")
    .field("language", "English")
    .attach("manuscript", Buffer.from("not a PDF"), {
      filename: "fake.pdf",
      contentType: "application/pdf",
    })
    .attach("cover", cover, { filename: "cover.png", contentType: "image/png" });
  assert.equal(invalidSignature.status, 400);
  assert.match(invalidSignature.body.message, /contents/i);
  assert.equal(records.size, 0);

  const invalidISBN = await attachValidFiles(
    request(app).post("/api/books/submissions")
      .set("Authorization", `Bearer ${authorToken}`),
  )
    .field("title", "Bad ISBN")
    .field("synopsis", validSubmission().synopsis)
    .field("genre", "Literary fiction")
    .field("language", "English")
    .field("isbn", "123");
  assert.equal(invalidISBN.status, 400);
  assert.match(invalidISBN.body.message, /ISBN/i);

  const oversizedCover = Buffer.alloc(5 * 1024 * 1024 + 1);
  cover.copy(oversizedCover);
  const oversizedUpload = request(app)
    .post("/api/books/submissions")
    .set("Authorization", `Bearer ${authorToken}`);
  for (const [key, value] of Object.entries(validSubmission())) {
    oversizedUpload.field(key, value);
  }
  const oversizedResponse = await oversizedUpload
    .attach("manuscript", manuscript, { filename: "lantern.pdf", contentType: "application/pdf" })
    .attach("cover", oversizedCover, { filename: "oversized.png", contentType: "image/png" });
  assert.equal(oversizedResponse.status, 413);

  const validRequest = request(app)
    .post("/api/books/submissions")
    .set("Authorization", `Bearer ${authorToken}`);
  for (const [key, value] of Object.entries(validSubmission())) {
    validRequest.field(key, value);
  }
  validRequest.field("authorId", "AUTH-TWO").field("authorName", "Spoofed Name");
  const created = await attachValidFiles(validRequest);

  assert.equal(created.status, 201);
  const bookId = created.body.data.bookId;
  assert.equal(created.body.data.submissionStatus, "Submitted");
  assert.equal(records.get(bookId).authorId, users[0].authorId);
  assert.equal(records.get(bookId).ownerUserId, users[0]._id);
  assert.equal(records.get(bookId).authorName, users[0].name);
  assert.equal(records.get(bookId).reviewHistory[0].action, "Submitted");
  assert.equal(records.get(bookId).manuscript.storageName.includes("/"), false);
  const privateFilePath = path.join(uploadDirectory, records.get(bookId).manuscript.storageName);
  assert.equal(fs.statSync(privateFilePath).mode & 0o777, 0o600);
  assert.equal(fs.statSync(uploadDirectory).mode & 0o777, 0o700);
  assert.equal((await request(app).get("/api/books/public")).status, 401);

  const authorFileResponse = await request(app)
    .get(`/api/books/${bookId}/files/manuscript`)
    .set("Authorization", `Bearer ${authorToken}`)
    .buffer(true)
    .parse((response, callback) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => callback(null, Buffer.concat(chunks)));
    });
  assert.equal(authorFileResponse.status, 200);
  assert.match(authorFileResponse.headers["cache-control"], /no-store/);
  assert.deepEqual(authorFileResponse.body, manuscript);

  const otherAuthorDetails = await request(app)
    .get(`/api/books/${bookId}`)
    .set("Authorization", `Bearer ${secondAuthorToken}`);
  assert.equal(otherAuthorDetails.status, 403);
  const otherAuthorFile = await request(app)
    .get(`/api/books/${bookId}/files/manuscript`)
    .set("Authorization", `Bearer ${secondAuthorToken}`);
  assert.equal(otherAuthorFile.status, 403);

  const authorReviewAttempt = await request(app)
    .patch(`/api/books/${bookId}/review`)
    .set("Authorization", `Bearer ${authorToken}`)
    .send({ action: "Approved" });
  assert.equal(authorReviewAttempt.status, 403);
  const authorPublishAttempt = await request(app)
    .post(`/api/books/${bookId}/publish`)
    .set("Authorization", `Bearer ${authorToken}`);
  assert.equal(authorPublishAttempt.status, 403);

  const startedReview = await request(app)
    .patch(`/api/books/${bookId}/start-review`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(startedReview.status, 200);
  assert.equal(startedReview.body.data.submissionStatus, "Under Review");

  const noFeedbackDecision = await request(app)
    .patch(`/api/books/${bookId}/review`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ action: "Changes Requested", feedback: " " });
  assert.equal(noFeedbackDecision.status, 400);

  const changesRequested = await request(app)
    .patch(`/api/books/${bookId}/review`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ action: "Changes Requested", feedback: "Please clarify the final chapter synopsis." });
  assert.equal(changesRequested.status, 200);
  assert.equal(changesRequested.body.data.submissionStatus, "Changes Requested");
  assert.equal(changesRequested.body.data.reviewHistory.at(-1).adminId, users[2]._id);
  assert.equal(changesRequested.body.data.adminFeedback, "Please clarify the final chapter synopsis.");

  const resubmitted = await request(app)
    .patch(`/api/books/${bookId}`)
    .set("Authorization", `Bearer ${authorToken}`)
    .field("title", "The Lantern River: Revised")
    .field("subtitle", "A novel")
    .field("synopsis", validSubmission().synopsis)
    .field("genre", "Literary fiction")
    .field("language", "English");
  assert.equal(resubmitted.status, 200);
  assert.equal(resubmitted.body.data.submissionStatus, "Under Review");
  assert.equal(resubmitted.body.data.adminFeedback, "");
  assert.equal(resubmitted.body.data.reviewHistory.at(-1).action, "Resubmitted");

  const approval = await request(app)
    .patch(`/api/books/${bookId}/review`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ action: "Approved", feedback: "" });
  assert.equal(approval.status, 200);
  assert.equal(approval.body.data.submissionStatus, "Approved");
  assert.equal(records.get(bookId).publishedAt ?? null, null);

  const notYetPublic = await request(app).get("/api/books/public");
  assert.equal(notYetPublic.status, 401);
  const authorBooksAfterApproval = await request(app)
    .get("/api/books/my-books")
    .set("Authorization", `Bearer ${authorToken}`);
  assert.equal(authorBooksAfterApproval.status, 200);
  assert.equal(authorBooksAfterApproval.body.data[0].submissionStatus, "Approved");
  assert.equal(authorBooksAfterApproval.body.data[0].publishedAt, null);

  const prematurePublish = await request(app)
    .post(`/api/books/${bookId}/publish`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(prematurePublish.status, 409);
  const malformedPublication = await request(app)
    .patch(`/api/books/${bookId}/publication-details`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ publicationDate: "", mrp: 0 });
  assert.equal(malformedPublication.status, 400);

  const publicationDetails = await request(app)
    .patch(`/api/books/${bookId}/publication-details`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ publicationDate: "2026-11-15", mrp: 599, isbn: "" });
  assert.equal(publicationDetails.status, 200);
  assert.equal(publicationDetails.body.data.submissionStatus, "Publishing");

  const correctedPublicationDetails = await request(app)
    .patch(`/api/books/${bookId}/publication-details`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ publicationDate: "2026-11-15", mrp: 650, isbn: "" });
  assert.equal(correctedPublicationDetails.status, 200);
  assert.equal(correctedPublicationDetails.body.data.publicationDetails.mrp, 650);

  const publish = await request(app)
    .post(`/api/books/${bookId}/publish`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(publish.status, 200);
  assert.equal(publish.body.data.submissionStatus, "Published");
  assert.ok(publish.body.data.publishedAt);
  assert.equal(publish.body.data.publicationDetails.mrp, 650);
  assert.equal(records.get(bookId).reviewHistory.at(-1).action, "Published");

  const newLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: users[0].email, password: "valid-password" });
  assert.equal(newLogin.status, 200);
  const refreshedBooks = await request(app)
    .get("/api/books/my-books")
    .set("Authorization", `Bearer ${newLogin.body.token}`);
  assert.equal(refreshedBooks.status, 200);
  assert.equal(refreshedBooks.body.data[0].submissionStatus, "Published");
  assert.ok(refreshedBooks.body.data[0].publishedAt);
  assert.equal(refreshedBooks.body.data[0].publicationDate, "2026-11-15T00:00:00.000Z");
  assert.equal(refreshedBooks.body.data[0].publicationDetails.mrp, 650);

  const adminQueue = await request(app)
    .get("/api/books/submissions")
    .query({ search: "Lantern", status: "Published", genre: "Literary fiction" })
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(adminQueue.status, 200);
  assert.equal(adminQueue.body.data.length, 1);
});
