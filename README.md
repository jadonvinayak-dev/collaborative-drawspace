**DrawSpace — Real-Time Collaborative Whiteboard**

DrawSpace is a full-stack web app where people can draw together on a shared whiteboard in real time, see each other's cursors with their names, manage friends, chat, and customize their account — all running entirely on your own machine with Docker.


**Features**

1. Login / Signup with a server-side math CAPTCHA (e.g. `6 + 9 = ?`) for bot prevention, plus a landing page showing live "users drawing now" and "accounts registered" counters.

2. Dashboard — a clean hub with four options: Start, Social, Settings, Logout.

3. Start (Whiteboard) — draw together in real time (up to 5 people per board) with pen, highlighter, eraser, and pointer tools, adjustable brush size/colour, named cursors for every collaborator, and a shareable invite link.

4. Social — search for other users, send/accept/decline friend requests, block/unblock, chat in real time, and send direct board invitations to online friends.

5. Settings — change your username, toggle dark mode, or permanently delete your account.

6. Persistence — whiteboard snapshots, friendships, and chat history are all saved to MongoDB, so they survive restarts.


**Tech Stack**

1. Frontend: HTML5, CSS3, JavaScript, Canvas API

2. Backend: Node.js, Express.js

3. Real-time: Socket.IO

4. Database: MongoDB (Mongoose)

5. Session store: Redis

6. Auth: express-session + bcrypt + server-side math CAPTCHA

7. Containerization: Docker & Docker Compose


**Folder Structure**

```
collaborative-drawspace/
├── backend/
│   ├── config/          # DB and Redis connection setup
│   ├── controllers/     # Business logic for each feature
│   ├── middleware/      # Auth guard (requireAuth)
│   ├── models/          # Mongoose schemas (User, Room, Message)
│   ├── routes/          # Express route definitions
│   ├── utils/
│   │   └── captcha.js   # Math CAPTCHA generator + verifier
│   └── server.js        # App entry point — Express + Socket.IO
├── frontend/
│   ├── public/
│   │   ├── css/global.css
│   │   └── js/          # common.js, whiteboard.js, social.js
│   └── views/           # HTML pages (index, dashboard, board, social, settings)
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── package.json
```

---

**Getting Started (Docker — recommended)**

1. Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed.

2. Clone and configure

git clone https://github.com/jadonvinayak-dev/collaborative-drawspace.git
cd collaborative-drawspace
cp .env.example .env

3. Run

docker compose up --build

4. Open

Visit **http://localhost:3000**

To stop: `Ctrl+C` then `docker compose down`

To wipe all data: `docker compose down -v`

---

**Getting Started (Without Docker)**

1. Install prerequisites

- Node.js v18+, MongoDB, Redis

2. Install dependencies - npm install

3. Configure - cp .env.example .env

4. Run - npm start



**How Real-Time Drawing Works**

1. Each mouse/touch segment is sent via Socket.IO `draw` event tagged with the room ID.

2. The server relays it to all other users in the same room.

3. Each client redraws that segment on their own canvas keeping everyone in sync.

4. The highlighter uses an offscreen canvas — the full stroke is accumulated at full opacity, then composited onto the main canvas at 0.38 alpha on mouseup, preventing 
the alpha-stacking artifact.

5. Cursor positions are broadcast via a `cursor` event carrying the sender's username, so every participant sees a labelled coloured cursor for each collaborator.

6. Every 8 seconds the canvas is saved as a base64 snapshot to MongoDB for persistence.

Rooms are capped at 5 simultaneous users.

---

**License** - MIT
