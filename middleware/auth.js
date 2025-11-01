const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Simple JWT based auth middleware for protecting private routes
module.exports = async function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization token missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user; // Attach the sanitized user for downstream handlers
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
