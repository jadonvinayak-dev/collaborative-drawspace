let socket, currentUser, roomId;
const canvas = document.getElementById("board");
const ctx    = canvas.getContext("2d");
const cursorLayer = document.getElementById("cursorLayer");

let tool = "pen";
let color = "#0d0d0d";
let size  = 4;
let drawing = false;
let lastX = 0, lastY = 0;

let hlCanvas = null, hlCtx = null;
let hlPoints  = [];

const remoteHL      = new Map();
const remoteCursors = new Map();

function resizeCanvas() {
  const data = canvas.toDataURL();
  const wrap = canvas.parentElement;
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  const img = new Image();
  img.onload = () => ctx.drawImage(img, 0, 0);
  img.src = data;
}
window.addEventListener("resize", resizeCanvas);

function setTool(name) {
  tool = name;
  document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById(`tool-${name}`)?.classList.add("active");
  canvas.style.cursor = name === "pointer" ? "default" : "crosshair";
}

document.getElementById("colorPicker").addEventListener("input", (e) => (color = e.target.value));
document.getElementById("sizeSlider").addEventListener("input", (e) => (size = +e.target.value));

function getPos(e) {
  const rect  = canvas.getBoundingClientRect();
  const point = e.touches ? e.touches[0] : e;
  return { x: point.clientX - rect.left, y: point.clientY - rect.top };
}


function makeOffscreen() {
  const c = document.createElement("canvas");
  c.width  = canvas.width;
  c.height = canvas.height;
  return c;
}

function commitHL(offscreen) {
  ctx.save();
  ctx.globalAlpha = 0.38;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(offscreen, 0, 0);
  ctx.restore();
  offscreen.getContext("2d").clearRect(0, 0, offscreen.width, offscreen.height);
}

function strokePath(targetCtx, points, strokeColor, strokeWidth) {
  if (points.length < 2) return;
  targetCtx.save();
  targetCtx.lineCap      = "round";
  targetCtx.lineJoin     = "round";
  targetCtx.strokeStyle  = strokeColor;
  targetCtx.lineWidth    = strokeWidth;
  targetCtx.globalAlpha  = 1;
  targetCtx.globalCompositeOperation = "source-over";
  targetCtx.beginPath();
  targetCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) targetCtx.lineTo(points[i].x, points[i].y);
  targetCtx.stroke();
  targetCtx.restore();
}

function drawSegment(targetCtx, x0, y0, x1, y1, opts) {
  targetCtx.save();
  targetCtx.lineCap  = "round";
  targetCtx.lineJoin = "round";
  if (opts.tool === "eraser") {
    targetCtx.globalCompositeOperation = "destination-out";
    targetCtx.lineWidth   = opts.size * 2.5;
    targetCtx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    targetCtx.globalCompositeOperation = "source-over";
    targetCtx.strokeStyle = opts.color;
    targetCtx.lineWidth   = opts.size;
    targetCtx.globalAlpha = 1;
  }
  targetCtx.beginPath();
  targetCtx.moveTo(x0, y0);
  targetCtx.lineTo(x1, y1);
  targetCtx.stroke();
  targetCtx.restore();
}


function startDraw(e) {
  if (tool === "pointer") return;
  drawing = true;
  const { x, y } = getPos(e);
  lastX = x; lastY = y;

  if (tool === "highlighter") {
    hlCanvas = makeOffscreen();
    hlCtx    = hlCanvas.getContext("2d");
    hlPoints  = [{ x, y }];
    socket?.emit("hlStart", { roomId, color, size });
  }
}

function moveDraw(e) {
  const { x, y } = getPos(e);
  socket?.emit("cursor", { roomId, x, y });
  if (!drawing || tool === "pointer") return;

  if (tool === "highlighter") {
    hlPoints.push({ x, y });
    hlCtx.clearRect(0, 0, hlCanvas.width, hlCanvas.height);
    strokePath(hlCtx, hlPoints, color, size * 6);
    socket?.emit("hlMove", { roomId, x0: lastX, y0: lastY, x1: x, y1: y, color, size });
  } else {
    drawSegment(ctx, lastX, lastY, x, y, { tool, color, size });
    socket?.emit("draw", { roomId, x0: lastX, y0: lastY, x1: x, y1: y, tool, color, size });
  }
  lastX = x; lastY = y;
}

