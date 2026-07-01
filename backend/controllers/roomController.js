const { v4: uuidv4 } = require("uuid");
const Room = require("../models/Room");

const createRoom = async (req, res) => {
  try {
    const roomId = uuidv4();
    const room = await Room.create({ roomId, owner: req.session.userId, members: [req.session.userId] });
    res.json({ roomId: room.roomId });
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

const getRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId }).populate("members", "username");
    if (!room) return res.status(404).json({ error: "Room not found." });
    res.json(room);
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

const saveSnapshot = async (req, res) => {
  const { snapshot } = req.body;
  try {
    await Room.findOneAndUpdate({ roomId: req.params.roomId }, { snapshot });
    res.json({ message: "Snapshot saved." });
  } catch {
    res.status(500).json({ error: "Server error." });
  }
};

module.exports = { createRoom, getRoom, saveSnapshot };
