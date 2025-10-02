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

// UPDATED: CORS Configuration for Production
const allowedOrigins = [
  "http://localhost:5173",
  "https://chatapp-frontend-abdullah.onrender.com"  // UPDATE THIS after deploying frontend
];

const io = new Server(server, {
  cors: { 
    origin: allowedOrigins,
    credentials: true 
  },
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// ADDED: Health check endpoint (important for Render)
app.get("/", (req, res) => {
  res.json({ 
    status: "Server is running!",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// ---------------------------
// MongoDB connection
// ---------------------------
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));


// ---------------------------
// Socket.IO real-time chat
// ---------------------------
const onlineUsers = {}; // { userId: socketId }

io.on("connection", (socket) => {
  console.log("🔗 New client connected:", socket.id);

  // User joins
  socket.on("join", (userId) => {
    console.log("👤 User joining:", userId, "with socket:", socket.id);
    
    // Remove any existing socket for this user (in case of reconnection)
    for (let uid in onlineUsers) {
      if (uid === userId && onlineUsers[uid] !== socket.id) {
        console.log("🔄 Removing old socket for user:", userId);
        delete onlineUsers[uid];
      }
    }
    
    onlineUsers[userId] = socket.id;
    console.log("📱 Online users:", Object.keys(onlineUsers));
    
    // Broadcast to ALL clients (including the one that just joined)
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });

  // Send message
  socket.on("sendMessage", async ({ from, to, text }) => {
    console.log("📤 Received message:", { from, to, text });
    console.log("📱 Current online users:", onlineUsers);
    console.log("📍 Recipient socket:", onlineUsers[to]);
    console.log("📍 Sender socket:", socket.id);
    
    try {
      const message = await Message.create({ from, to, text });
      console.log("💾 Message saved to DB:", message);
      
      // Convert message to plain object with string IDs
      const messageObj = {
        _id: message._id.toString(),
        from: message.from.toString(),
        to: message.to.toString(),
        text: message.text,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt
      };
      
      console.log("📦 Sending message object:", messageObj);
      
      // Send to recipient if online
      if (onlineUsers[to]) {
        console.log("✅ Sending message to recipient:", to);
        io.to(onlineUsers[to]).emit("receiveMessage", messageObj);
      } else {
        console.log("⚠️ Recipient not online:", to);
      }
      
      // Send back to sender
      console.log("✅ Sending message back to sender:", from);
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
    console.log("❌ Client disconnected:", socket.id);
    
    // Remove user from online list
    for (let userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        console.log("👤 User going offline:", userId);
        delete onlineUsers[userId];
      }
    }
    
    console.log("📱 Updated online users:", Object.keys(onlineUsers));
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
