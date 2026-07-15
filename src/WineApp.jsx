import { useState, useRef, useEffect } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

// ── Supabase helpers ──────────────────────────────────────────────────────────
class SessionExpiredError extends Error { constructor() { super("session_expired"); } }

const sb = async (path, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      Prefer: "return=representation",
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    if (text.includes("JWT expired") || text.includes("PGRST303")) throw new SessionExpiredError();
    throw new Error(text);
  }
  return res.status === 204 ? null : res.json();
};

const sbAuth = async (endpoint, body) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Auth error");
  return data;
};

// ── Claude API helper ─────────────────────────────────────────────────────────
const askClaude = async (messages, system = "") => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: "claude-opus-4-5", max_tokens: 2000, system, messages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Claude error");
  return data.content[0].text;
};

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --wine: #7B1C2E;
    --wine-light: #A8324A;
    --wine-pale: #F5EAE8;
    --gold: #C9A84C;
    --gold-light: #E8D5A3;
    --cream: #FAF7F2;
    --ink: #1A1410;
    --ink-soft: #4A3F38;
    --ink-muted: #8A7F78;
    --border: rgba(123,28,46,0.15);
    --white: #FFFFFF;
    --green: #2D6A4F;
    --green-pale: #E8F5EF;
    --shadow: 0 4px 24px rgba(26,20,16,0.08);
    --shadow-lg: 0 8px 48px rgba(26,20,16,0.14);
    --r: 12px;
    --r-sm: 8px;
  }

  body { background: var(--cream); font-family: 'DM Sans', sans-serif; color: var(--ink); }

  .app { min-height: 100vh; display: flex; flex-direction: column; max-width: 430px; margin: 0 auto; background: var(--white); position: relative; overflow: hidden; }

  /* ── Auth ── */
  .auth-screen { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; background: var(--wine); }
  .auth-logo { font-family: 'Cormorant Garamond', serif; font-size: 3rem; font-weight: 300; color: var(--white); letter-spacing: 0.05em; margin-bottom: 0.25rem; }
  .auth-tagline { font-size: 0.8rem; color: var(--gold-light); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 3rem; }
  .auth-card { background: var(--white); border-radius: 20px; padding: 2rem; width: 100%; max-width: 360px; box-shadow: var(--shadow-lg); }
  .auth-title { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 400; color: var(--ink); margin-bottom: 1.5rem; text-align: center; }
  .field { margin-bottom: 1rem; }
  .field label { display: block; font-size: 0.75rem; font-weight: 500; color: var(--ink-muted); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
  .field input { width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: var(--r-sm); font-family: 'DM Sans', sans-serif; font-size: 0.95rem; color: var(--ink); background: var(--cream); outline: none; transition: border-color 0.2s; }
  .field input:focus { border-color: var(--wine-light); }
  .btn-primary { width: 100%; padding: 0.875rem; background: var(--wine); color: var(--white); border: none; border-radius: var(--r-sm); font-family: 'DM Sans', sans-serif; font-size: 0.95rem; font-weight: 500; cursor: pointer; transition: background 0.2s, transform 0.1s; margin-top: 0.5rem; }
  .btn-primary:hover { background: var(--wine-light); }
  .btn-primary:active { transform: scale(0.98); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .auth-switch { text-align: center; margin-top: 1.25rem; font-size: 0.85rem; color: var(--ink-muted); }
  .auth-switch button { background: none; border: none; color: var(--wine); font-weight: 500; cursor: pointer; font-size: 0.85rem; }
  .error-msg { background: #FEE; border: 1px solid #FCC; border-radius: var(--r-sm); padding: 0.75rem 1rem; font-size: 0.85rem; color: #C00; margin-bottom: 1rem; }

  /* ── Header ── */
  .header { padding: 1rem 1.25rem 0.75rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); background: var(--white); position: sticky; top: 0; z-index: 10; }
  .header-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.6rem; font-weight: 300; color: var(--wine); letter-spacing: 0.03em; }
  .header-actions { display: flex; gap: 8px; }
  .icon-btn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border); background: var(--cream); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1rem; transition: background 0.2s; }
  .icon-btn:hover { background: var(--wine-pale); }

  /* ── Nav ── */
  .bottom-nav { display: flex; border-top: 1px solid var(--border); background: var(--white); position: sticky; bottom: 0; z-index: 10; }
  .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 0.6rem 0 0.5rem; cursor: pointer; gap: 3px; transition: color 0.2s; color: var(--ink-muted); font-size: 0.65rem; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; border: none; background: none; }
  .nav-item.active { color: var(--wine); }
  .nav-icon { font-size: 1.2rem; }

  /* ── Scan screen ── */
  .screen { flex: 1; overflow-y: auto; padding: 1.25rem; }
  .scan-hero { background: var(--wine); border-radius: 20px; padding: 2rem 1.5rem; text-align: center; margin-bottom: 1.25rem; color: var(--white); }
  .scan-hero h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.75rem; font-weight: 300; margin-bottom: 0.5rem; }
  .scan-hero p { font-size: 0.85rem; color: rgba(255,255,255,0.75); line-height: 1.5; }
  .camera-btn-primary { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; width: 100%; padding: 2.5rem 2rem; border: none; border-radius: 20px; background: var(--wine); cursor: pointer; transition: all 0.2s; color: var(--white); margin-bottom: 0.75rem; }
  .camera-btn-primary:hover { background: var(--wine-light); transform: translateY(-1px); box-shadow: var(--shadow); }
  .camera-btn-primary:active { transform: scale(0.98); }
  .camera-btn-primary .cam-icon { font-size: 2.5rem; }
  .camera-btn-primary span { font-size: 1rem; font-weight: 500; letter-spacing: 0.02em; }
  .camera-btn-secondary { display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 0.6rem; width: 100%; padding: 0.9rem 1.5rem; border: 1.5px dashed var(--border); border-radius: var(--r); background: var(--cream); cursor: pointer; transition: all 0.2s; color: var(--ink-muted); margin-bottom: 1rem; font-family: "DM Sans", sans-serif; }
  .camera-btn-secondary:hover { border-color: var(--wine-light); background: var(--wine-pale); color: var(--ink-soft); }
  .camera-btn-secondary span { font-size: 0.85rem; font-weight: 500; }
  .camera-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; width: 100%; padding: 2rem; border: 2px dashed var(--border); border-radius: 20px; background: var(--cream); cursor: pointer; transition: all 0.2s; color: var(--ink-soft); margin-bottom: 1rem; }
  .camera-btn:hover { border-color: var(--wine-light); background: var(--wine-pale); }
  .camera-btn .cam-icon { font-size: 2.5rem; }
  .camera-btn span { font-size: 0.9rem; font-weight: 500; }
  .camera-btn small { font-size: 0.75rem; color: var(--ink-muted); }
  .preview-img { width: 100%; border-radius: 16px; margin-bottom: 1rem; max-height: 280px; object-fit: cover; }
  .btn-scan { width: 100%; padding: 1rem; background: var(--gold); color: var(--ink); border: none; border-radius: var(--r-sm); font-family: 'DM Sans', sans-serif; font-size: 1rem; font-weight: 500; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .btn-scan:hover { background: var(--gold-light); }
  .btn-scan:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ── Loading ── */
  .loading-wrap { text-align: center; padding: 2rem 1rem; }
  .spinner { width: 40px; height: 40px; border: 3px solid var(--wine-pale); border-top-color: var(--wine); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-wrap p { font-size: 0.9rem; color: var(--ink-muted); line-height: 1.6; }

  /* ── Results ── */
  .results-header { margin-bottom: 1.25rem; }
  .results-header h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 400; color: var(--ink); margin-bottom: 0.25rem; }
  .results-header p { font-size: 0.8rem; color: var(--ink-muted); }
  .rec-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
  .rec-col { }
  .rec-col-title { display: flex; align-items: center; gap: 6px; font-size: 0.7rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted); margin-bottom: 0.75rem; }
  .rec-col-title span { font-size: 1rem; }
  .wine-card { background: var(--white); border: 1px solid var(--border); border-radius: var(--r); padding: 0.875rem; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.2s; position: relative; }
  .wine-card:hover { border-color: var(--wine-light); box-shadow: var(--shadow); transform: translateY(-1px); }
  .wine-card.top { border-left: 3px solid var(--wine); }
  .wine-card.value { border-left: 3px solid var(--green); }
  .wine-rank { font-size: 0.65rem; font-weight: 500; color: var(--ink-muted); letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px; }
  .wine-name { font-family: 'Cormorant Garamond', serif; font-size: 1rem; font-weight: 600; color: var(--ink); line-height: 1.2; margin-bottom: 2px; }
  .wine-vintage { font-size: 0.75rem; color: var(--ink-muted); margin-bottom: 6px; }
  .wine-meta { display: flex; flex-direction: column; gap: 3px; }
  .wine-score { display: flex; align-items: center; gap: 4px; font-size: 0.8rem; }
  .score-badge { background: var(--wine); color: var(--white); font-size: 0.7rem; font-weight: 600; padding: 1px 6px; border-radius: 4px; }
  .score-badge.good { background: var(--green); }
  .wine-price { font-size: 0.8rem; color: var(--ink-soft); }
  .value-score { font-size: 0.7rem; color: var(--green); font-weight: 500; background: var(--green-pale); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px; }
  .why-badge { font-size: 0.7rem; color: var(--wine); font-style: italic; margin-top: 4px; line-height: 1.3; }

  /* ── Log modal ── */
  .modal-overlay { position: fixed; inset: 0; background: rgba(26,20,16,0.5); display: flex; align-items: flex-end; z-index: 100; }
  .modal { background: var(--white); border-radius: 24px 24px 0 0; padding: 1.5rem; width: 100%; max-height: 80vh; overflow-y: auto; }
  .modal-handle { width: 40px; height: 4px; background: var(--border); border-radius: 2px; margin: 0 auto 1.25rem; }
  .modal-title { font-family: 'Cormorant Garamond', serif; font-size: 1.4rem; font-weight: 400; margin-bottom: 0.25rem; }
  .modal-sub { font-size: 0.8rem; color: var(--ink-muted); margin-bottom: 1.5rem; }
  .star-row { display: flex; gap: 8px; margin-bottom: 1.25rem; }
  .star { font-size: 1.75rem; cursor: pointer; transition: transform 0.1s; filter: grayscale(1); opacity: 0.4; }
  .star.active { filter: none; opacity: 1; transform: scale(1.1); }
  .notes-field { width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: var(--r-sm); font-family: 'DM Sans', sans-serif; font-size: 0.9rem; resize: none; outline: none; background: var(--cream); color: var(--ink); margin-bottom: 1rem; }
  .notes-field:focus { border-color: var(--wine-light); }
  .btn-log { width: 100%; padding: 1rem; background: var(--wine); color: var(--white); border: none; border-radius: var(--r-sm); font-family: 'DM Sans', sans-serif; font-size: 0.95rem; font-weight: 500; cursor: pointer; }
  .btn-cancel { width: 100%; padding: 0.75rem; background: none; border: 1px solid var(--border); border-radius: var(--r-sm); font-family: 'DM Sans', sans-serif; font-size: 0.9rem; color: var(--ink-muted); cursor: pointer; margin-top: 0.5rem; }

  /* ── Wine Log ── */
  .log-empty { text-align: center; padding: 3rem 1rem; color: var(--ink-muted); }
  .log-empty .empty-icon { font-size: 3rem; margin-bottom: 1rem; }
  .log-empty p { font-size: 0.9rem; line-height: 1.6; }
  .log-item { background: var(--white); border: 1px solid var(--border); border-radius: var(--r); padding: 1rem; margin-bottom: 0.75rem; }
  .log-item-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
  .log-wine-name { font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; font-weight: 600; }
  .log-stars { color: var(--gold); font-size: 0.9rem; }
  .log-meta { font-size: 0.75rem; color: var(--ink-muted); margin-bottom: 6px; }
  .log-notes { font-size: 0.82rem; color: var(--ink-soft); font-style: italic; line-height: 1.4; }

  /* ── Settings ── */
  .settings-section { margin-bottom: 1.75rem; }
  .settings-title { font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; font-weight: 600; color: var(--ink); margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
  .pref-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 0.5rem; }
  .chip { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); font-size: 0.8rem; cursor: pointer; transition: all 0.15s; color: var(--ink-soft); background: var(--white); }
  .chip.selected { background: var(--wine); color: var(--white); border-color: var(--wine); }
  .slider-wrap { margin-bottom: 1rem; }
  .slider-label { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--ink-muted); margin-bottom: 6px; }
  .slider-label strong { color: var(--wine); }
  input[type=range] { width: 100%; accent-color: var(--wine); }
  .btn-save { width: 100%; padding: 0.875rem; background: var(--wine); color: var(--white); border: none; border-radius: var(--r-sm); font-size: 0.95rem; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; }
  .success-msg { background: var(--green-pale); border: 1px solid var(--green); border-radius: var(--r-sm); padding: 0.75rem 1rem; font-size: 0.85rem; color: var(--green); margin-bottom: 1rem; text-align: center; }

  /* ── History ── */
  .history-item { background: var(--white); border: 1px solid var(--border); border-radius: var(--r); padding: 1rem; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 1rem; }
  .history-item:hover { border-color: var(--wine-light); box-shadow: var(--shadow); transform: translateY(-1px); }
  .history-icon { font-size: 1.75rem; flex-shrink: 0; }
  .history-info { flex: 1; min-width: 0; }
  .history-location { font-family: "Cormorant Garamond", serif; font-size: 1.05rem; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .history-meta { font-size: 0.75rem; color: var(--ink-muted); margin-top: 2px; }
  .history-delete { font-size: 1rem; color: var(--ink-muted); background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: var(--r-sm); flex-shrink: 0; transition: color 0.2s; }
  .history-delete:hover { color: var(--wine); }
  .history-detail-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 1.25rem; }
  .history-detail-location { font-family: "Cormorant Garamond", serif; font-size: 1.3rem; font-weight: 600; color: var(--ink); line-height: 1.2; }
  .history-detail-date { font-size: 0.75rem; color: var(--ink-muted); margin-top: 3px; }

  /* ── Misc ── */
  .section-heading { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; font-weight: 400; color: var(--ink); margin-bottom: 0.25rem; }
  .section-sub { font-size: 0.8rem; color: var(--ink-muted); margin-bottom: 1.25rem; }
  .back-btn { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--wine); background: none; border: none; cursor: pointer; margin-bottom: 1.25rem; padding: 0; }