function endDraw() {
  if (!drawing) return;
  drawing = false;

  if (tool === "highlighter" && hlCanvas) {
    hlCtx.clearRect(0, 0, hlCanvas.width, hlCanvas.height);
    strokePath(hlCtx, hlPoints, color, size * 6);
    commitHL(hlCanvas);
    hlCanvas = null; hlCtx = null; hlPoints = [];
    socket?.emit("hlEnd", { roomId });
  }
}

canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", moveDraw);
window.addEventListener("mouseup",   endDraw);

canvas.addEventListener("touchstart", (e) => { startDraw(e); e.preventDefault(); }, { passive: false });
canvas.addEventListener("touchmove",  (e) => { moveDraw(e);  e.preventDefault(); }, { passive: false });
canvas.addEventListener("touchend",   endDraw);

function clearBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket?.emit("clear", { roomId });
}

function renderRemoteCursor({ userId, username, x, y }) {
  let el = remoteCursors.get(userId);
  if (!el) {
    el = document.createElement("div");
    el.className = "remote-cursor";
    const dotColor = colorFromString(username || userId);
    el.innerHTML = `<div class="dot" style="background:${dotColor}"></div>
                    <div class="label" style="background:${dotColor}">${username || "Guest"}</div>`;
    cursorLayer.appendChild(el);
    remoteCursors.set(userId, el);
  }
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
}

function removeStaleCursors(activeUserIds) {
  for (const [userId, el] of remoteCursors.entries()) {
    if (!activeUserIds.includes(userId)) { el.remove(); remoteCursors.delete(userId); }
  }
}

function renderMembers(members) {
  const wrap = document.getElementById("memberAvatars");
  wrap.innerHTML = "";
  members.forEach((m) => {
    const div = document.createElement("div");
    div.className  = "member-avatar";
    div.style.background = colorFromString(m.username);
    div.title      = m.username;
    div.textContent = m.username[0].toUpperCase();
    wrap.appendChild(div);
  });
  removeStaleCursors(members.map((m) => m.userId));
}

const pendingInvites = new Set();

function openInvite() {
  document.getElementById("inviteLinkInput").value = `${location.origin}/board?room=${roomId}`;
  document.getElementById("inviteModal").classList.add("show");
  refreshOnlineFriends();
}
function closeInvite() { document.getElementById("inviteModal").classList.remove("show"); }
function copyInvite() {
  navigator.clipboard.writeText(document.getElementById("inviteLinkInput").value);
  showToast("Invite link copied!", "success");
}

function refreshOnlineFriends() {
  document.getElementById("onlineFriendsList").innerHTML =
    `<p class="text-muted" style="padding:8px;">Loading online friends…</p>`;
  socket?.emit("getOnlineFriends");
}

function renderOnlineFriends(friends) {
  const list = document.getElementById("onlineFriendsList");
  list.innerHTML = "";
  if (!friends.length) {
    list.innerHTML = `<p class="text-muted" style="padding:8px;">No friends are online right now.</p>`;
    return;
  }
  friends.forEach((f) => {
    const row = document.createElement("div");
    row.className = "online-friend-row";
    row.id = `of-row-${f.userId}`;

    const avatar = document.createElement("div");
    avatar.className = "of-avatar";
    avatar.style.background = colorFromString(f.username);
    avatar.textContent = f.username[0].toUpperCase();

    const name = document.createElement("div");
    name.className = "of-name";
    name.textContent = f.username;

    const status = document.createElement("div");
    status.className = "of-status";
    status.id = `of-status-${f.userId}`;

    if (pendingInvites.has(f.userId)) {
      status.textContent = "Invited…";
      status.classList.add("pending");
    } else {
      const btn = document.createElement("button");
      btn.className = "btn btn-primary btn-sm";
      btn.textContent = "Invite";
      btn.onclick = () => sendBoardInvite(f.userId, f.username);
      status.appendChild(btn);
    }

    row.append(avatar, name, status);
    list.appendChild(row);
  });
}

