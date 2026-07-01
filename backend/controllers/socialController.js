const User = require("../models/User");
const Message = require("../models/Message");

const searchUsers = async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.json([]);
  try {
    const me = await User.findById(req.session.userId);
    const myBlockedIds = me.blocked.map((id) => id.toString());

    const users = await User.find({
      username: { $regex: q, $options: "i" },
      isDeleted: false,
      _id: { $ne: req.session.userId },
    })
      .select("username _id friends friendRequests blocked")
      .limit(10);

    const visible = users.filter((u) => {
      const theirBlockedIds = u.blocked.map((id) => id.toString());
      return !myBlockedIds.includes(u._id.toString()) && !theirBlockedIds.includes(req.session.userId);
    });

    res.json(visible.map((u) => ({ _id: u._id, username: u.username })));
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

const sendRequest = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target || target.isDeleted) return res.status(404).json({ error: "User not found." });

    const me = await User.findById(req.session.userId);
    if (me.friends.includes(target._id))
      return res.status(400).json({ error: "Already friends." });
    if (target.blocked.includes(me._id))
      return res.status(403).json({ error: "Cannot send request." });

    if (!target.friendRequests.includes(me._id)) {
      target.friendRequests.push(me._id);
      await target.save();
    }
    res.json({ message: "Friend request sent." });
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

const acceptRequest = async (req, res) => {
  try {
    const me = await User.findById(req.session.userId);
    const other = await User.findById(req.params.id);
    if (!other) return res.status(404).json({ error: "User not found." });

    me.friendRequests = me.friendRequests.filter((id) => id.toString() !== req.params.id);
    if (!me.friends.includes(other._id)) me.friends.push(other._id);
    if (!other.friends.includes(me._id)) other.friends.push(me._id);

    await Promise.all([me.save(), other.save()]);
    res.json({ message: "Friend added." });
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

const declineRequest = async (req, res) => {
  try {
    const me = await User.findById(req.session.userId);
    me.friendRequests = me.friendRequests.filter((id) => id.toString() !== req.params.id);
    await me.save();
    res.json({ message: "Request declined." });
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

const removeFriend = async (req, res) => {
  try {
    const me = await User.findById(req.session.userId);
    const other = await User.findById(req.params.id);

    me.friends = me.friends.filter((id) => id.toString() !== req.params.id);
    if (other) {
      other.friends = other.friends.filter((id) => id.toString() !== req.session.userId);
      await other.save();
    }
    await me.save();
    res.json({ message: "Friend removed." });
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

const blockUser = async (req, res) => {
  try {
    const me = await User.findById(req.session.userId);
    const targetId = req.params.id;

    me.friends = me.friends.filter((id) => id.toString() !== targetId);
    me.friendRequests = me.friendRequests.filter((id) => id.toString() !== targetId);
    if (!me.blocked.map((x) => x.toString()).includes(targetId)) me.blocked.push(targetId);

    await me.save();

    const other = await User.findById(targetId);
    if (other) {
      other.friends = other.friends.filter((id) => id.toString() !== req.session.userId);
      await other.save();
    }
    res.json({ message: "User blocked." });
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

const unblockUser = async (req, res) => {
  try {
    const me = await User.findById(req.session.userId);
    const targetId = req.params.id;

    me.blocked = me.blocked.filter((id) => id.toString() !== targetId);
    await me.save();

    res.json({ message: "User unblocked." });
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

const getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .populate("friends", "username _id")
      .populate("friendRequests", "username _id")
      .populate("blocked", "username _id");
    res.json({ friends: user.friends, requests: user.friendRequests, blocked: user.blocked });
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

const getMessages = async (req, res) => {
  try {
    const msgs = await Message.find({
      $or: [
        { from: req.session.userId, to: req.params.id },
        { from: req.params.id, to: req.session.userId },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate("from", "username")
      .populate("to", "username");
    res.json(msgs);
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

module.exports = { searchUsers, sendRequest, acceptRequest, declineRequest, removeFriend, blockUser, unblockUser, getFriends, getMessages };
