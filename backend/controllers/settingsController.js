const User = require("../models/User");

const updateSettings = async (req, res) => {
  const { username, theme } = req.body;
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    if (username && username !== user.username) {
      if (username.length < 3 || username.length > 20)
        return res.status(400).json({ error: "Username must be 3–20 characters." });
      const taken = await User.findOne({ username });
      if (taken) return res.status(409).json({ error: "Username already taken." });
      user.username = username;
      req.session.username = username;
    }

    if (theme && ["light", "dark"].includes(theme)) user.theme = theme;

    await user.save();
    res.json({ message: "Settings saved.", user });
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

const deleteAccount = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.session.userId);
    req.session.destroy(() => res.json({ message: "Account deleted." }));
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

module.exports = { updateSettings, deleteAccount };
