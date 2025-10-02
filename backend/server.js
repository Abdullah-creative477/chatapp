const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const messageRoutes = require("./routes/messages");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

// ✅ Allowed origins (local + deployed frontends)
const allowedOrigins = [
  "http://localhost:5173",
  "https://chatapp-frontend-abdullah.onrender.com",
  "https://chatapp-two-tan.vercel.app" // <-- Your Vercel frontend
];

// ---------------------------
// CORS Middleware
// ---------------------------
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// ---------------------------
// Health check (important for Railway/Render)
// ---------------------------
app.get("/", (req, res) => {
  res.json({ 
    status: "Server is running!",
    timestamp: new Date().toISOString()
  });
});

// ---------------------------
// Routes
// ---------------------------
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// ---------------------------
// MongoDB connection
// ---------------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ---------------------------
// Socket.IO real-time chat
// ---------------------------
const io = new Server(server, {
  cors: { 
    origin: allowedOrigins,
    credentials: true 
  },
});

const onlineUsers = {}; // { userId: socketId }

io.on("connection", (socket) => {
  console.log("🔗 New client connected:", socket.id);

  // User joins
  socket.on("join", (userId) => {
    console.log("👤 User joining:", userId);

    // Ensure only one active socket per user
    for (let uid in onlineUsers) {
      if (uid === userId && onlineUsers[uid] !== socket.id) {
        delete onlineUsers[uid];
      }
    }

    onlineUsers[userId] = socket.id;
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });

  // Send message
  socket.on("sendMessage", async ({ from, to, text }) => {
    try {
      const message = await Message.create({ from, to, text });
      const messageObj = {
        _id: message._id.toString(),
        from: message.from.toString(),
        to: message.to.toString(),
        text: message.text,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt
      };

      // Send to recipient if online
      if (onlineUsers[to]) {
        io.to(onlineUsers[to]).emit("receiveMessage", messageObj);
      }

      // Send back to sender
      socket.emit("receiveMessage", messageObj);

    } catch (err) {
      console.error("❌ Error saving message:", err);
      socket.emit("messageError", { error: "Failed to send message" });
    }
  });

  // Typing indicator
  socket.on("typing", ({ to, isTyping }) => {
    if (onlineUsers[to]) {
      io.to(onlineUsers[to]).emit("userTyping", { 
        userId: Object.keys(onlineUsers).find(key => onlineUsers[key] === socket.id),
        isTyping 
      });
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    for (let userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
      }
    }
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });
});

// ---------------------------
// Start server
// ---------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
