import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";
export default function ChatPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false); // For mobile sidebar toggle
  
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Helper function to decode JWT and get user ID
  const getUserIdFromToken = () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const decoded = JSON.parse(jsonPayload);
      return decoded.id || decoded.userId || decoded._id;
    } catch (error) {
      console.error("Error decoding JWT:", error);
      return null;
    }
  };

  // Check if user is authenticated
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
    }
  }, [navigate]);

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/api/users`);
        setAllUsers(res.data);
        
        let userId = getUserIdFromToken();
        if (!userId) {
          userId = localStorage.getItem("userId");
        }
        
        if (userId) {
          const userExists = res.data.find(user => user._id === userId);
          if (userExists) {
            setCurrentUserId(userId);
            setUsers(res.data.filter(user => user._id !== userId));
          } else {
            setUsers(res.data);
          }
        } else {
          setUsers(res.data);
        }
      } catch (err) {
        console.error("Error fetching users:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Initialize socket when currentUserId is available
  useEffect(() => {
    if (!currentUserId) return;

    console.log("🔌 Initializing socket for user:", currentUserId);

    socketRef.current = io(`${API_URL}`, {
      transports: ['websocket', 'polling']
    });
    
    socketRef.current.on("connect", () => {
      console.log("✅ Socket connected:", socketRef.current.id);
      setSocketConnected(true);
      // Emit join event on connect
      socketRef.current.emit("join", currentUserId);
    });

    socketRef.current.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      setSocketConnected(false);
    });
    
    // Initial join
    socketRef.current.emit("join", currentUserId);
    console.log("📤 Emitted join event with userId:", currentUserId);

    socketRef.current.on("onlineUsers", (users) => {
      console.log("📱 Online users update received:", users);
      setOnlineUsers(users);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [currentUserId]);

  // Separate effect for handling incoming messages
  useEffect(() => {
    if (!socketRef.current) return;

    const handleReceiveMessage = (message) => {
      console.log("📨 Message received in frontend:", message);
      console.log("📍 Current user ID:", currentUserId);
      console.log("📍 Selected user ID:", selectedUser?._id);
      
      // All IDs should now be strings from the server
      console.log("📍 Message from:", message.from, "to:", message.to);
      
      // Add message to the current conversation
      setMessages(prev => {
        // Check if message already exists to avoid duplicates
        const exists = prev.some(m => m._id === message._id);
        if (exists) {
          console.log("⚠️ Message already exists, skipping");
          return prev;
        }
        
        // Check if this message belongs to the current conversation
        const isCurrentConversation = selectedUser && 
          ((message.from === currentUserId && message.to === selectedUser._id) ||
           (message.from === selectedUser._id && message.to === currentUserId));
        
        console.log("🔍 Is current conversation?", isCurrentConversation);
        
        if (isCurrentConversation) {
          console.log("✅ Adding message to current conversation");
          const newMessages = [...prev, message];
          console.log("📝 New messages array length:", newMessages.length);
          return newMessages;
        } else {
          console.log("⚠️ Message not for current conversation, ignoring");
          return prev;
        }
      });
    };

    socketRef.current.on("receiveMessage", handleReceiveMessage);

    const handleUserTyping = ({ userId, isTyping }) => {
      if (userId === selectedUser?._id) {
        setIsTyping(isTyping);
      }
    };

    socketRef.current.on("userTyping", handleUserTyping);

    // Cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.off("receiveMessage", handleReceiveMessage);
        socketRef.current.off("userTyping", handleUserTyping);
      }
    };
  }, [currentUserId, selectedUser]);

  // Fetch messages when user is selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedUser || !currentUserId) return;
      
      try {
        const res = await axios.get(
          `${API_URL}/api/messages/${currentUserId}/${selectedUser._id}`
        );
        setMessages(res.data);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchMessages();
    setIsTyping(false);
  }, [selectedUser, currentUserId]);

  // Auto scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setShowSidebar(false); // Close sidebar on mobile after selecting user
  };

  const handleTyping = () => {
    if (!socketRef.current || !selectedUser) return;
    
    socketRef.current.emit("typing", { to: selectedUser._id, isTyping: true });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit("typing", { to: selectedUser._id, isTyping: false });
    }, 1000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedUser || !socketRef.current) return;

    const messageData = {
      from: currentUserId,
      to: selectedUser._id,
      text: newMessage.trim(),
    };

    socketRef.current.emit("sendMessage", messageData);
    socketRef.current.emit("typing", { to: selectedUser._id, isTyping: false });
    setNewMessage("");
  };

  const handleLogout = () => {
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    // Clear local storage
    localStorage.removeItem("userId");
    localStorage.removeItem("token");
    
    // Navigate to home page
    navigate("/");
  };

  const isUserOnline = (userId) => {
    return onlineUsers.includes(userId);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getCurrentUser = () => {
    return allUsers.find(user => user._id === currentUserId);
  };

  const getInitials = (email) => {
    return email?.substring(0, 2).toUpperCase() || "??";
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!currentUserId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Overlay */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-30
        w-80 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {/* Close button for mobile */}
              <button
                onClick={() => setShowSidebar(false)}
                className="lg:hidden text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h1 className="text-xl lg:text-2xl font-bold text-white">Messages</h1>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white font-semibold transition-colors"
              >
                {getInitials(getCurrentUser()?.email)}
              </button>
              
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl py-2 z-10">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{getCurrentUser()?.email}</p>
                    <div className="flex items-center mt-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      <p className="text-xs text-gray-500">{socketConnected ? 'Online' : 'Offline'}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full bg-white/20 text-white placeholder-white/70 border border-white/30 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <svg className="w-5 h-5 absolute right-3 top-2.5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <div
                key={user._id}
                onClick={() => handleUserSelect(user)}
                className={`flex items-center p-4 cursor-pointer transition-all hover:bg-gray-50 ${
                  selectedUser?._id === user._id ? "bg-blue-50 border-l-4 border-blue-600" : ""
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {getInitials(user.email)}
                  </div>
                  {isUserOnline(user._id) && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
                  )}
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user.email}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isUserOnline(user._id) ? "Online" : "Offline"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-400 mt-8">
              <p>No users found</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4 flex items-center shadow-sm">
              {/* Mobile menu button */}
              <button
                onClick={() => setShowSidebar(true)}
                className="lg:hidden mr-3 text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                {getInitials(selectedUser.email)}
              </div>
              <div className="ml-4 flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {selectedUser.email}
                </h3>
                <p className="text-sm text-gray-500">
                  {isUserOnline(selectedUser._id) ? (
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      Online
                    </span>
                  ) : (
                    "Offline"
                  )}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 bg-gradient-to-b from-gray-50 to-white">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 px-4">
                  <svg className="w-12 h-12 lg:w-16 lg:h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-base lg:text-lg font-medium text-center">No messages yet</p>
                  <p className="text-sm text-center">Start the conversation!</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwnMessage = message.from === currentUserId;
                  const showAvatar = index === 0 || messages[index - 1].from !== message.from;
                  
                  return (
                    <div
                      key={message._id}
                      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} ${
                        showAvatar ? "mt-4" : "mt-1"
                      }`}
                    >
                      {!isOwnMessage && showAvatar && (
                        <div className="w-6 h-6 lg:w-8 lg:h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs font-semibold mr-2 flex-shrink-0">
                          {getInitials(selectedUser.email)}
                        </div>
                      )}
                      {!isOwnMessage && !showAvatar && <div className="w-6 lg:w-8 mr-2" />}
                      
                      <div className={`max-w-[75%] sm:max-w-xs lg:max-w-md ${isOwnMessage ? "ml-auto" : ""}`}>
                        <div
                          className={`px-3 py-2 lg:px-4 lg:py-2 rounded-2xl break-words ${
                            isOwnMessage
                              ? "bg-blue-600 text-white rounded-br-sm"
                              : "bg-white text-gray-900 border border-gray-200 rounded-bl-sm shadow-sm"
                          }`}
                        >
                          <p className="text-sm">{message.text}</p>
                        </div>
                        <p
                          className={`text-xs mt-1 ${
                            isOwnMessage ? "text-right text-gray-500" : "text-gray-500"
                          }`}
                        >
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              
              {isTyping && (
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="w-6 h-6 lg:w-8 lg:h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                    {getInitials(selectedUser.email)}
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl px-3 py-2 lg:px-4 lg:py-3 shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 px-4 py-3 lg:px-6 lg:py-4 safe-area-bottom">
              <form onSubmit={handleSendMessage} className="flex items-end space-x-2 lg:space-x-3">
                <div className="flex-1 bg-gray-100 rounded-2xl px-3 py-2 lg:px-4 lg:py-3 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    placeholder="Type a message..."
                    className="w-full bg-transparent text-gray-900 placeholder-gray-500 focus:outline-none text-sm lg:text-base"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || !socketConnected}
                  className="bg-blue-600 text-white p-2.5 lg:p-3 rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 flex-shrink-0"
                >
                  <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-4">
            {/* Mobile menu button when no chat selected */}
            <button
              onClick={() => setShowSidebar(true)}
              className="lg:hidden absolute top-4 left-4 text-gray-600 hover:text-gray-900 bg-white rounded-full p-3 shadow-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <svg className="w-16 h-16 lg:w-24 lg:h-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg lg:text-xl font-semibold text-gray-600 mb-2 text-center">Welcome to ChatApp</p>
            <p className="text-gray-500 text-center px-4">Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}