const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

const app = require("../server");
const User = require("../models/User");
const Ticket = require("../models/Ticket");

function makeToken(user) {
  return jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

function clone(value) {
  return structuredClone(value);
}

test("AI ticket replies are persisted, authorized, and visible to the author after login", async () => {
  const users = [
    {
      _id: "author-user-id",
      name: "Priya Sharma",
      email: "priya@example.com",
      role: "author",
      authorId: "AUTH001",
      passwordHash: "hashed-password",
    },
    {
      _id: "admin-user-id",
      name: "Support Admin",
      email: "admin@example.com",
      role: "admin",
      authorId: null,
      passwordHash: "hashed-password",
    },
    {
      _id: "other-author-user-id",
      name: "Other Author",
      email: "other@example.com",
      role: "author",
      authorId: "AUTH002",
      passwordHash: "hashed-password",
    },
  ];
  const tickets = new Map();
  const getUser = (id) => users.find((user) => user._id === String(id));

  User.findById = async (id) => {
    const user = getUser(id);
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

  function makeTicketDocument(ticket) {
    const document = clone(ticket);
    Object.defineProperty(document, "save", {
      value: async function save() {
        const persisted = { ...this };
        delete persisted.save;
        tickets.set(this.ticketId, clone(persisted));
        return this;
      },
    });
    return document;
  }

  Ticket.create = async (payload) => {
    const ticket = {
      _id: "database-ticket-id",
      ...payload,
      aiDraft: null,
      replies: [],
      auditTrail: clone(payload.auditTrail || []),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    tickets.set(ticket.ticketId, clone(ticket));
    return makeTicketDocument(ticket);
  };
  Ticket.findOne = ({ ticketId }) => {
    const ticket = tickets.get(ticketId);
    return {
      lean: async () => (ticket ? clone(ticket) : null),
      then(resolve, reject) {
        return Promise.resolve(ticket ? makeTicketDocument(ticket) : null).then(resolve, reject);
      },
    };
  };
  Ticket.find = (query) => ({
    sort() {
      return {
        lean: async () => [...tickets.values()]
          .filter((ticket) => ticket.authorId === query.authorId)
          .map(clone),
      };
    },
  });

  const author = users[0];
  const admin = users[1];
  const otherAuthor = users[2];
  const authorToken = makeToken(author);
  const adminToken = makeToken(admin);

  const createResponse = await request(app)
    .post("/api/tickets")
    .set("Authorization", `Bearer ${authorToken}`)
    .send({
      subject: "Royalty payout delay",
      description: "My latest payout has not arrived.",
      category: "Royalty",
      priority: "High",
      authorId: "AUTH002",
      authorRole: "admin",
    });

  assert.equal(createResponse.status, 201);
  const ticketId = createResponse.body.data.ticketId;
  assert.equal(tickets.get(ticketId).authorId, author.authorId);

  const draftResponse = await request(app)
    .post(`/api/ai/${ticketId}/ai-draft`)
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(draftResponse.status, 200);
  const generatedDraft = draftResponse.body.data.draft;
  assert.ok(generatedDraft);
  assert.equal(tickets.get(ticketId).replies.length, 0);
  assert.equal(tickets.get(ticketId).aiDraft.message, generatedDraft);

  const draftVisibleToAuthor = await request(app)
    .get(`/api/tickets/${ticketId}`)
    .set("Authorization", `Bearer ${authorToken}`);
  assert.equal(draftVisibleToAuthor.status, 200);
  assert.equal(draftVisibleToAuthor.body.data.aiDraft, undefined);
  assert.equal(draftVisibleToAuthor.body.data.replies.length, 0);

  const replyRequestId = "admin-reply-request-001";
  const sendResponse = await request(app)
    .post(`/api/tickets/${ticketId}/replies`)
    .set("Authorization", `Bearer ${adminToken}`)
    .set("Idempotency-Key", replyRequestId)
    .send({
      message: generatedDraft,
      authorId: "AUTH002",
      authorName: "Spoofed Sender",
      authorRole: "author",
    });

  assert.equal(sendResponse.status, 201);
  const savedTicket = tickets.get(ticketId);
  assert.equal(savedTicket.replies.length, 1);
  assert.equal(savedTicket.replies[0].message, generatedDraft);
  assert.equal(savedTicket.replies[0].authorId, admin._id);
  assert.equal(savedTicket.replies[0].authorName, admin.name);
  assert.equal(savedTicket.replies[0].authorRole, "admin");
  assert.ok(savedTicket.replies[0].createdAt instanceof Date);
  assert.equal(savedTicket.aiDraft, null);

  const duplicateResponse = await request(app)
    .post(`/api/tickets/${ticketId}/replies`)
    .set("Authorization", `Bearer ${adminToken}`)
    .set("Idempotency-Key", replyRequestId)
    .send({ message: generatedDraft });
  assert.equal(duplicateResponse.status, 200);
  assert.equal(tickets.get(ticketId).replies.length, 1);

  const authorDetails = await request(app)
    .get(`/api/tickets/${ticketId}`)
    .set("Authorization", `Bearer ${authorToken}`);
  assert.equal(authorDetails.status, 200);
  assert.equal(authorDetails.body.data.replies[0].message, generatedDraft);
  assert.equal(authorDetails.body.data.replies[0].authorRole, "admin");

  const authorList = await request(app)
    .get("/api/tickets/my-tickets")
    .set("Authorization", `Bearer ${authorToken}`);
  assert.equal(authorList.status, 200);
  assert.equal(authorList.body.data[0].replies[0].message, generatedDraft);
  assert.equal(authorList.body.data[0].aiDraft, undefined);

  const emptyReply = await request(app)
    .post(`/api/tickets/${ticketId}/replies`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ message: "  " });
  assert.equal(emptyReply.status, 400);

  const invalidTicketId = await request(app)
    .get("/api/tickets/%20")
    .set("Authorization", `Bearer ${authorToken}`);
  assert.equal(invalidTicketId.status, 400);

  const loginResponse = await request(app)
    .post("/api/auth/login")
    .send({ email: author.email, password: "valid-password" });
  assert.equal(loginResponse.status, 200);

  const afterLoginAndRefresh = await request(app)
    .get(`/api/tickets/${ticketId}`)
    .set("Authorization", `Bearer ${loginResponse.body.token}`);
  assert.equal(afterLoginAndRefresh.status, 200);
  assert.equal(afterLoginAndRefresh.body.data.replies[0].message, generatedDraft);

  const otherAuthorToken = makeToken(otherAuthor);
  const forbiddenDetails = await request(app)
    .get(`/api/tickets/${ticketId}`)
    .set("Authorization", `Bearer ${otherAuthorToken}`);
  assert.equal(forbiddenDetails.status, 403);

  const forbiddenReplies = await request(app)
    .get(`/api/tickets/${ticketId}/replies`)
    .set("Authorization", `Bearer ${otherAuthorToken}`);
  assert.equal(forbiddenReplies.status, 403);

  const authorDraftAttempt = await request(app)
    .post(`/api/ai/${ticketId}/ai-draft`)
    .set("Authorization", `Bearer ${authorToken}`);
  assert.equal(authorDraftAttempt.status, 403);

  const authorSpoofAttempt = await request(app)
    .post(`/api/tickets/${ticketId}/replies`)
    .set("Authorization", `Bearer ${authorToken}`)
    .send({
      message: "A follow-up from the author.",
      authorId: admin._id,
      authorName: admin.name,
      authorRole: "admin",
    });
  assert.equal(authorSpoofAttempt.status, 201);
  const savedAuthorReply = tickets.get(ticketId).replies[1];
  assert.equal(savedAuthorReply.authorId, author._id);
  assert.equal(savedAuthorReply.authorRole, "author");
});
