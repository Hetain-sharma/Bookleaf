const express = require("express");
const crypto = require("crypto");
const Ticket = require("../models/Ticket");
const authMiddleware = require("../middleware/authMiddleware");
const { requireAdmin, requireAuthor } = require("../middleware/authMiddleware");

const router = express.Router();

const STATUS_ORDER = {
  Open: 0,
  "In progress": 1,
  "Waiting for author": 2,
  Resolved: 3,
  Closed: 4,
};

const VALID_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const VALID_CATEGORIES = [
  "Royalty",
  "Publishing",
  "Book updates",
  "Distribution",
  "Account",
  "General",
];
const VALID_STATUSES = Object.keys(STATUS_ORDER);

router.param("ticketId", (req, res, next, ticketId) => {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(ticketId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ticket ID",
    });
  }

  next();
});

function buildTicketPayload(payload) {
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const category = typeof payload.category === "string" ? payload.category.trim() : "";
  const priority = typeof payload.priority === "string" ? payload.priority.trim() : "Medium";

  return {
    subject,
    description,
    category,
    priority,
  };
}

function sanitizeReply(reply) {
  return {
    id: reply._id?.toString(),
    authorId: reply.authorId,
    authorName: reply.authorName,
    authorRole: reply.authorRole,
    message: reply.message,
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
  };
}

function sanitizeTicket(ticket, includeInternal = false) {
  if (!ticket) return null;

  const sanitized = {
    id: ticket._id.toString(),
    ticketId: ticket.ticketId,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    authorId: ticket.authorId,
    authorName: ticket.authorName,
    authorEmail: ticket.authorEmail,
    assignedTo: ticket.assignedTo,
    assignedAgentName: ticket.assignedAgentName,
    replies: (ticket.replies || []).map(sanitizeReply),
    resolution: ticket.resolution,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };

  if (includeInternal) {
    sanitized.aiDraft = ticket.aiDraft;
    sanitized.auditTrail = ticket.auditTrail || [];
  }

  return sanitized;
}

function isTicketAccessibleForUser(ticket, user) {
  if (!ticket) return false;
  if (user.role === "admin") return true;
  return user.authorId && ticket.authorId === user.authorId;
}

function recordAudit(ticket, action, actor, details = {}) {
  ticket.auditTrail = ticket.auditTrail || [];
  ticket.auditTrail.push({
    action,
    actorId: actor?.id || null,
    actorName: actor?.name || null,
    details,
    createdAt: new Date(),
  });
}

