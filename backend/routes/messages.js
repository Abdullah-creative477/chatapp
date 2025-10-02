const express = require("express");
const mongoose = require("mongoose");
const Message = require("../models/Message");

const router = express.Router();

// Get messages between two users
router.get("/:userId1/:userId2", async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId1) || !mongoose.Types.ObjectId.isValid(userId2)) {
      return res.status(400).json({ error: "Invalid user IDs" });
    }
    
    console.log(`📩 Fetching messages between ${userId1} and ${userId2}`); // DEBUG
    
    const messages = await Message.find({
      $or: [
        { from: userId1, to: userId2 },
        { from: userId2, to: userId1 }
      ]
    }).sort({ createdAt: 1 });

    console.log(`📩 Found ${messages.length} messages`); // DEBUG
    res.json(messages);
  } catch (error) {
    console.error("❌ Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

module.exports = router;