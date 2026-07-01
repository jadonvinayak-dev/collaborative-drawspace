const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  if (req.headers["content-type"] === "application/json" || req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.redirect("/");
};

module.exports = { requireAuth };
