import React from 'react';
import ReactDOM from 'react-dom';

// ====================================================================
// Atoms — Icon, Button, Avatar, Input, Select
// ====================================================================

const ICONS = {
  "home":       <path d="M3 12l9-9 9 9M5 10v10h14V10" />,
  "users":      <g><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 3a4 4 0 0 1 0 8M22 21a7 7 0 0 0-6-6.93"/></g>,
  "calendar":   <g><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></g>,
  "wallet":     <g><path d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h16v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6"/><circle cx="17" cy="14" r="1.2"/></g>,
  "chart":      <path d="M3 3v18h18M7 14l4-4 4 4 5-5"/>,
  "settings":   <g><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></g>,
  "search":     <g><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></g>,
  "plus":       <path d="M12 5v14M5 12h14"/>,
  "bell":       <g><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></g>,
  "arrow-up":   <path d="M5 12l7-7 7 7M12 19V5"/>,
  "arrow-down": <path d="M19 12l-7 7-7-7M12 5v14"/>,
  "arrow-right":<path d="M5 12h14m-7-7 7 7-7 7"/>,
  "more":       <g><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></g>,
  "user-plus":  <g><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 8v6M22 11h-6"/></g>,
  "filter":     <path d="M3 6h18M6 12h12M10 18h4"/>,
  "download":   <g><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></g>,
  "phone":      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/>,
  "check":      <path d="M20 6L9 17l-5-5"/>,
  "x":          <path d="M18 6 6 18M6 6l12 12"/>,
  "clock":      <g><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g>,
  "card":       <g><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20M6 16h3"/></g>,
  "logout":     <g><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></g>,
  "menu":       <path d="M3 6h18M3 12h18M3 18h18"/>,
  "command":    <path d="M18 3a3 3 0 0 0 0 6h-3V6a3 3 0 1 0-3 3h6m0 0v6m0-6h3a3 3 0 1 1 0 6h-3v-3m0 0h-6m6 0v3a3 3 0 1 1-3-3h3"/>,
  "trending-up":<path d="M3 17l6-6 4 4 8-8M14 7h7v7"/>,
  "minus":      <path d="M5 12h14"/>,
  "graduation": <g><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/></g>,
  "edit":       <g><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></g>,
  "eye":        <g><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></g>,
  "eye-off":    <g><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></g>,
  "bike":       <g><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M5.5 17.5L9 10l4.5 3 3-6h2M12 10h2.5l2 7.5M9 10l2-4h3"/></g>,
};

// Shared inline style constants — reduces ~300 lines of duplicated props across screens.
const LABEL_STYLE = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" };
const MONO_VAL    = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" };

function Icon({ name, size = 18, color = "currentColor", className = "", style = {} }) {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
         className={className} style={style}>
      {path}
    </svg>
  );
}

// --------------------------------------------------------------------
// Button
// --------------------------------------------------------------------
function Button({ variant = "primary", size = "md", icon, children, onClick, disabled, style = {} }) {
  const bs = {
    fontFamily: "var(--font-ui)",
    fontWeight: 600,
    fontSize: size === "sm" ? 12 : 13,
    padding: size === "sm" ? "7px 12px" : "10px 16px",
    borderRadius: size === "sm" ? 10 : 14,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    lineHeight: 1,
    letterSpacing: "0.005em",
    whiteSpace: "nowrap",
    transition: "all 140ms var(--ease-out)",
    opacity: disabled ? 0.4 : 1,
  };
  const variants = {
    primary: { background: "var(--neon-cyan)", color: "var(--fg-inverse)",
               boxShadow: "0 0 0 1px var(--neon-cyan), 0 0 24px var(--neon-cyan-glow)" },
    success: { background: "var(--neon-lime)", color: "var(--fg-inverse)",
               boxShadow: "0 0 0 1px var(--neon-lime), 0 0 24px var(--neon-lime-glow)" },
    danger:  { background: "var(--neon-pink)", color: "var(--fg-inverse)",
               boxShadow: "0 0 0 1px var(--neon-pink), 0 0 24px var(--neon-pink-glow)" },
    secondary: { background: "var(--glass-2)", color: "var(--fg-1)",
                 border: "1px solid var(--glass-stroke-strong)",
                 backdropFilter: "var(--glass-blur-soft)", WebkitBackdropFilter: "var(--glass-blur-soft)" },
    ghost: { background: "transparent", color: "var(--fg-2)",
             border: "1px solid var(--glass-stroke)" },
    icon: { background: "var(--glass-2)", color: "var(--fg-1)",
            border: "1px solid var(--glass-stroke)", padding: 10, borderRadius: 10 },
  };
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
            style={{ ...bs, ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={size === "sm" ? 13 : 15} />}
      {children}
    </button>
  );
}

