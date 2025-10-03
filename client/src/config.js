const API_URL = import.meta.env.PROD 
  ? "https://chatapp-production-a6c7.up.railway.app"
  : "http://localhost:8080";

export default API_URL;
