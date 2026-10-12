const express = require("express");
const crypto = require("crypto");
const Ticket = require("../models/Ticket");
const authMiddleware = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

const VALID_CATEGORIES = [
  "Royalty",
  "Publishing",
  "Book updates",
  "Distribution",
  "Account",
  "General",
];

const VALID_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

function fallbackClassify(subject, description) {
  const content = `${subject} ${description}`.toLowerCase();

  if (/(royalty|payout|payment|earnings|sales)/i.test(content)) return "Royalty";
  if (/(publish|launch|edition|metadata|cover|format|proof)/i.test(content)) return "Publishing";
  if (/(update|revise|correct|title|description|release|format)/i.test(content)) return "Book updates";
  if (/(distribution|retail|amazon|flipkart|stock|shipping|availability)/i.test(content)) return "Distribution";
  if (/(account|login|password|profile|email|access)/i.test(content)) return "Account";
  return "General";
}

function fallbackPriority(subject, description) {
  const content = `${subject} ${description}`.toLowerCase();
  if (/(urgent|blocked|payment not received|access denied|critical|breach|illegal)/i.test(content)) return "Urgent";
  if (/(high|deadline|urgent|royalty|refund|misprint|removed|missing)/i.test(content)) return "High";
  if (/(moderate|question|update|support|review|account)/i.test(content)) return "Medium";
  return "Low";
}

function fallbackDraft(ticket, history) {
  const greeting = ticket.authorName ? `Hi ${ticket.authorName},` : "Hi there,";
  const historyText = history.length
    ? `\n\nRecent updates:\n${history.slice(-2).map((entry) => `- ${entry.authorName}: ${entry.message}`).join("\n")}`
    : "";

  return `${greeting}\n\nThank you for reaching out about ${ticket.subject}. We have reviewed your request and are working to resolve it as quickly as possible. Our team will keep you updated as we progress on this case.${historyText}\n\nBest,\nBookLeaf Support`;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateAIInputs({ subject, description, history }) {
  const cleanSubject = normalizeString(subject);
  const cleanDescription = normalizeString(description);
  const cleanHistory = Array.isArray(history) ? history.slice(0, 5) : [];

  if (!cleanSubject || !cleanDescription) {
    throw new Error("Subject and description are required");
  }

  if (cleanSubject.length > 200 || cleanDescription.length > 5000) {
    throw new Error("Ticket content exceeds the supported input size");
  }

  return {
    subject: cleanSubject,
    description: cleanDescription,
    history: cleanHistory,
  };
}

router.post("/classify-ticket", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { subject, description } = validateAIInputs({ subject: req.body.subject, description: req.body.description, history: [] });

    const category = fallbackClassify(subject, description);

    return res.status(200).json({
      success: true,
      provider: "fallback",
      data: {
        category,
        confidence: "medium",
      },
    });
  } catch (error) {
    console.error("Classify ticket AI error:", error.message);
    return res.status(400).json({ success: false, message: error.message || "Unable to classify ticket" });
  }
});

router.post("/priority", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { subject, description } = validateAIInputs({ subject: req.body.subject, description: req.body.description, history: [] });
    const priority = fallbackPriority(subject, description); 

    return res.status(200).json({
      success: true,
      provider: "fallback",
      data: {
        priority,
        reason: "Rule-based triage used for this request",
      },
    });
  } catch (error) {
    console.error("AI priority error:", error.message);
    return res.status(400).json({ success: false, message: error.message || "Unable to determine ticket priority" });
  }
});

router.post("/draft-response", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { subject, description, history } = validateAIInputs({
      subject: req.body.subject,
      description: req.body.description,
      history: req.body.history,
    });

    const draft = fallbackDraft({ authorName: req.user.name, subject }, history || []);

    return res.status(200).json({
      success: true,
      provider: "fallback",
      data: {
        draft,
      },
    });
  } catch (error) {
    console.error("AI draft error:", error.message);
    return res.status(400).json({ success: false, message: error.message || "Unable to draft a response" });
  }
});

router.post("/:ticketId/ai-draft", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(req.params.ticketId)) {
      return res.status(400).json({ success: false, message: "Invalid ticket ID" });
    }

    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const history = Array.isArray(ticket.replies) ? ticket.replies : [];
    const draft = fallbackDraft(ticket, history);

    ticket.aiDraft = {
      message: draft,
      provider: "fallback",
      createdAt: new Date(),
    };

    await ticket.save();

    return res.status(200).json({
      success: true,
      provider: "fallback",
      data: {
        draft,
      },
    });
  } catch (error) {
    console.error("AI ticket draft error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to generate AI draft" });
  }
});

module.exports = router;