// --------------------------------------------------------------------
// Avatar
// --------------------------------------------------------------------
const GRADIENTS = [
  "linear-gradient(135deg, #00E5FF, #8B6CFF)",
  "linear-gradient(135deg, #FF3D8A, #FFB020)",
  "linear-gradient(135deg, #B6FF3C, #00E5FF)",
  "linear-gradient(135deg, #8B6CFF, #FF3D8A)",
  "linear-gradient(135deg, #FFB020, #B6FF3C)",
];
function Avatar({ name, size = 32, glow = false }) {
  const initials = name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase();
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const grad = GRADIENTS[hash % GRADIENTS.length];
  return (
    <span style={{
      width: size, height: size, borderRadius: 999,
      background: grad, display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-display)", fontWeight: 600, fontSize: size * 0.38,
      color: "var(--ink-0)", flexShrink: 0,
      boxShadow: glow ? "0 0 14px var(--neon-cyan-glow)" : "0 1px 3px rgba(0,0,0,0.4)",
    }}>{initials}</span>
  );
}

// --------------------------------------------------------------------
// Input
//
// `type` is forwarded straight to the underlying <input> — defaults to
// "text". Callers wanting a masked password field pass type="password"
// (RecordCreatorModal threads this through via field metadata).
// --------------------------------------------------------------------
function Input({ label, value, onChange, placeholder, mono = false, prefix, type = "text",
                 digits = false, maxDigits, format, storeFormatted = false }) {
  // digits=true     → strip non-digits on every keystroke (cap at maxDigits).
  // format          → live mask fn (e.g. fmtPhone, fmtMoneyInput, fmtDateInput).
  //                   Applied to the visible input value AS THE USER TYPES.
  // storeFormatted  → onChange emits the formatted display value (use for
  //                   dates where storage form IS the formatted string).
  //                   Default: onChange emits the bare digit-stripped value.
  // Cursor preservation: we track caret position by *digit count to the left*
  // of the caret, then restore that digit-count after re-format. This keeps
  // the caret intuitively placed even when masks add/remove separators.
  const [focused, setFocused] = React.useState(false);
  // Password-only: toggle visibility. The eye button on the right swaps
  // the rendered `type` between "password" and "text". Lives next to the
  // input inside the same focus-styled wrapper.
  const [revealed, setRevealed] = React.useState(false);
  const inputRef = React.useRef(null);
  const caretRef = React.useRef(null);
  const rawValue = String(value ?? "");
  const display  = format ? format(rawValue) : rawValue;
  const isPassword     = type === "password";
  const effectiveType  = isPassword && revealed ? "text" : type;
  // After every render where a caret target is queued, restore selection.
  React.useEffect(() => {
    if (!inputRef.current || caretRef.current == null) return;
    const want = caretRef.current; caretRef.current = null;
    const cur = inputRef.current.value;
    // Walk `cur` and find the offset where `want` digits have been counted.
    let digitsSeen = 0, i = 0;
    while (i < cur.length && digitsSeen < want) {
      if (/\d/.test(cur[i])) digitsSeen++;
      i++;
    }
    try { inputRef.current.setSelectionRange(i, i); } catch {}
  });
  const handle = (e) => {
    if (!onChange) return;
    const raw = e.target.value;
    // Count digits before the caret in the user-typed string. We'll restore
    // the caret after format() to the position with that many digits.
    if (format && digits) {
      const caret = e.target.selectionStart ?? raw.length;
      let d = 0;
      for (let i = 0; i < caret; i++) if (/\d/.test(raw[i])) d++;
      caretRef.current = d;
    }
    if (!digits) return onChange(raw);
    let d = raw.replace(/\D+/g, "");
    if (maxDigits) d = d.slice(0, maxDigits);
    onChange(storeFormatted && format ? format(d) : d);
  };
  const usingMono = mono || digits;  // digit fields always render in tabular-nums
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{
        fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
        textTransform: "uppercase", color: "var(--fg-3)",
      }}>{label}</label>}
      {/* Focus styling is on the wrapper — not the inner <input> — so the
          cyan ring traces the visible capsule edge instead of the smaller
          inner element. The inner input's focus-visible box-shadow is
          explicitly nulled to suppress the global ring. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "var(--ink-2)",
        border: `1px solid ${focused ? "var(--neon-cyan)" : "var(--glass-stroke)"}`,
        boxShadow: focused ? "0 0 14px var(--neon-cyan-haze)" : "none",
        borderRadius: 10, padding: "0 12px",
        transition: "border-color 140ms var(--ease-out), box-shadow 140ms var(--ease-out)",
      }}>
        {prefix && <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-3)" }}>{prefix}</span>}
        <input ref={inputRef} value={display} onChange={handle} placeholder={placeholder}
               type={effectiveType}
               inputMode={digits ? "numeric" : undefined}
               autoComplete={isPassword ? "new-password" : undefined}
               onFocus={() => setFocused(true)}
               onBlur={() => setFocused(false)}
               style={{
                 flex: 1, background: "transparent", border: "none", outline: "none",
                 padding: "10px 0", color: "var(--fg-1)",
                 fontFamily: usingMono ? "var(--font-mono)" : "var(--font-ui)",
                 fontSize: 14, fontVariantNumeric: usingMono ? "tabular-nums" : "normal",
                 boxShadow: "none",  // disable the global *:focus-visible ring on the inner input
               }}/>
        {isPassword && (
          // tabIndex=-1 so the eye sits outside the natural tab order
          // (users tabbing past the password shouldn't land on the toggle).
          // onMouseDown preventDefault keeps the password input focused
          // when the icon is clicked, so the caret doesn't jump away.
          <button type="button" tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setRevealed(v => !v)}
                  aria-label={revealed ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  title={revealed ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  style={{
                    background: "transparent", border: "none", padding: 4,
                    margin: 0, display: "flex", alignItems: "center",
                    cursor: "pointer", color: "var(--fg-3)",
                    transition: "color 140ms var(--ease-out)",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--fg-1)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--fg-3)"}>
            <Icon name={revealed ? "eye-off" : "eye"} size={16}/>
          </button>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Select dropdown — used for Học phí, Khuyến mãi, Class, etc.
// --------------------------------------------------------------------
function Select({ label, value, onChange, options, placeholder = "Chọn…", note }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{
        fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
        textTransform: "uppercase", color: "var(--fg-3)",
      }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <select value={value || ""} onChange={e => onChange && onChange(e.target.value)} style={{
          width: "100%", appearance: "none", background: "var(--ink-2)",
          border: "1px solid var(--glass-stroke)", borderRadius: 10, padding: "10px 36px 10px 12px",
          color: value ? "var(--fg-1)" : "var(--fg-4)",
          fontFamily: "var(--font-ui)", fontSize: 14, cursor: "pointer", outline: "none",
        }}>
          {/* Disabled "Chọn…" only when nothing is selected — once the
              user picks a value (or the form is seeded with one), the
              placeholder line disappears from the dropdown so it can't
              be mistaken for an acceptable value. */}
          {!value && <option value="" disabled>{placeholder}</option>}
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Icon name="arrow-down" size={14}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--fg-3)" }}/>
      </div>
      {note && <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--fg-3)" }}>{note}</span>}
    </div>
  );
}

