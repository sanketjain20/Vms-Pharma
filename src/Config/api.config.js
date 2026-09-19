// Reads REACT_APP_API_BASE_URL at build time (set it in Vercel's project
// env vars to your Railway backend's public URL) and falls back to
// localhost for local dev. CRA only exposes env vars prefixed REACT_APP_.
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080";
export default API_BASE_URL;