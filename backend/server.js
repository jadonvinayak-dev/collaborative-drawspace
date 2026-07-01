require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const session = require("express-session");
const { Server } = require("socket.io");
const RedisStore = require("connect-redis").default;

const connectDB = require("./config/db");
const redisClient = require("./config/redis");
const Message = require("./models/Message");
const User = require("./models/User");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", credentials: true } });

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || "dev_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: false,
    sameSite: "lax",
  },
});
app.use(sessionMiddleware);

io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});

app.use(express.static(path.join(__dirname, "../frontend/public")));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/social", require("./routes/social"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/room", require("./routes/room"));

const PAGES = ["dashboard", "board", "social", "settings"];
const sendPage = (page) => (_, res) =>
  res.sendFile(path.join(__dirname, `../frontend/views/${page}.html`));

app.get("/", sendPage("index"));
PAGES.forEach((p) => app.get(`/${p}`, sendPage(p)));

const connectedUsers = new Map();

const broadcastActiveCount = () => {
  const unique = new Set([...connectedUsers.values()].map((u) => u.userId));
  io.emit("activeUsers", unique.size);
};

io.on("connection", (socket) => {
  const sess = socket.request.session;
  if (!sess?.userId) return socket.disconnect();

  const userId = sess.userId;
  const username = sess.username;
  connectedUsers.set(socket.id, { userId, username });
  broadcastActiveCount();

  socket.on("joinRoom", ({ roomId }) => {
    const usersInRoom = [...connectedUsers.values()].filter((u) => u.roomId === roomId);
    if (usersInRoom.length >= 5) {
      socket.emit("roomFull");
      return;
    }
    connectedUsers.set(socket.id, { userId, username, roomId });
    socket.join(roomId);

    const members = [...connectedUsers.values()]
      .filter((u) => u.roomId === roomId)
      .map((u) => ({ userId: u.userId, username: u.username }));
    io.to(roomId).emit("roomMembers", members);
  });

  socket.on("leaveRoom", ({ roomId }) => {
    socket.leave(roomId);
    connectedUsers.set(socket.id, { userId, username });
    const members = [...connectedUsers.values()]
      .filter((u) => u.roomId === roomId)
      .map((u) => ({ userId: u.userId, username: u.username }));
    io.to(roomId).emit("roomMembers", members);
  });

  socket.on("draw", (data) => {
    if (!data.roomId) return;
    socket.to(data.roomId).emit("draw", data);
  });

  socket.on("hlStart", (data) => {
    if (!data.roomId) return;
    socket.to(data.roomId).emit("hlStart", { ...data, userId });
  });

  socket.on("hlMove", (data) => {
    if (!data.roomId) return;
    socket.to(data.roomId).emit("hlMove", { ...data, userId });
  });

  socket.on("hlEnd", (data) => {
    if (!data.roomId) return;
    socket.to(data.roomId).emit("hlEnd", { ...data, userId });
  });

  socket.on("clear", ({ roomId }) => {
    socket.to(roomId).emit("clear");
  });

  socket.on("cursor", (data) => {
    if (!data.roomId) return;
    socket.to(data.roomId).emit("cursor", { ...data, userId, username });
  });

  socket.on("sendMessage", async ({ toUserId, text }) => {
    if (!text?.trim() || !toUserId) return;
    try {
      const msg = await Message.create({ from: userId, to: toUserId, text: text.trim() });
      await msg.populate(["from", "to"]);

      socket.emit("newMessage", msg);

      for (const [sid, u] of connectedUsers.entries()) {
        if (u.userId === toUserId) io.to(sid).emit("newMessage", msg);
      }
    } catch {}
  });

  socket.on("getOnlineFriends", async () => {
    try {
      const me = await User.findById(userId).populate("friends", "username _id");
      const onlineIds = new Set([...connectedUsers.values()].map((u) => u.userId));
      const online = (me?.friends || [])
        .filter((f) => onlineIds.has(f._id.toString()))
        .map((f) => ({ userId: f._id.toString(), username: f.username }));
      socket.emit("onlineFriends", online);
    } catch {
      socket.emit("onlineFriends", []);
    }
  });

  socket.on("boardInvite", async ({ toUserId, roomId }) => {
    if (!toUserId || !roomId) return;
    try {
      const me = await User.findById(userId);
      if (!me?.friends?.map((f) => f.toString()).includes(toUserId)) return;

      const targetSockets = [...connectedUsers.entries()].filter(([, u]) => u.userId === toUserId);
      if (!targetSockets.length) {
        socket.emit("boardInviteFailed", { reason: "Friend is offline." });
        return;
      }

      targetSockets.forEach(([sid]) => {
        io.to(sid).emit("boardInviteReceived", { fromUserId: userId, fromUsername: username, roomId });
      });
    } catch {}
  });

  socket.on("boardInviteResponse", ({ toUserId, roomId, accepted }) => {
    if (!toUserId || !roomId) return;
    const targetSockets = [...connectedUsers.entries()].filter(([, u]) => u.userId === toUserId);
    targetSockets.forEach(([sid]) => {
      io.to(sid).emit("boardInviteResponse", { fromUserId: userId, fromUsername: username, roomId, accepted });
    });
  });

  socket.on("disconnect", () => {
    const info = connectedUsers.get(socket.id);
    if (info?.roomId) {
      const members = [...connectedUsers.values()]
        .filter((u) => u.roomId === info.roomId && connectedUsers.get(socket.id) !== u)
        .map((u) => ({ userId: u.userId, username: u.username }));
      io.to(info.roomId).emit("roomMembers", members);
    }
    connectedUsers.delete(socket.id);
    broadcastActiveCount();
  });
});

const PORT = process.env.PORT || 3000;

(async () => {
  await redisClient.connect();
  await connectDB();

  const User = require("./models/User");
  for (const idx of ["email_1"]) {
    try { await User.collection.dropIndex(idx); console.log(`Dropped old index: ${idx}`); }
    catch (_) { }
  }

  server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
})();
