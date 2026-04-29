import { useState, useRef, useEffect } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

// ── Supabase helpers ──────────────────────────────────────────────────────────
const sb = async (path, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
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
  const fileRef = useRef();

  // Load prefs & log from Supabase when logged in
  useEffect(() => {
    if (!session) return;
    loadPrefs();
    loadLog();
  }, [session]);

  const loadPrefs = async () => {
    try {
      const rows = await sb(`user_prefs?user_id=eq.${session.user.id}&select=*`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (rows?.length) setPrefs(rows[0].prefs);
    } catch {}
  };

  const loadLog = async () => {
    try {
      const rows = await sb(`wine_log?user_id=eq.${session.user.id}&order=created_at.desc&select=*`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setWineLog(rows || []);
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
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(URL.createObjectURL(file));
    setResults(null);
    const reader = new FileReader();
    reader.onload = () => setImageB64(reader.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  // ── Scan ──
  const handleScan = async () => {
    if (!imageB64) return;
    setScanning(true);
    setResults(null);
    try {
      setScanStep("Reading the wine list...");
      const system = `You are a wine expert assistant. The user will send you a photo of a restaurant wine list.
Extract ALL wines from the image. For each wine provide realistic ratings (85-98 pts) from sources like Wine Spectator or Vivino, and a value score = rating / price_per_glass (or rating / (price_per_bottle/5) if only bottle price). 
User preferences: ${JSON.stringify(prefs)}.
Minimum rating for value list: ${prefs.minRating}.
Return ONLY valid JSON in this exact format, no markdown:
{
  "wines": [
    {"name": "...", "vintage": "...", "type": "Red|White|Rosé|Sparkling", "varietal": "...", "region": "...", "price_glass": 14, "price_bottle": null, "rating": 92, "rating_source": "Wine Spectator", "value_score": 6.57}
  ],
  "top_picks": [0, 1, 2],
  "value_picks": [0, 2, 3],
  "top_reasons": ["reason for pick 1", "reason for pick 2", "reason for pick 3"],
  "value_reasons": ["reason for pick 1", "reason for pick 2", "reason for pick 3"]
}
top_picks: indices of up to 3 best wines matching preferences by rating.
value_picks: indices of up to 3 best value wines (must meet minRating threshold).
reasons: short 1-sentence explanation why each wine was picked for that user.`;

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
        parsed = JSON.parse(reply.replace(/```json|```/g, "").trim());
      } catch {
        throw new Error("Could not parse wine data. Please try again.");
      }
      setResults(parsed);
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
        headers: { Authorization: `Bearer ${session.access_token}` },
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
      alert("Could not save: " + e.message);
    }
    setLogSaving(false);
  };

  // ── Save prefs ──
  const savePrefs = async () => {
    if (!session) return;
    try {
      const existing = await sb(`user_prefs?user_id=eq.${session.user.id}&select=id`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (existing?.length) {
        await sb(`user_prefs?user_id=eq.${session.user.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ prefs }),
        });
      } else {
        await sb("user_prefs", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ user_id: session.user.id, prefs }),
        });
      }
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2500);
    } catch (e) {
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
            <button className="icon-btn" title="Sign out" onClick={() => setSession(null)}>↩</button>
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
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
                {image
                  ? <img src={image} className="preview-img" alt="Wine list preview" />
                  : (
                    <button className="camera-btn" onClick={() => fileRef.current.click()}>
                      <span className="cam-icon">📷</span>
                      <span>Take a photo</span>
                      <small>or tap to choose from your library</small>
                    </button>
                  )}
                {image && (
                  <>
                    <button className="camera-btn" style={{ padding: "0.75rem", marginBottom: "0.75rem" }} onClick={() => { setImage(null); setImageB64(null); fileRef.current.click(); }}>
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

            <button className="btn-save" onClick={savePrefs}>Save preferences</button>
          </div>
        )}

        {/* ── Bottom Nav ── */}
        <nav className="bottom-nav">
          {[
            { id: "scan", icon: "📷", label: "Scan" },
            { id: "log", icon: "📓", label: "Journal" },
            { id: "settings", icon: "⚙️", label: "Settings" },
          ].map(n => (
            <button key={n.id} className={`nav-item ${tab === n.id ? "active" : ""}`} onClick={() => setTab(n.id)}>
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