`;

// ── Default prefs ─────────────────────────────────────────────────────────────
const DEFAULT_PREFS = {
  types: ["Red", "White"],
  varietals: ["Cabernet Sauvignon", "Pinot Noir"],
  regions: ["California", "France"],
  maxPrice: 50,
  minRating: 88,
  scanHistoryLimit: 5,
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function WineApp() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [tab, setTab] = useState("scan");
  const [image, setImage] = useState(null);
  const [imageB64, setImageB64] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState("");
  const [results, setResults] = useState(null);
  const [logModal, setLogModal] = useState(null);
  const [logRating, setLogRating] = useState(0);
  const [logNotes, setLogNotes] = useState("");
  const [logSaving, setLogSaving] = useState(false);
  const [wineLog, setWineLog] = useState([]);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [historyDetail, setHistoryDetail] = useState(null);
  const fileRef = useRef();
  const fileLibRef = useRef();

  // Load prefs & log from Supabase when logged in
  useEffect(() => {
    if (!session) return;
    loadPrefs();
    loadLog();
    loadScanHistory();
  }, [session]);

  // Auto-refresh session token every 45 minutes to prevent expiry
  useEffect(() => {
    if (!session) return;
    const refresh = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.access_token) setSession(data);
        }
      } catch {}
    };
    // Refresh every 45 minutes
    const interval = setInterval(refresh, 45 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session]);

  const handleSessionExpired = () => {
    setSession(null);
    alert("Your session has expired. Please sign in again — your data is safe!");
  };

  const loadPrefs = async () => {
    try {
      const rows = await sb(`user_prefs?user_id=eq.${session.user.id}&select=*`, {
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
      });
      if (rows?.length) setPrefs(rows[0].prefs);
    } catch {}
  };

  const loadLog = async () => {
    try {
      const rows = await sb(`wine_log?user_id=eq.${session.user.id}&order=created_at.desc&select=*`, {
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
      });
      setWineLog(rows || []);
    } catch {}
  };

  const loadScanHistory = async () => {
    try {
      const rows = await sb(`scan_history?user_id=eq.${session.user.id}&order=created_at.desc&select=*`, {
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
      });
      setScanHistory(rows || []);
    } catch {}
  };

  const getLocation = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
            const data = await res.json();
            const addr = data.address || {};
            const place = addr.restaurant || addr.cafe || addr.bar || addr.amenity || addr.building || addr.road || "";
            const city = addr.city || addr.town || addr.village || addr.suburb || "";
            const state = addr.state || "";
            resolve({ place, city, state, lat: latitude, lon: longitude });
          } catch { resolve(null); }
        },
        () => resolve(null),
        { timeout: 5000 }
      );
    });
  };

  const saveScanHistory = async (scanResults, locationLabel) => {
    if (!session) return;
    try {
      const limit = prefs.scanHistoryLimit || 5;
      await sb("scan_history", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          user_id: session.user.id,
          location_label: locationLabel,
          wine_count: scanResults.wines?.length || 0,
          results_json: scanResults,
        }),
      });
      // Trim to limit
      const rows = await sb(`scan_history?user_id=eq.${session.user.id}&order=created_at.desc&select=id`, {
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
      });
      if (rows && rows.length > limit) {
        const toDelete = rows.slice(limit).map(r => r.id);
        for (const id of toDelete) {
          await sb(`scan_history?id=eq.${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
          });
        }
      }
      loadScanHistory();
    } catch {}
  };

  const deleteScanHistory = async (id) => {
    try {
      await sb(`scan_history?id=eq.${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
      });
      loadScanHistory();
    } catch {}
  };

  // ── Auth ──
  const handleAuth = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const data = await sbAuth(authMode === "login" ? "token?grant_type=password" : "signup", {
        email: authEmail,
        password: authPass,
      });
      if (data.access_token) setSession(data);
      else if (authMode === "signup") setAuthError("Check your email to confirm your account.");
    } catch (e) {
      setAuthError(e.message);
    }
    setAuthLoading(false);
  };

  // ── Camera ──
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1600;
        let { width, height } = img;
        if (width > height && width > MAX) { height = (height * MAX) / width; width = MAX; }
        else if (height > MAX) { width = (width * MAX) / height; height = MAX; }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.82).split(",")[1]);
      };
      img.src = url;
    });
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(URL.createObjectURL(file));
    setResults(null);
    const b64 = await compressImage(file);
    setImageB64(b64);
  };

  // ── Scan ──
  const handleScan = async () => {
    if (!imageB64) return;
    setScanning(true);
    setResults(null);
    try {
      setScanStep("Reading the wine list...");
      const system = `You are a wine expert assistant. Analyze the restaurant wine list photo and return a JSON object.

CRITICAL RULES:
- Return ONLY raw JSON. No markdown. No code fences. No explanation. Start with { and end with }.
- The wines array uses 0-based indexing. First wine = index 0, second wine = index 1, etc.
- top_picks and value_picks must contain valid indices into the wines array.
- Every wine object must include ALL fields shown below, use null for missing values.
- value_score = rating divided by price_per_glass. If only bottle price, use rating divided by (price_per_bottle divided by 5).

User preferences: ${JSON.stringify(prefs)}
Minimum rating for value picks: ${prefs.minRating}

Return this exact structure:
{
  "wines": [
    {
      "name": "Silver Oak",
      "vintage": "2019",
      "type": "Red",
      "varietal": "Cabernet Sauvignon",
      "region": "Napa Valley",
      "price_glass": 28,
      "price_bottle": 110,
      "rating": 94,
      "rating_source": "Wine Spectator",
      "value_score": 3.36
    }
  ],
  "top_picks": [0, 2, 4],
  "value_picks": [1, 3, 0],
  "top_reasons": ["Exceptional Napa Cab matching your preference for California reds", "reason2", "reason3"],
  "value_reasons": ["Outstanding 91pts at only $12/glass is exceptional value", "reason2", "reason3"]
}

IMPORTANT: top_picks and value_picks are arrays of INTEGER indices (0, 1, 2...) referencing positions in the wines array. The first wine in the list is index 0. Double-check that every index in top_picks and value_picks exists in the wines array before returning.`;

      setScanStep("Finding ratings & calculating value scores...");
      const reply = await askClaude([
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageB64 } },
            { type: "text", text: "Please analyze this wine list and return recommendations as JSON." },
          ],
        },
      ], system);

      setScanStep("Building your recommendations...");
      let parsed;
      try {
        // Try multiple strategies to extract JSON from the response
        let jsonStr = reply;
        // Remove markdown code fences
        jsonStr = jsonStr.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
        // Try to find JSON object boundaries
        const firstBrace = jsonStr.indexOf("{");
        const lastBrace = jsonStr.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1) {
          jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }
        jsonStr = jsonStr.trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        // Last resort: ask Claude again with stricter instructions
        setScanStep("Retrying analysis...");
        const retry = await askClaude([
          { role: "user", content: "Return ONLY a raw JSON object with no markdown, no explanation, no code fences. Just the JSON starting with { and ending with }. Analyze the wine list image I sent before and return the wine recommendations JSON." }
        ], "You are a JSON API. Return only raw valid JSON, nothing else. No markdown. No explanation. Just JSON.");
        try {
          let retryStr = retry;
          const fb = retryStr.indexOf("{");
          const lb = retryStr.lastIndexOf("}");
          if (fb !== -1 && lb !== -1) retryStr = retryStr.substring(fb, lb + 1);
          parsed = JSON.parse(retryStr.trim());
        } catch {
          throw new Error("Could not parse wine data. Please try again with a clearer photo.");
        }
      }
      setResults(parsed);
      // Save to history with location
      setScanStep("Saving to history...");
      const loc = await getLocation();
      let locationLabel = "";
      if (loc) {
        if (loc.place) locationLabel = `${loc.place}, ${loc.city}, ${loc.state}`;
        else if (loc.city) locationLabel = `${loc.city}, ${loc.state}`;
        else locationLabel = "Unknown location";
      } else {
        // Try to extract restaurant name from wine list via AI
        try {
          const nameReply = await askClaude([
            { role: "user", content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageB64 } },
              { type: "text", text: "Look at this wine list. If you can see a restaurant name or establishment name anywhere on it, return ONLY that name. If you cannot determine the name, return exactly: Unknown Location" }
            ]}
          ], "You are a name extractor. Return only the restaurant name or 'Unknown Location'. Nothing else.");
          locationLabel = nameReply.trim().replace(/^["']|["']$/g, "");
          if (locationLabel.toLowerCase().includes("unknown") || locationLabel.length > 60) locationLabel = "Unknown Location";
        } catch { locationLabel = "Unknown Location"; }
      }
      await saveScanHistory(parsed, locationLabel);
    } catch (e) {
      alert("Scan failed: " + e.message);
    }
    setScanning(false);
    setScanStep("");
  };

  // ── Log wine ──
  const openLog = (wine) => {
    setLogModal(wine);
    setLogRating(0);
    setLogNotes("");
  };

  const saveLog = async () => {
    if (!logModal || !session) return;
    setLogSaving(true);
    try {
      await sb("wine_log", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          user_id: session.user.id,
          wine_name: logModal.name,
          vintage: logModal.vintage,
          rating_pts: logModal.rating,
          my_rating: logRating,
          notes: logNotes,
          price_glass: logModal.price_glass,
          price_bottle: logModal.price_bottle,
          value_score: logModal.value_score,
        }),
      });
      setLogModal(null);
      loadLog();
      setTab("log");
    } catch (e) {
      if (e.message === "session_expired") { handleSessionExpired(); return; }
      alert("Could not save: " + e.message);
    }
    setLogSaving(false);
  };

  // ── Save prefs ──
  const savePrefs = async () => {
    if (!session) return;
    try {
      const existing = await sb(`user_prefs?user_id=eq.${session.user.id}&select=id`, {
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
      });
      if (existing?.length) {
        await sb(`user_prefs?user_id=eq.${session.user.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ prefs }),
        });
      } else {
        await sb("user_prefs", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ user_id: session.user.id, prefs }),
        });
      }
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2500);
    } catch (e) {
      if (e.message === "session_expired") { handleSessionExpired(); return; }
      alert("Could not save preferences: " + e.message);
    }
  };

  const toggleChip = (key, val) => {
    setPrefs(p => ({
      ...p,
      [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val],
    }));
  };

  // ── Auth screen ──
  if (!session) {
    return (
      <>
        <style>{css}</style>
        <div className="auth-screen">
          <div className="auth-logo">Vinara</div>
          <div className="auth-tagline">Your personal wine sommelier</div>
          <div className="auth-card">
            <h2 className="auth-title">{authMode === "login" ? "Welcome back" : "Create account"}</h2>
            {authError && <div className="error-msg">{authError}</div>}
            <div className="field">
              <label>Email</label>
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={authPass} onChange={e => setAuthPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleAuth()} />
            </div>
            <button className="btn-primary" onClick={handleAuth} disabled={authLoading}>
              {authLoading ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"}
            </button>
            <div className="auth-switch">
              {authMode === "login" ? "New here? " : "Already have an account? "}
              <button onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }}>
                {authMode === "login" ? "Create account" : "Sign in"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Main app ──
  const getWine = (idx) => results?.wines?.[idx];

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header">
          <div className="header-logo">Vinara</div>
          <div className="header-actions">
            <button onClick={() => setSession(null)} style={{background:"none",border:"none",fontSize:"0.75rem",fontWeight:"500",color:"var(--ink-muted)",letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",padding:"6px 10px",borderRadius:"var(--r-sm)",transition:"color 0.2s"}} onMouseOver={e=>e.target.style.color="var(--wine)"} onMouseOut={e=>e.target.style.color="var(--ink-muted)"}>Sign out</button>
          </div>
        </div>

        {/* ── Scan Tab ── */}
        {tab === "scan" && (
          <div className="screen">
            {!results && !scanning && (
              <>
                <div className="scan-hero">
                  <h2>Scan a wine list</h2>
                  <p>Take a photo of any restaurant wine list and get personalized recommendations in seconds.</p>
                </div>
                {/* Hidden inputs — one forces camera, one allows all sources */}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
                <input ref={fileLibRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />

                {image
                  ? <img src={image} className="preview-img" alt="Wine list preview" />
                  : (
                    <>
                      <button className="camera-btn-primary" onClick={() => fileRef.current.click()}>
                        <span className="cam-icon">📷</span>
                        <span>Take a photo</span>
                      </button>
                      <button className="camera-btn-secondary" onClick={() => fileLibRef.current.click()}>
                        <span style={{fontSize:"1.1rem"}}>🗂️</span>
                        <span>Photo Library, File or Google Drive</span>
                      </button>
                    </>
                  )}
                {image && (
                  <>
                    <button className="camera-btn-primary" style={{ padding: "0.9rem" }} onClick={() => { setImage(null); setImageB64(null); }}>
                      <span>↺ Retake photo</span>
                    </button>
                    <button className="btn-scan" onClick={handleScan}>
                      🍷 Analyze wine list
                    </button>
                  </>
                )}
              </>
            )}

            {scanning && (
              <div className="loading-wrap">
                <div className="spinner" />
                <p>{scanStep || "Analyzing your wine list..."}<br /><br />
                  <small>AI is reading the menu, looking up ratings, and calculating value scores based on your preferences.</small>
                </p>
              </div>
            )}

            {results && !scanning && (
              <>
                <button className="back-btn" onClick={() => { setResults(null); setImage(null); setImageB64(null); }}>
                  ← Scan another list
                </button>
                <div className="results-header">
                  <h2 className="section-heading">Your recommendations</h2>
                  <p className="section-sub">{results.wines?.length} wines found · Based on your preferences</p>
                </div>
                {/* Safety fallback: if picks are empty or invalid, auto-populate from wines array */}
                {(() => {
                  const wines = results.wines || [];
                  if (wines.length > 0) {
                    if (!results.top_picks?.length || results.top_picks.every(i => !wines[i])) {
                      results.top_picks = wines.map((_, i) => i).slice(0, 3);
                      results.top_reasons = wines.slice(0,3).map(w => `${w.rating}pt ${w.varietal} matching your preferences`);
                    }
                    if (!results.value_picks?.length || results.value_picks.every(i => !wines[i])) {
                      const sorted = [...wines].map((w,i) => ({...w, _i:i})).filter(w => w.rating >= (prefs.minRating||85) && (w.value_score||0) > 0).sort((a,b) => (b.value_score||0)-(a.value_score||0));
                      results.value_picks = sorted.slice(0,3).map(w => w._i);
                      results.value_reasons = sorted.slice(0,3).map(w => `${w.rating}pts at $${w.price_glass||Math.round((w.price_bottle||0)/5)}/gl is excellent value`);
                    }
                  }
                  return null;
                })()}

                <div className="rec-columns">
                  <div className="rec-col">
                    <div className="rec-col-title"><span>⭐</span> Top picks</div>
                    {results.top_picks?.slice(0, 3).map((idx, i) => {
                      const w = getWine(idx);
                      if (!w) return null;
                      return (
                        <div key={i} className="wine-card top" onClick={() => openLog(w)}>
                          <div className="wine-rank">#{i + 1} pick</div>
                          <div className="wine-name">{w.name}</div>
                          <div className="wine-vintage">{w.vintage} · {w.varietal}</div>
                          <div className="wine-meta">
                            <div className="wine-score">
                              <span className="score-badge">{w.rating}</span>
                              <span style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>{w.rating_source}</span>
                            </div>
                            <div className="wine-price">
                              {w.price_glass ? `$${w.price_glass}/gl` : ""}
                              {w.price_glass && w.price_bottle ? " · " : ""}
                              {w.price_bottle ? `$${w.price_bottle}/btl` : ""}
                            </div>
                            {results.top_reasons?.[i] && <div className="why-badge">"{results.top_reasons[i]}"</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rec-col">
                    <div className="rec-col-title"><span>💰</span> Best value</div>
                    {results.value_picks?.slice(0, 3).map((idx, i) => {
                      const w = getWine(idx);
                      if (!w) return null;
                      return (
                        <div key={i} className="wine-card value" onClick={() => openLog(w)}>
                          <div className="wine-rank">#{i + 1} value</div>
                          <div className="wine-name">{w.name}</div>
                          <div className="wine-vintage">{w.vintage} · {w.varietal}</div>
                          <div className="wine-meta">
                            <div className="wine-score">
                              <span className="score-badge good">{w.rating}</span>
                              <span style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>{w.rating_source}</span>
                            </div>
                            <div className="wine-price">
                              {w.price_glass ? `$${w.price_glass}/gl` : ""}
                              {w.price_glass && w.price_bottle ? " · " : ""}
                              {w.price_bottle ? `$${w.price_bottle}/btl` : ""}
                            </div>
                            <div className="value-score">Value score: {w.value_score?.toFixed(1)}</div>
                            {results.value_reasons?.[i] && <div className="why-badge">"{results.value_reasons[i]}"</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", textAlign: "center" }}>Tap any wine to log it to your wine journal</p>
              </>
            )}
          </div>
        )}

        {/* ── Log Tab ── */}
        {tab === "log" && (
          <div className="screen">
            <h2 className="section-heading">My wine journal</h2>
            <p className="section-sub">{wineLog.length} wine{wineLog.length !== 1 ? "s" : ""} logged</p>
            {wineLog.length === 0
              ? (
                <div className="log-empty">
                  <div className="empty-icon">🍷</div>
                  <p>Your wine journal is empty.<br />Scan a wine list and tap a recommendation to log your first wine.</p>
                </div>
              )
              : wineLog.map((w, i) => (
                <div key={i} className="log-item">
                  <div className="log-item-header">
                    <div className="log-wine-name">{w.wine_name} {w.vintage}</div>
                    <div className="log-stars">{"⭐".repeat(w.my_rating || 0)}</div>
                  </div>
                  <div className="log-meta">
                    {w.rating_pts}pts · {w.price_glass ? `$${w.price_glass}/gl` : ""}{w.price_bottle ? ` · $${w.price_bottle}/btl` : ""} · {new Date(w.created_at).toLocaleDateString()}
                  </div>
                  {w.notes && <div className="log-notes">"{w.notes}"</div>}
                </div>
              ))}
          </div>
        )}

        {/* ── History Tab ── */}
        {tab === "history" && !historyDetail && (
          <div className="screen">
            <h2 className="section-heading">Scan history</h2>
            <p className="section-sub">{scanHistory.length} saved scan{scanHistory.length !== 1 ? "s" : ""} · Tap to view recommendations</p>
            {scanHistory.length === 0
              ? (
                <div className="log-empty">
                  <div className="empty-icon">🗂️</div>
                  <p>No scans saved yet.<br />Scan a wine list and your recommendations will be saved here automatically.</p>
                </div>
              )
              : scanHistory.map((s, i) => (
                <div key={i} className="history-item" onClick={() => setHistoryDetail(s)}>
                  <div className="history-icon">📍</div>
                  <div className="history-info">
                    <div className="history-location">{s.location_label || "Unknown Location"}</div>
                    <div className="history-meta">{new Date(s.created_at).toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric", year:"numeric" })} · {s.wine_count} wines scanned</div>
                  </div>
                  <button className="history-delete" onClick={e => { e.stopPropagation(); if (window.confirm("Delete this scan?")) deleteScanHistory(s.id); }}>🗑️</button>
                </div>
              ))}
          </div>
        )}

        {/* ── History Detail ── */}
        {tab === "history" && historyDetail && (() => {
          const r = historyDetail.results_json;
          const getWineH = (idx) => r?.wines?.[idx];
          return (
            <div className="screen">
              <button className="back-btn" onClick={() => setHistoryDetail(null)}>← Back to history</button>
              <div className="history-detail-header">
                <div>
                  <div className="history-detail-location">{historyDetail.location_label || "Unknown Location"}</div>
                  <div className="history-detail-date">{new Date(historyDetail.created_at).toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })} · {historyDetail.wine_count} wines scanned</div>
                </div>
              </div>
              <div className="rec-columns">
                <div className="rec-col">
                  <div className="rec-col-title"><span>⭐</span> Top picks</div>
                  {r?.top_picks?.slice(0,3).map((idx, i) => {
                    const w = getWineH(idx);
                    if (!w) return null;
                    return (
                      <div key={i} className="wine-card top" onClick={() => openLog(w)}>
                        <div className="wine-rank">#{i+1} pick</div>
                        <div className="wine-name">{w.name}</div>
                        <div className="wine-vintage">{w.vintage} · {w.varietal}</div>
                        <div className="wine-meta">
                          <div className="wine-score"><span className="score-badge">{w.rating}</span><span style={{fontSize:"0.7rem",color:"var(--ink-muted)"}}>{w.rating_source}</span></div>
                          <div className="wine-price">{w.price_glass ? `$${w.price_glass}/gl` : ""}{w.price_glass && w.price_bottle ? " · " : ""}{w.price_bottle ? `$${w.price_bottle}/btl` : ""}</div>
                          {r.top_reasons?.[i] && <div className="why-badge">"{r.top_reasons[i]}"</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rec-col">
                  <div className="rec-col-title"><span>💰</span> Best value</div>
                  {r?.value_picks?.slice(0,3).map((idx, i) => {
                    const w = getWineH(idx);
                    if (!w) return null;
                    return (
                      <div key={i} className="wine-card value" onClick={() => openLog(w)}>
                        <div className="wine-rank">#{i+1} value</div>
                        <div className="wine-name">{w.name}</div>
                        <div className="wine-vintage">{w.vintage} · {w.varietal}</div>
                        <div className="wine-meta">
                          <div className="wine-score"><span className="score-badge good">{w.rating}</span><span style={{fontSize:"0.7rem",color:"var(--ink-muted)"}}>{w.rating_source}</span></div>
                          <div className="wine-price">{w.price_glass ? `$${w.price_glass}/gl` : ""}{w.price_glass && w.price_bottle ? " · " : ""}{w.price_bottle ? `$${w.price_bottle}/btl` : ""}</div>
                          <div className="value-score">Value score: {w.value_score?.toFixed(1)}</div>
                          {r.value_reasons?.[i] && <div className="why-badge">"{r.value_reasons[i]}"</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p style={{fontSize:"0.75rem",color:"var(--ink-muted)",textAlign:"center"}}>Tap any wine to log it to your journal</p>
            </div>
          );
        })()}

        {/* ── Settings Tab ── */}
        {tab === "settings" && (
          <div className="screen">
            <h2 className="section-heading">Preferences</h2>
            <p className="section-sub">Tell Vinara what you love so it can recommend better wines.</p>

            {prefsSaved && <div className="success-msg">✓ Preferences saved!</div>}

            <div className="settings-section">
              <div className="settings-title">Wine type</div>
              <div className="pref-chips">
                {["Red", "White", "Rosé", "Sparkling"].map(t => (
                  <button key={t} className={`chip ${prefs.types.includes(t) ? "selected" : ""}`} onClick={() => toggleChip("types", t)}>{t}</button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-title">Favorite varietals</div>
              <div className="pref-chips">
                {["Cabernet Sauvignon", "Pinot Noir", "Chardonnay", "Sauvignon Blanc", "Merlot", "Syrah", "Pinot Grigio", "Malbec", "Zinfandel", "Riesling"].map(v => (
                  <button key={v} className={`chip ${prefs.varietals.includes(v) ? "selected" : ""}`} onClick={() => toggleChip("varietals", v)}>{v}</button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-title">Regions</div>
              <div className="pref-chips">
                {["California", "France", "Italy", "Spain", "Oregon", "Washington", "Argentina", "Australia", "New Zealand", "Germany"].map(r => (
                  <button key={r} className={`chip ${prefs.regions.includes(r) ? "selected" : ""}`} onClick={() => toggleChip("regions", r)}>{r}</button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-title">Price & rating limits</div>
              <div className="slider-wrap">
                <div className="slider-label"><span>Max price per glass</span><strong>${prefs.maxPrice}</strong></div>
                <input type="range" min={10} max={150} step={5} value={prefs.maxPrice} onChange={e => setPrefs(p => ({ ...p, maxPrice: +e.target.value }))} />
              </div>
              <div className="slider-wrap">
                <div className="slider-label"><span>Min rating for value picks</span><strong>{prefs.minRating} pts</strong></div>
                <input type="range" min={80} max={95} step={1} value={prefs.minRating} onChange={e => setPrefs(p => ({ ...p, minRating: +e.target.value }))} />
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-title">Scan history</div>
              <div className="slider-wrap">
                <div className="slider-label"><span>Scans to keep</span><strong>{prefs.scanHistoryLimit || 5}</strong></div>
                <input type="range" min={1} max={50} step={1} value={prefs.scanHistoryLimit || 5} onChange={e => setPrefs(p => ({ ...p, scanHistoryLimit: +e.target.value }))} />
              </div>
              <p style={{fontSize:"0.75rem",color:"var(--ink-muted)"}}>Older scans are automatically removed when the limit is reached. Default is 5, max is 50.</p>
            </div>

            <button className="btn-save" onClick={savePrefs}>Save preferences</button>
          </div>
        )}

        {/* ── Version ── */}
        <div style={{textAlign:"center",padding:"4px 0",background:"var(--white)",borderTop:"1px solid var(--border)",fontSize:"0.65rem",color:"var(--ink-muted)",letterSpacing:"0.08em"}}>
          v1.0.9
        </div>

        {/* ── Bottom Nav ── */}
        <nav className="bottom-nav">
          {[
            { id: "scan", icon: "📷", label: "Scan" },
            { id: "log", icon: "📓", label: "Journal" },
            { id: "history", icon: "🗂️", label: "History" },
            { id: "settings", icon: "⚙️", label: "Settings" },
          ].map(n => (
            <button key={n.id} className={`nav-item ${tab === n.id ? "active" : ""}`} onClick={() => { setTab(n.id); setHistoryDetail(null); }}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        {/* ── Log Modal ── */}
        {logModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setLogModal(null)}>
            <div className="modal">
              <div className="modal-handle" />
              <div className="modal-title">{logModal.name} {logModal.vintage}</div>
              <div className="modal-sub">{logModal.rating}pts · {logModal.rating_source} · {logModal.varietal}</div>
              <div className="slider-label" style={{ marginBottom: "8px" }}><span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Your rating</span></div>
              <div className="star-row">
                {[1, 2, 3, 4, 5].map(s => (
                  <span key={s} className={`star ${logRating >= s ? "active" : ""}`} onClick={() => setLogRating(s)}>⭐</span>
                ))}
              </div>
              <textarea className="notes-field" rows={3} placeholder="Tasting notes (optional)..." value={logNotes} onChange={e => setLogNotes(e.target.value)} />
              <button className="btn-log" onClick={saveLog} disabled={logSaving}>{logSaving ? "Saving..." : "Add to journal"}</button>
              <button className="btn-cancel" onClick={() => setLogModal(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

