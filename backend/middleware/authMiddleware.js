const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.slice(7).trim();
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not configured");
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.sub || decoded.userId || decoded.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found",
      });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      authorId: user.authorId,
    };

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    console.error("Authentication error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  next();
}

function requireAuthor(req, res, next) {
  if (req.user?.role !== "author") {
    return res.status(403).json({
      success: false,
      message: "Author access required",
    });
  }

  if (!req.user?.authorId) {
    return res.status(403).json({
      success: false,
      message: "Author profile is not linked to this account",
    });
  }

  next();
}

function requireOwnerOrAdmin(req, res, next) {
  const requestedAuthorId =
    req.params.authorId || req.query.authorId || req.body.authorId;

  const isAdmin = req.user?.role === "admin";
  const isOwnAuthor =
    req.user?.role === "author" &&
    req.user?.authorId &&
    req.user.authorId === requestedAuthorId;

  if (!isAdmin && !isOwnAuthor) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this author record",
    });
  }

  next();
}

module.exports = authMiddleware;
module.exports.requireAdmin = requireAdmin;
module.exports.requireAuthor = requireAuthor;
module.exports.requireOwnerOrAdmin = requireOwnerOrAdmin;