// --------------------------------------------------------------------
// Theme — single source of truth via React Context.
//
// `<ThemeProvider>` owns the state; `useTheme()` subscribes any
// component to the current theme. Components depending on JS-derived
// theme values (e.g. branch tones) must call `useTheme()` (or a hook
// built on it like `useBranchTones`) so they re-render on toggle.
//
// `data-theme` is mirrored onto <html> for CSS-var swap, and the
// choice persists to localStorage("mgt-theme").
// --------------------------------------------------------------------
const ThemeContext = React.createContext(null);

function ThemeProvider({ children }) {
  // ?print=dashboard forces light + skips localStorage persistence so the
  // PDF renders consistently regardless of the user's saved preference.
  const isPrintMode = () => {
    try { return new URLSearchParams(window.location.search).get("print") === "dashboard"; }
    catch { return false; }
  };
  const [theme, setTheme] = React.useState(() => {
    if (isPrintMode()) return "light";
    try { return localStorage.getItem("mgt-theme") || "dark"; } catch { return "dark"; }
  });
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (isPrintMode()) return;       // don't pollute the user's saved theme
    try { localStorage.setItem("mgt-theme", theme); } catch {}
  }, [theme]);
  const value = React.useMemo(() => [theme, setTheme], [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    // Fallback (no Provider): read once from localStorage, no subscription.
    // Components that toggle from outside the tree should wrap with the
    // Provider for reactive updates.
    const t = (() => { try { return localStorage.getItem("mgt-theme") || "dark"; } catch { return "dark"; } })();
    return [t, () => {}];
  }
  return ctx;
}

