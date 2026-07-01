let socket, currentUser;
let activeFriendId = null;
let activeFriendName = "";

async function loadFriends() {
  const res = await fetch("/api/social/friends");
  const { friends, requests, blocked } = await res.json();

  const reqSection = document.getElementById("requestsSection");
  const reqList = document.getElementById("requestsList");
  reqList.innerHTML = "";
  if (requests.length) {
    reqSection.style.display = "block";
    requests.forEach((u) => {
      reqList.appendChild(buildUserRow(u, [
        { icon: "✔️", title: "Accept",          action: () => acceptRequest(u._id) },
        { icon: "✖️", title: "Decline / Remove", action: () => declineRequest(u._id) },
        { icon: "🚫", title: "Block",            action: () => blockUser(u._id) },
      ]));
    });
  } else {
    reqSection.style.display = "none";
  }

  const friendsList = document.getElementById("friendsList");
  friendsList.innerHTML = "";
  if (!friends.length) {
    friendsList.innerHTML = `<p class="text-muted" style="padding:8px;">No friends yet. Search above to add some!</p>`;
  }
  friends.forEach((u) => {
    const row = buildUserRow(u, [
      { icon: "💬", title: "Chat", action: () => openChat(u._id, u.username) },
      { icon: "🗑️", title: "Remove", action: () => removeFriend(u._id) },
      { icon: "🚫", title: "Block", action: () => blockUser(u._id) },
    ]);
    row.onclick = () => openChat(u._id, u.username);
    friendsList.appendChild(row);
  });

  const blockedSection = document.getElementById("blockedSection");
  const blockedList = document.getElementById("blockedList");
  blockedList.innerHTML = "";
  if (blocked && blocked.length) {
    blockedSection.style.display = "block";
    blocked.forEach((u) => {
      blockedList.appendChild(buildUserRow(u, [
        { icon: "✅", title: "Unblock", action: () => unblockUser(u._id) },
      ]));
    });
  } else {
    blockedSection.style.display = "none";
  }
}

function buildUserRow(u, actions) {
  const row = document.createElement("div");
  row.className = "user-row";
  row.dataset.id = u._id;

  const avatar = document.createElement("div");
  avatar.className = "ur-avatar";
  avatar.style.background = colorFromString(u.username);
  avatar.textContent = u.username[0].toUpperCase();

  const name = document.createElement("div");
  name.className = "ur-name";
  name.textContent = u.username;

  const actionsWrap = document.createElement("div");
  actionsWrap.className = "ur-actions";
  actions.forEach((a) => {
    const btn = document.createElement("button");
    btn.className = "icon-btn";
    btn.title = a.title;
    btn.textContent = a.icon;
    btn.onclick = (e) => { e.stopPropagation(); a.action(); };
    actionsWrap.appendChild(btn);
  });

  row.append(avatar, name, actionsWrap);
  return row;
}

let searchTimeout;
function searchUsers() {
  clearTimeout(searchTimeout);
  const q = document.getElementById("searchInput").value.trim();
  const resultsWrap = document.getElementById("searchResults");
  if (!q) { resultsWrap.innerHTML = ""; return; }

  searchTimeout = setTimeout(async () => {
    const res = await fetch(`/api/social/search?q=${encodeURIComponent(q)}`);
    const users = await res.json();
    resultsWrap.innerHTML = "";
    if (!users.length) {
      resultsWrap.innerHTML = `<p class="text-muted" style="padding:8px;">No users found.</p>`;
      return;
    }
    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = "Search results";
    resultsWrap.appendChild(title);
    users.forEach((u) => {
      resultsWrap.appendChild(buildUserRow(u, [
        { icon: "➕", title: "Add friend", action: () => sendRequest(u._id) },
      ]));
    });
  }, 300);
}

async function sendRequest(id) {
  const res = await fetch(`/api/social/request/${id}`, { method: "POST" });
  const data = await res.json();
  showToast(data.message || data.error, res.ok ? "success" : "error");
}

async function acceptRequest(id) {
  const res = await fetch(`/api/social/accept/${id}`, { method: "POST" });
  const data = await res.json();
  showToast(data.message || data.error, res.ok ? "success" : "error");
  loadFriends();
}

async function declineRequest(id) {
  await fetch(`/api/social/decline/${id}`, { method: "POST" });
  showToast("Request declined.", "info");
  loadFriends();
}

async function removeFriend(id) {
  if (!confirm("Remove this friend?")) return;
  await fetch(`/api/social/remove/${id}`, { method: "POST" });
  showToast("Friend removed.", "info");
  loadFriends();
  if (activeFriendId === id) closeChat();
}

async function blockUser(id) {
  if (!confirm("Block this user? They won't be able to contact you.")) return;
  await fetch(`/api/social/block/${id}`, { method: "POST" });
  showToast("User blocked.", "info");
  loadFriends();
  if (activeFriendId === id) closeChat();
}

async function unblockUser(id) {
  await fetch(`/api/social/unblock/${id}`, { method: "POST" });
  showToast("User unblocked.", "success");
  loadFriends();
}

function closeChat() {
  activeFriendId = null;
  document.getElementById("chatArea").innerHTML = `
    <div class="empty-state">
      <div style="font-size:32px;">💬</div>
      <p>Select a friend to start chatting</p>
    </div>`;
}

async function openChat(friendId, friendName) {
  activeFriendId = friendId;
  activeFriendName = friendName;

  document.querySelectorAll(".user-row").forEach((r) => r.classList.toggle("active", r.dataset.id === friendId));

  const chatArea = document.getElementById("chatArea");
  chatArea.innerHTML = `
    <div class="chat-header">${friendName}</div>
    <div class="chat-messages" id="chatMessages"></div>
    <div class="chat-input-row">
      <input type="text" id="chatInput" placeholder="Type a message…" onkeydown="if(event.key==='Enter') sendChatMessage()" />
      <button class="btn btn-primary" onclick="sendChatMessage()">Send</button>
    </div>
  `;

  const res = await fetch(`/api/social/messages/${friendId}`);
  const msgs = await res.json();
  const msgWrap = document.getElementById("chatMessages");
  msgs.forEach((m) => appendMessage(m));
  msgWrap.scrollTop = msgWrap.scrollHeight;
}

function appendMessage(m) {
  const wrap = document.getElementById("chatMessages");
  if (!wrap) return;
  const mine = m.from._id === currentUser._id || m.from === currentUser._id;
  const div = document.createElement("div");
  div.className = `msg ${mine ? "mine" : "theirs"}`;
  div.textContent = m.text;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !activeFriendId) return;
  socket.emit("sendMessage", { toUserId: activeFriendId, text });
  input.value = "";
}

(async () => {
  currentUser = await requireUser();
  if (!currentUser) return;
  if (currentUser.theme === "dark") document.body.classList.add("dark");

  socket = io();
  attachBoardInviteListener(socket);
  socket.on("newMessage", (m) => {
    const otherId = m.from._id === currentUser._id ? m.to._id : m.from._id;
    if (otherId === activeFriendId) appendMessage(m);
  });

  loadFriends();
})();
