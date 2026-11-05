// Reads REACT_APP_API_BASE_URL at build time (set it in Vercel's project
// env vars to your Railway backend's public URL) and falls back to
// localhost for local dev. CRA only exposes env vars prefixed REACT_APP_.
// "http://localhost:8080"
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ||"https://vms-ui-backend-production-20fd.up.railway.app";
export default API_BASE_URL;