function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const isLight = theme === "light";
  return (
    <button
      onClick={() => setTheme(isLight ? "dark" : "light")}
      title={isLight ? "Chuyển sang Dark" : "Chuyển sang Light"}
      style={{
        position: "relative",
        flex: 1, height: 32, padding: 3, cursor: "pointer",
        borderRadius: 999,
        background: "var(--glass-2)",
        border: "1px solid var(--glass-stroke-strong)",
        backdropFilter: "var(--glass-blur-soft)",
        WebkitBackdropFilter: "var(--glass-blur-soft)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
        display: "inline-flex", alignItems: "center",
        transition: "background 220ms var(--ease-out)",
        overflow: "hidden",
      }}>
      {/* Track icons — sit at the inner edges */}
      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)", display: "inline-flex", opacity: isLight ? 1 : 0.45, transition: "opacity 140ms" }}>
        <SunGlyph size={14}/>
      </span>
      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)", display: "inline-flex", opacity: isLight ? 0.45 : 1, transition: "opacity 140ms" }}>
        <MoonGlyph size={13}/>
      </span>
      {/* Knob — oval pill, brand gradient, slides edge-to-edge with a
          firm cubic-bezier (no spring overshoot). Brand swaps to amber
          family in light mode. */}
      <span style={{
        position: "absolute", top: 3,
        left: isLight ? 3 : "calc(100% - 47px)",
        width: 44, height: 24, borderRadius: 999,
        background: isLight
          ? "linear-gradient(135deg, #FFB020, #D97500)"
          : "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))",
        boxShadow: isLight
          ? "0 0 14px rgba(217,117,0,0.55), 0 1px 2px rgba(0,0,0,0.25)"
          : "0 0 14px var(--neon-cyan-glow), 0 1px 2px rgba(0,0,0,0.35)",
        border: isLight
          ? "1px solid rgba(217,117,0,0.7)"
          : "1px solid color-mix(in oklab, var(--neon-cyan) 70%, transparent)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transition: "left 180ms cubic-bezier(0.65, 0, 0.35, 1)",
        color: "var(--ink-0)",
      }}>
        {isLight ? <SunGlyph size={13}/> : <MoonGlyph size={11}/>}
      </span>
    </button>
  );
}

function SunGlyph({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  );
}
function MoonGlyph({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

// --------------------------------------------------------------------
// Modal — generic. Portals to document.body so it always escapes the
// stacking context of whatever component invoked it (e.g. the Sidebar's
// sticky wrapper, a fixed-positioned floating panel, etc). This keeps
// the layering system simple: modals are always at the top, period.
// --------------------------------------------------------------------
function Modal({ open, onClose, title, subtitle, children, primaryAction, primaryLabel = "Lưu", primaryIcon = "check", width = 560, primaryDisabled, secondary, footerStart }) {
  // Esc-to-dismiss: only attach while open. Inputs/textareas/selects
  // don't natively consume Escape in HTML (it's not a typing key), so
  // we close unconditionally — matches OS-level dialog behaviour.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose && onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  // Backdrop click is intentionally NOT a close trigger — the user reported
  // accidental dismissals losing typed form data. Close affordances are:
  // the X icon, the Hủy button, and the Escape key.
  const node = (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        width, maxHeight: "92vh", overflow: "auto",
        background: "var(--glass-3)",
        backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-stroke-strong)", borderRadius: 24,
        padding: 22, boxShadow: "var(--shadow-3)",
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        {title && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{title}</h2>
              {subtitle && <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-3)" }}>{subtitle}</span>}
            </div>
            <Button variant="icon" onClick={onClose}><Icon name="x" size={14}/></Button>
          </div>
        )}
        {children}
        <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>{footerStart || null}</div>
          {secondary !== undefined ? secondary : <Button variant="ghost" onClick={onClose}>Hủy</Button>}
          <Button variant="primary" onClick={primaryAction} icon={primaryIcon} disabled={primaryDisabled}>{primaryLabel}</Button>
        </div>
      </div>
    </div>
  );
  return ReactDOM.createPortal(node, document.body);
}

export { Icon, Avatar, Input, Select, Button, LABEL_STYLE, MONO_VAL, ThemeProvider, useTheme, ThemeToggle, Modal };
