const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

const app = require("../server");
const User = require("../models/User");
const Book = require("../models/Book");
const Ticket = require("../models/Ticket");

function makeToken(user, expiresIn = "1h") {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn,
  });
}

function setUserStub(user) {
  User.findById = async (id) => {
    if (String(id) === String(user._id)) {
      const record = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        authorId: user.authorId,
      };
      record.select = function select() { return this; };
      return record;
    }
    return null;
  };
}

function withSelect(record) {
  if (!record) return record;
  record.select = function select() { return this; };
  return record;
}

function listTicketQuery(records) {
  return {
    sort: () => ({
      lean: async () => records,
    }),
  };
}

test("health endpoint returns ok", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.match(res.body.message, /BookLeaf backend is running/i);
});

test("missing login fields are rejected", async () => {
  const res = await request(app).post("/api/auth/login").send({ email: "" });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /required/i);
});

test("successful admin login returns token", async () => {
  const admin = {
    _id: "admin-user-id",
    name: "BookLeaf Admin",
    email: "admin@example.com",
    role: "admin",
    authorId: null,
    passwordHash: "hashed-password",
  };

  User.findOne = ({ email }) => (email === admin.email ? withSelect({ ...admin }) : null);
  bcrypt.compare = async () => true;
  setUserStub(admin);

  const res = await request(app).post("/api/auth/login").send({
    email: "admin@example.com",
    password: "valid-passphrase",
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.token);
  assert.equal(res.body.user.role, "admin");
});

test("successful author login returns token", async () => {
  const authorUser = {
    _id: "author-user-id",
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    role: "author",
    authorId: "AUTH001",
    passwordHash: "hashed-password",
  };

  User.findOne = ({ email }) => (email === authorUser.email ? withSelect({ ...authorUser }) : null);
  bcrypt.compare = async () => true;
  setUserStub(authorUser);

  const res = await request(app).post("/api/auth/login").send({
    email: "priya.sharma@email.com",
    password: "valid-passphrase",
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.role, "author");
  assert.equal(res.body.user.authorId, "AUTH001");
});

test("invalid password is rejected", async () => {
  const user = {
    _id: "author-user-id",
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    role: "author",
    authorId: "AUTH001",
    passwordHash: "hashed-password",
  };

  User.findOne = ({ email }) => (email === user.email ? withSelect({ ...user }) : null);
  bcrypt.compare = async () => false;

  const res = await request(app).post("/api/auth/login").send({
    email: user.email,
    password: "wrong-password",
  });

  assert.equal(res.status, 401);
  assert.match(res.body.message, /invalid|password/i);
});

test("missing or invalid token is rejected", async () => {
  const res = await request(app).get("/api/auth/me");
  assert.equal(res.status, 401);

  const invalidToken = await request(app)
    .get("/api/auth/me")
    .set("Authorization", "Bearer not-a-real-token");
  assert.equal(invalidToken.status, 401);
});

test("expired token is rejected", async () => {
  const expiredToken = jwt.sign({ sub: "expired-user-id", role: "author" }, process.env.JWT_SECRET, {
    expiresIn: "-1s",
  });

  const res = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${expiredToken}`);

  assert.equal(res.status, 401);
  assert.match(res.body.message, /invalid or expired token/i);
});

test("author ownership is enforced for author details", async () => {
  const author = { _id: "auth-record-id", authorId: "AUTH001", name: "Priya Sharma" };
  const user = { _id: "user-1", name: "Priya Sharma", email: "priya@email.com", role: "author", authorId: "AUTH002" };

  User.findById = async () => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    authorId: user.authorId,
  });

  const token = makeToken(user);

  const res = await request(app)
    .get("/api/authors/AUTH001")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 403);
  assert.match(res.body.message, /access/i);
});

test("admin-only routes are protected", async () => {
  const authorUser = {
    _id: "author-user-id",
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    role: "author",
    authorId: "AUTH001",
  };

  User.findById = async () => ({ ...authorUser });
  const token = makeToken(authorUser);

  const res = await request(app)
    .get("/api/authors")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 403);
  assert.match(res.body.message, /admin access required/i);
});

test("author dashboard statistics are computed from real book records", async () => {
  const user = {
    _id: "author-user-id",
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    role: "author",
    authorId: "AUTH001",
  };
  User.findById = async () => withSelect({ ...user });
  Book.find = () => ({
    lean: async () => [
      { totalCopiesSold: 50, totalRoyaltyEarned: 1800, royaltyPending: 400, royaltyPaid: 1400 },
      { totalCopiesSold: 25, totalRoyaltyEarned: 1200, royaltyPending: 200, royaltyPaid: 1000 },
    ],
  });

  const token = makeToken(user);
  const res = await request(app)
    .get("/api/dashboard/author")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.totalBooks, 2);
  assert.equal(res.body.data.copiesSold, 75);
  assert.equal(res.body.data.royaltyEarned, 3000);
});

test("author books endpoint returns only the current author records", async () => {
  const user = {
    _id: "author-user-id",
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    role: "author",
    authorId: "AUTH001",
  };

  User.findById = async () => withSelect({ ...user });
  Book.find = (query) => ({
    sort: () => [
      {
        bookId: "BK001",
        title: "Whispers of the Ganges",
        authorId: query.authorId,
        totalCopiesSold: 12,
        totalRoyaltyEarned: 420,
        royaltyPending: 80,
      },
    ],
  });

  const token = makeToken(user);
  const res = await request(app)
    .get("/api/books/my-books")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.data[0].authorId, "AUTH001");
});

test("ticket creation succeeds for authors", async () => {
  const user = {
    _id: "author-user-id",
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    role: "author",
    authorId: "AUTH001",
  };

  User.findById = async () => withSelect({ ...user });
  Ticket.create = async (payload) => ({
    _id: "ticket-1",
    ...payload,
    ticketId: "TCK-123",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const token = makeToken(user);
  const res = await request(app)
    .post("/api/tickets")
    .set("Authorization", `Bearer ${token}`)
    .send({
      subject: "Royalty payout delay",
      description: "My royalty payout was delayed for the last quarter.",
      category: "Royalty",
      priority: "High",
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.category, "Royalty");
});

test("my tickets listing and filters work", async () => {
  const user = {
    _id: "author-user-id",
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    role: "author",
    authorId: "AUTH001",
  };

  User.findById = async () => withSelect({ ...user });
  Ticket.find = () => ({
    sort: () => ({
      lean: async () => [
        {
          _id: "ticket-1",
          ticketId: "TCK-100",
          subject: "Royalty issue",
          description: "Need help with payout.",
          category: "Royalty",
          priority: "High",
          status: "Open",
          authorId: "AUTH001",
          authorName: "Priya Sharma",
          authorEmail: "priya.sharma@email.com",
          replies: [],
          auditTrail: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    }),
  });

  const token = makeToken(user);
  const res = await request(app)
    .get("/api/tickets/my-tickets")
    .query({ status: "Open", priority: "High" })
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.data[0].ticketId, "TCK-100");
});

test("unauthorized ticket access is rejected", async () => {
  const authorUser = {
    _id: "author-user-id",
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    role: "author",
    authorId: "AUTH001",
  };
  User.findById = async () => withSelect({ ...authorUser });
  Ticket.findOne = () => ({
    lean: async () => ({
      _id: "ticket-other",
      ticketId: "TCK-999",
      authorId: "AUTH002",
      subject: "Other ticket",
      description: "Not mine",
      category: "General",
      priority: "Medium",
      status: "Open",
      authorName: "Another Author",
      authorEmail: "other@example.com",
      replies: [],
      auditTrail: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  });

  const token = makeToken(authorUser);
  const res = await request(app)
    .get("/api/tickets/TCK-999")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 403);
  assert.match(res.body.message, /permission/i);
});

test("ticket reply creation works for authorized users", async () => {
  const user = {
    _id: "author-user-id",
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    role: "author",
    authorId: "AUTH001",
  };

  User.findById = async () => withSelect({ ...user });
  Ticket.findOne = () => ({
    _id: "ticket-1",
    ticketId: "TCK-123",
    authorId: "AUTH001",
    authorName: user.name,
    authorEmail: user.email,
    replies: [],
    auditTrail: [],
    save: async function save() { return this; },
  });

  const token = makeToken(user);
  const res = await request(app)
    .post("/api/tickets/TCK-123/replies")
    .set("Authorization", `Bearer ${token}`)
    .send({ message: "Thanks for checking this. I can provide the sales report." });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.match(res.body.data.message, /sales report/i);
});

test("ticket status change is validated", async () => {
  const adminUser = {
    _id: "admin-user-id",
    name: "Admin",
    email: "admin@example.com",
    role: "admin",
    authorId: null,
  };
  User.findById = async () => withSelect({ ...adminUser });
  Ticket.findOne = () => ({
    _id: "ticket-1",
    ticketId: "TCK-123",
    status: "Open",
    auditTrail: [],
    save: async function save() { return this; },
  });

  const token = makeToken(adminUser);
  const res = await request(app)
    .patch("/api/tickets/TCK-123/status")
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "Nope" });

  assert.equal(res.status, 400);
  assert.match(res.body.message, /unsupported ticket status/i);
});

test("admin assignment authorization works", async () => {
  const adminUser = {
    _id: "admin-user-id",
    name: "Admin",
    email: "admin@example.com",
    role: "admin",
    authorId: null,
  };
  User.findById = async () => withSelect({ ...adminUser });
  Ticket.findOne = () => ({
    _id: "ticket-1",
    ticketId: "TCK-123",
    assignedTo: null,
    assignedAgentName: null,
    auditTrail: [],
    save: async function save() { return this; },
  });

  const token = makeToken(adminUser);
  const res = await request(app)
    .patch("/api/tickets/TCK-123/assign")
    .set("Authorization", `Bearer ${token}`)
    .send({ assignedTo: "SUPPORT-01", assignedAgentName: "Kavya" });

  assert.equal(res.status, 200);
  assert.equal(res.body.message, "Ticket assigned");
});

test("ai fallback rules return a draft and priority", async () => {
  const adminUser = {
    _id: "admin-user-id",
    name: "Support Admin",
    email: "admin@example.com",
    role: "admin",
    authorId: null,
  };

  User.findById = async () => withSelect({ ...adminUser });

  const token = makeToken(adminUser);
  const priorityRes = await request(app)
    .post("/api/ai/priority")
    .set("Authorization", `Bearer ${token}`)
    .send({ subject: "Royalty payout missing", description: "I have not received my payout for the last quarter." });

  const draftRes = await request(app)
    .post("/api/ai/draft-response")
    .set("Authorization", `Bearer ${token}`)
    .send({
      subject: "Royalty payout missing",
      description: "I have not received my payout for the last quarter.",
      history: [],
    });

  assert.equal(priorityRes.status, 200);
  assert.equal(priorityRes.body.data.priority, "High");
  assert.equal(draftRes.status, 200);
  assert.match(draftRes.body.data.draft, /BookLeaf Support/i);
});

test("ai validation failure returns bad request", async () => {
  const adminUser = {
    _id: "admin-user-id",
    name: "Support Admin",
    email: "admin@example.com",
    role: "admin",
    authorId: null,
  };

  User.findById = async () => withSelect({ ...adminUser });
  const token = makeToken(adminUser);

  const res = await request(app)
    .post("/api/ai/classify-ticket")
    .set("Authorization", `Bearer ${token}`)
    .send({ subject: "", description: "" });

  assert.equal(res.status, 400);
  assert.match(res.body.message, /required/i);
});
