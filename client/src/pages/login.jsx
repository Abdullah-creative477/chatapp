import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "..src/config";


export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageVisible, setMessageVisible] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("⏳ Logging in...");
    setMessageVisible(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("✅ " + data.message);
        if (data.token) localStorage.setItem("token", data.token);
        setTimeout(() => navigate("/chat"), 800);
      } else {
        setMessage("❌ " + (data.error || "Login failed"));
      }
    } catch (err) {
      setMessage("⚠️ Server error, try again later.");
    }
  };

  // Fade out message after 3 seconds
  useEffect(() => {
    if (messageVisible) {
      const timer = setTimeout(() => setMessageVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [messageVisible]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white w-full max-w-md p-8 md:p-10 rounded-2xl shadow-xl transition-all duration-500 hover:shadow-2xl">
        <h2 className="text-3xl font-semibold text-gray-800 text-center mb-8">
          Sign in
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Input */}
          <div className="relative">
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="peer w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
              placeholder=" "
            />
            <label
              htmlFor="email"
              className="absolute left-4 top-3 text-gray-500 text-sm transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-base peer-focus:-top-2 peer-focus:text-sm peer-focus:text-blue-600"
            >
              Email
            </label>
          </div>

          {/* Password Input */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="peer w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
              placeholder=" "
            />
            <label
              htmlFor="password"
              className="absolute left-4 top-3 text-gray-500 text-sm transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-base peer-focus:-top-2 peer-focus:text-sm peer-focus:text-blue-600"
            >
              Password
            </label>
            <span
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-3 text-gray-400 cursor-pointer select-none text-sm hover:text-gray-600"
            >
              {showPassword ? "Hide" : "Show"}
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 active:scale-95 transition-transform font-medium"
          >
            Sign in
          </button>
        </form>

        {/* Messages */}
        {messageVisible && message && (
          <p
            className={`mt-4 text-center text-sm ${
              message.startsWith("✅")
                ? "text-green-600"
                : "text-red-600"
            } transition-opacity duration-500`}
          >
            {message}
          </p>
        )}

        {/* Register Link */}
        <p className="mt-6 text-center text-gray-500 text-sm">
          Don't have an account?{" "}
          <span
            className="text-blue-600 cursor-pointer hover:underline"
            onClick={() => navigate("/register")}
          >
            Sign up
          </span>
        </p>

        {/* Forgot Password */}
        <p
          className="mt-2 text-center text-gray-400 text-sm cursor-pointer hover:text-gray-600"
          onClick={() => alert("Forgot password clicked!")}
        >
          Forgot password?
        </p>
      </div>
    </div>
  );
}
