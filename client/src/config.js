const API_URL = import.meta.env.PROD 
  ? "https://chatapp-backend-abdullah.onrender.com"  // We'll update this later
  : "http://localhost:5000";

export default API_URL;