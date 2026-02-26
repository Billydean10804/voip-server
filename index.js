const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

// ✅ endpoint test cepat di browser
app.get("/", (req, res) => {
  res.send("billyapp signaling server is running ✅");
});
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, ts: Date.now() });
});

const server = http.createServer(app);

// ✅ cors aman untuk client Flutter
const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket"],
});

// userId -> socketId
const users = new Map();
// socketId -> userId
const socketToUser = new Map();

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  socket.on("register", (userId) => {
    // 1) hapus user lama pada socket ini
    const oldUser = socketToUser.get(socket.id);
    if (oldUser) users.delete(oldUser);

    // 2) kalau userId dipakai socket lain, putus mapping lamanya
    const oldSocketId = users.get(userId);
    if (oldSocketId && oldSocketId !== socket.id) {
      socketToUser.delete(oldSocketId);
    }

    // 3) simpan mapping baru
    users.set(userId, socket.id);
    socketToUser.set(socket.id, userId);

    console.log("registered:", userId, socket.id);
    console.log("online users:", Array.from(users.keys()));
  });

  socket.on("signal", ({ to, data }) => {
    const targetSocketId = users.get(to);
    const fromUser = socketToUser.get(socket.id) || null;

    if (targetSocketId) {
      io.to(targetSocketId).emit("signal", { from: fromUser, data });
    } else {
      console.log("user not found:", to, "| online:", Array.from(users.keys()));
      // (opsional) balas ke pengirim supaya tahu target offline
      socket.emit("signal", { from: "server", data: { type: "user_offline", payload: { to } } });
    }
  });

  socket.on("disconnect", () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      users.delete(userId);
      socketToUser.delete(socket.id);
      console.log("disconnected:", userId, socket.id);
    } else {
      console.log("disconnected:", socket.id);
    }
    console.log("online users:", Array.from(users.keys()));
  });
});

// ✅ Render: pakai PORT dari env
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Signaling on http://0.0.0.0:${PORT}`);
});