router.post("/", authMiddleware, requireAuthor, async (req, res) => {
  try {
    const payload = buildTicketPayload(req.body);

    if (!payload.subject || !payload.description) {
      return res.status(400).json({
        success: false,
        message: "Ticket subject and description are required",
      });
    }

    if (!VALID_CATEGORIES.includes(payload.category)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported ticket category",
      });
    }

    if (payload.priority && !VALID_PRIORITIES.includes(payload.priority)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported priority",
      });
    }

    const ticketId = `TCK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const ticket = await Ticket.create({
      ticketId,
      subject: payload.subject,
      description: payload.description,
      category: payload.category,
      priority: payload.priority || "Medium",
      authorId: req.user.authorId,
      authorName: req.user.name,
      authorEmail: req.user.email,
      status: "Open",
      assignedTo: null,
      assignedAgentName: null,
      auditTrail: [{
        action: "Ticket created",
        actorId: req.user.id,
        actorName: req.user.name,
        details: { source: "author portal" },
        createdAt: new Date(),
      }],
    });

    return res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      data: sanitizeTicket(ticket),
    });
  } catch (error) {
    console.error("Create ticket error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to create ticket",
    });
  }
});

router.get("/my-tickets", authMiddleware, requireAuthor, async (req, res) => {
  try {
    const { status, priority, search, sort = "newest" } = req.query;
    const query = { authorId: req.user.authorId };

    if (status && status !== "all") {
      query.status = status;
    }

    if (priority && priority !== "all") {
      query.priority = priority;
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      query.$or = [
        { subject: { $regex: term, $options: "i" } },
        { description: { $regex: term, $options: "i" } },
      ];
    }

    const sortConfig = sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
    const tickets = await Ticket.find(query).sort(sortConfig).lean();

    return res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets.map((ticket) => sanitizeTicket(ticket)),
    });
  } catch (error) {
    console.error("List my tickets error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch your tickets",
    });
  }
});

router.get("/stats", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const [open, inProgress, waiting, resolved, closed, unassigned] = await Promise.all([
      Ticket.countDocuments({ status: "Open" }),
      Ticket.countDocuments({ status: "In progress" }),
      Ticket.countDocuments({ status: "Waiting for author" }),
      Ticket.countDocuments({ status: "Resolved" }),
      Ticket.countDocuments({ status: "Closed" }),
      Ticket.countDocuments({ assignedTo: null }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        open,
        inProgress,
        waiting,
        resolved,
        closed,
        unassigned,
      },
    });
  } catch (error) {
    console.error("Ticket stats error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch ticket statistics",
    });
  }
});

router.get("/", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      search,
      sort = "newest",
      authorId,
    } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(50, Math.max(1, Number(limit) || 20));
    const skip = (pageNumber - 1) * limitNumber;

    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (priority && priority !== "all") {
      query.priority = priority;
    }

    if (authorId && authorId !== "all") {
      query.authorId = authorId;
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      query.$or = [
        { subject: { $regex: term, $options: "i" } },
        { description: { $regex: term, $options: "i" } },
        { ticketId: { $regex: term, $options: "i" } },
        { authorName: { $regex: term, $options: "i" } },
      ];
    }

    const sortConfig = sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
    const [tickets, total] = await Promise.all([
      Ticket.find(query).sort(sortConfig).skip(skip).limit(limitNumber).lean(),
      Ticket.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: tickets.map((ticket) => sanitizeTicket(ticket, true)),
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.max(1, Math.ceil(total / limitNumber)),
      },
    });
  } catch (error) {
    console.error("Admin ticket queue error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch ticket queue",
    });
  }
});

router.get("/:ticketId/replies", authMiddleware, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId }).lean();

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    if (!isTicketAccessibleForUser(ticket, req.user)) {
      return res.status(403).json({ success: false, message: "You do not have permission to view this ticket" });
    }

    return res.status(200).json({
      success: true,
      data: {
        ticket: sanitizeTicket(ticket, req.user.role === "admin"),
        replies: (ticket.replies || []).map(sanitizeReply),
      },
    });
  } catch (error) {
    console.error("Fetch ticket replies error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to fetch ticket conversation" });
  }
});

router.post("/:ticketId/replies", authMiddleware, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    if (!isTicketAccessibleForUser(ticket, req.user)) {
      return res.status(403).json({ success: false, message: "You do not have permission to reply to this ticket" });
    }

    const clientMessageId = req.get("Idempotency-Key")?.trim();
    if (clientMessageId && !/^[A-Za-z0-9_-]{8,100}$/.test(clientMessageId)) {
      return res.status(400).json({ success: false, message: "Invalid reply request ID" });
    }

    if (clientMessageId) {
      const existingReply = (ticket.replies || []).find(
        (reply) => reply.clientMessageId === clientMessageId,
      );

      if (existingReply) {
        return res.status(200).json({
          success: true,
          message: "Reply already added",
          data: sanitizeReply(existingReply),
        });
      }
    }

    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";

    if (!message) {
      return res.status(400).json({ success: false, message: "Reply message is required" });
    }

    if (message.length > 4000) {
      return res.status(400).json({ success: false, message: "Reply message exceeds 4000 characters" });
    }

    const reply = {
      authorId: req.user.id,
      authorName: req.user.name,
      authorRole: req.user.role,
      ...(clientMessageId ? { clientMessageId } : {}),
      message,
      createdAt: new Date(),
    };

    ticket.replies.push(reply);
    const savedReply = ticket.replies[ticket.replies.length - 1];
    if (req.user.role === "admin") {
      ticket.aiDraft = null;
    }
    recordAudit(ticket, "Reply added", req.user, { messagePreview: message.slice(0, 80) });
    await ticket.save();

    return res.status(201).json({
      success: true,
      message: "Reply added",
      data: sanitizeReply(savedReply),
    });
  } catch (error) {
    console.error("Add ticket reply error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to save reply" });
  }
});

router.patch("/:ticketId/status", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const previousStatus = ticket.status;
    const nextStatus = typeof req.body.status === "string" ? req.body.status.trim() : "";
    if (!VALID_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ success: false, message: "Unsupported ticket status" });
    }

    ticket.status = nextStatus;
    recordAudit(ticket, "Status changed", req.user, { from: previousStatus, to: nextStatus });
    ticket.updatedAt = new Date();
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: "Ticket status updated",
      data: sanitizeTicket(ticket, true),
    });
  } catch (error) {
    console.error("Update ticket status error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update ticket status" });
  }
});

router.patch("/:ticketId/assign", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const assignedTo = typeof req.body.assignedTo === "string" ? req.body.assignedTo.trim() : "";
    const assignedAgentName = typeof req.body.assignedAgentName === "string" ? req.body.assignedAgentName.trim() : "Support team";

    if (!assignedTo) {
      return res.status(400).json({ success: false, message: "An assignee identifier is required" });
    }

    ticket.assignedTo = assignedTo;
    ticket.assignedAgentName = assignedAgentName;
    recordAudit(ticket, "Assigned support agent", req.user, { assignedTo, assignedAgentName });
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: "Ticket assigned",
      data: sanitizeTicket(ticket, true),
    });
  } catch (error) {
    console.error("Assign ticket error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to assign ticket" });
  }
});

router.patch("/:ticketId/priority", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const nextPriority = typeof req.body.priority === "string" ? req.body.priority.trim() : "";
    if (!VALID_PRIORITIES.includes(nextPriority)) {
      return res.status(400).json({ success: false, message: "Unsupported priority" });
    }

    ticket.priority = nextPriority;
    recordAudit(ticket, "Priority changed", req.user, { from: ticket.priority, to: nextPriority });
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: "Ticket priority updated",
      data: sanitizeTicket(ticket, true),
    });
  } catch (error) {
    console.error("Update ticket priority error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update ticket priority" });
  }
});

router.get("/:ticketId", authMiddleware, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId }).lean();

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    if (!isTicketAccessibleForUser(ticket, req.user)) {
      return res.status(403).json({ success: false, message: "You do not have permission to access this ticket" });
    }

    return res.status(200).json({
      success: true,
      data: sanitizeTicket(ticket, req.user.role === "admin"),
    });
  } catch (error) {
    console.error("Fetch ticket error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to fetch ticket" });
  }
});

module.exports = router;
