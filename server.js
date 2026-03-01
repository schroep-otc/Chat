const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Set this on Render as an Environment Variable:
const ROOM_PASSWORD = process.env.ROOM_PASSWORD || "";

const users = new Map(); // socket.id -> { username, room }

io.on("connection", (socket) => {
  socket.on("join", ({ username, room, password }) => {
    // If a password is set on the server, require it
    if (ROOM_PASSWORD && String(password || "") !== ROOM_PASSWORD) {
      socket.emit("auth_error", "Wrong room password.");
      socket.disconnect(true);
      return;
    }

    username = String(username || "Anonymous").trim() || "Anonymous";
    room = String(room || "lobby").trim() || "lobby";

    users.set(socket.id, { username, room });
    socket.join(room);

    io.to(room).emit("system", { type: "join", username, t: Date.now() });
  });

  socket.on("chat message", (text) => {
    const info = users.get(socket.id);
    if (!info) return;

    const msg = String(text || "").trim();
    if (!msg) return;

    io.to(info.room).emit("chat message", {
      username: info.username,
      text: msg,
      t: Date.now(),
    });
  });

  socket.on("typing", (isTyping) => {
    const info = users.get(socket.id);
    if (!info) return;

    socket.to(info.room).emit("typing", {
      username: info.username,
      isTyping: Boolean(isTyping),
    });
  });

  socket.on("disconnect", () => {
    const info = users.get(socket.id);
    if (!info) return;

    users.delete(socket.id);
    io.to(info.room).emit("system", { type: "leave", username: info.username, t: Date.now() });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));