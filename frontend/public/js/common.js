async function requireUser() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!res.ok) { location.href = "/"; return null; }
    return await res.json();
  } catch {
    location.href = "/";
    return null;
  }
}

function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `show ${type}`;
  setTimeout(() => (t.className = ""), 3000);
}

function colorFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

function attachBoardInviteListener(socket) {
  socket.on("boardInviteReceived", ({ fromUserId, fromUsername, roomId }) => {
    showBoardInvitePopup(fromUserId, fromUsername, roomId, socket);
  });
}

function showBoardInvitePopup(fromUserId, fromUsername, roomId, socket) {
  document.getElementById(`invite-popup-${fromUserId}`)?.remove();

  const popup = document.createElement("div");
  popup.className = "board-invite-popup";
  popup.id = `invite-popup-${fromUserId}`;
  popup.innerHTML = `
    <h4>🎨 Board invite</h4>
    <p><strong>${fromUsername}</strong> wants you to draw together.</p>
    <div class="board-invite-actions">
      <button class="btn btn-ghost btn-sm" id="reject-${fromUserId}">Decline</button>
      <button class="btn btn-primary btn-sm" id="accept-${fromUserId}">Join</button>
    </div>
  `;
  document.body.appendChild(popup);

  const cleanup = () => popup.remove();

  document.getElementById(`accept-${fromUserId}`).onclick = () => {
    socket.emit("boardInviteResponse", { toUserId: fromUserId, roomId, accepted: true });
    cleanup();
    location.href = `/board?room=${roomId}`;
  };

  document.getElementById(`reject-${fromUserId}`).onclick = () => {
    socket.emit("boardInviteResponse", { toUserId: fromUserId, roomId, accepted: false });
    cleanup();
  };

  setTimeout(() => {
    if (document.body.contains(popup)) {
      socket.emit("boardInviteResponse", { toUserId: fromUserId, roomId, accepted: false });
      cleanup();
    }
  }, 30000);
}