function sendBoardInvite(toUserId, toUsername) {
  pendingInvites.add(toUserId);
  socket.emit("boardInvite", { toUserId, roomId });
  const status = document.getElementById(`of-status-${toUserId}`);
  if (status) { status.innerHTML = ""; status.textContent = "Invited…"; status.className = "of-status pending"; }
  showToast(`Invite sent to ${toUsername}`, "info");
}

(async () => {
  currentUser = await requireUser();
  if (!currentUser) return;
  if (currentUser.theme === "dark") document.body.classList.add("dark");

  resizeCanvas();

  const params = new URLSearchParams(location.search);
  roomId = params.get("room");

  if (!roomId) {
    const res  = await fetch("/api/room/create", { method: "POST", credentials: "same-origin" });
    const data = await res.json();
    roomId = data.roomId;
    history.replaceState(null, "", `/board?room=${roomId}`);
  } else {
    try {
      const res = await fetch(`/api/room/${roomId}`, { credentials: "same-origin" });
      if (res.ok) {
        const room = await res.json();
        if (room.snapshot) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          img.src = room.snapshot;
        }
      }
    } catch {}
  }

  socket = io();
  socket.on("connect", () => socket.emit("joinRoom", { roomId }));
  attachBoardInviteListener(socket);

  socket.on("roomFull", () => {
    document.getElementById("roomFullBanner").style.display = "block";
    setTimeout(() => (location.href = "/dashboard"), 2500);
  });

  socket.on("roomMembers", renderMembers);

  socket.on("draw", (data) => drawSegment(ctx, data.x0, data.y0, data.x1, data.y1, data));

  socket.on("hlStart", ({ userId, color, size }) => {
    const c = makeOffscreen();
    remoteHL.set(userId, { canvas: c, ctx: c.getContext("2d"), color, size, points: [] });
  });

  socket.on("hlMove", ({ userId, x1, y1, color, size }) => {
    let entry = remoteHL.get(userId);
    if (!entry) {
      const c = makeOffscreen();
      entry = { canvas: c, ctx: c.getContext("2d"), color, size, points: [] };
      remoteHL.set(userId, entry);
    }
    entry.points.push({ x: x1, y: y1 });
    entry.ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
    strokePath(entry.ctx, entry.points, color, size * 6);
  });

  socket.on("hlEnd", ({ userId }) => {
    const entry = remoteHL.get(userId);
    if (entry) { commitHL(entry.canvas); remoteHL.delete(userId); }
  });

  socket.on("clear", () => ctx.clearRect(0, 0, canvas.width, canvas.height));

  socket.on("cursor", ({ userId, username, x, y }) => {
    if (userId === currentUser._id) return;
    renderRemoteCursor({ userId, username, x, y });
  });

  socket.on("onlineFriends", renderOnlineFriends);

  socket.on("boardInviteFailed", ({ reason }) => showToast(reason || "Couldn't send invite.", "error"));

  socket.on("boardInviteResponse", ({ fromUserId, fromUsername, accepted }) => {
    pendingInvites.delete(fromUserId);
    const status = document.getElementById(`of-status-${fromUserId}`);
    if (status) {
      status.className  = `of-status ${accepted ? "" : "declined"}`;
      status.textContent = accepted ? "Joined!" : "Declined";
    }
    showToast(
      accepted ? `${fromUsername} joined the board!` : `${fromUsername} declined the invite.`,
      accepted ? "success" : "info"
    );
  });

  setInterval(() => {
    fetch(`/api/room/${roomId}/snapshot`, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot: canvas.toDataURL() }),
    }).catch(() => {});
  }, 8000);

  window.addEventListener("beforeunload", () => socket.emit("leaveRoom", { roomId }));
})();
