const User = require("../models/User");
const { generateCaptcha, verifyCaptcha } = require("../utils/captcha");

const getStats = async (_req, res) => {
  try {
    const total = await User.countDocuments({ isDeleted: false });
    res.json({ registered: total });
  } catch {
    res.json({ registered: 0 });
  }
};

const getCaptcha = (req, res) => {
  const formId = req.query.form === "signup" ? "signup" : "login";
  const { question } = generateCaptcha(req, formId);
  res.json({ question });
};

const register = async (req, res) => {
  const { username, password, captchaAnswer } = req.body;

  if (!username || !password || captchaAnswer === undefined || captchaAnswer === "")
    return res.status(400).json({ error: "All fields are required." });

  const captchaOk = verifyCaptcha(req, captchaAnswer, "signup");
  if (!captchaOk)
    return res.status(400).json({ error: "Captcha answer is incorrect or expired. Try again." });

  if (username.length < 3 || username.length > 20)
    return res.status(400).json({ error: "Username must be 3–20 characters." });

  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters." });

  try {
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: "Username already taken." });

    const user = await User.create({ username, password });
    req.session.userId   = user._id.toString();
    req.session.username = user.username;
    res.status(201).json({ message: "Account created!", user });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error." });
  }
};

const login = async (req, res) => {
  const { username, password, captchaAnswer } = req.body;

  if (!username || !password || captchaAnswer === undefined || captchaAnswer === "")
    return res.status(400).json({ error: "All fields are required." });

  const captchaOk = verifyCaptcha(req, captchaAnswer, "login");
  if (!captchaOk)
    return res.status(400).json({ error: "Captcha answer is incorrect or expired. Try again." });

  try {
    const user = await User.findOne({ username, isDeleted: false });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials." });

    req.session.userId   = user._id.toString();
    req.session.username = user.username;
    res.json({ message: "Logged in!", user });
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

const logout = (req, res) => {
  req.session.destroy(() => res.json({ message: "Logged out." }));
};

const me = async (req, res) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated." });
    const user = await User.findById(req.session.userId).select("-password");
    if (!user) return res.status(401).json({ error: "Not authenticated." });
    res.json(user);
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

module.exports = { register, login, logout, me, getStats, getCaptcha };
