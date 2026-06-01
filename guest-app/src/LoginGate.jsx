// LoginGate — boot guard. On mount, tries to bring the store online
// (initStore -> /api/me + parallel data fetches). If the token is missing
// or stale (401), shows the login form. Otherwise renders <App/>.
//
// Visual is intentionally minimal — the guest-app brand chrome lives
// inside <App/> once we're authenticated. This is just the "first
// breath" screen.

import React from 'react';
import { api } from './api';
import { initStore } from './store';
import { Input, Button } from './components';

const STAGES = { boot: 'boot', login: 'login', ready: 'ready', error: 'error' };

export default function LoginGate({ children }) {
  const [stage, setStage] = React.useState(STAGES.boot);
  const [errorMsg, setErrorMsg] = React.useState('');

  const boot = React.useCallback(async () => {
    setStage(STAGES.boot);
    try {
      const has = await api.hasToken();
      if (!has) return setStage(STAGES.login);
      await initStore();
      setStage(STAGES.ready);
    } catch (e) {
      if (e.status === 401) { await api.clearToken(); return setStage(STAGES.login); }
      setErrorMsg(e.message || 'Lỗi khởi động.');
      setStage(STAGES.error);
    }
  }, []);

  React.useEffect(() => { boot(); }, [boot]);

  // Listen for logout (or any other auth-state reset) and re-run boot.
  // Saves a full page reload after sign-out.
  React.useEffect(() => {
    const onAuth = () => boot();
    window.addEventListener('mgt:auth', onAuth);
    return () => window.removeEventListener('mgt:auth', onAuth);
  }, [boot]);

  if (stage === STAGES.ready) return children;
  if (stage === STAGES.login) return <LoginForm onLoggedIn={boot}/>;
  if (stage === STAGES.error) return <ErrorView message={errorMsg} onRetry={boot}/>;
  return <BootView/>;
}

function BootView() {
  return (
    <div style={centered}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em',
                    textTransform: 'uppercase', color: 'var(--fg-3)' }}>
        Đang tải…
      </div>
    </div>
  );
}

function ErrorView({ message, onRetry }) {
  return (
    <div style={centered}>
      <div style={{ maxWidth: 320, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--neon-pink)' }}>
          Lỗi kết nối
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--fg-3)' }}>
          {message}
        </div>
        <Button variant="primary" onClick={onRetry}>Thử lại</Button>
      </div>
    </div>
  );
}

function LoginForm({ onLoggedIn }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  const submit = async () => {
    if (!email || !password || busy) return;
    setBusy(true); setErr('');
    try {
      await api.login(email.trim(), password);
      onLoggedIn();
    } catch (e) {
      setErr(e.message || 'Đăng nhập thất bại.');
    } finally { setBusy(false); }
  };

  return (
    <div style={centered}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16,
                    padding: 24, borderRadius: 20,
                    background: 'var(--glass-2)', border: '1px solid var(--glass-stroke)',
                    backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--fg-1)' }}>
            Cộng tác viên
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em',
                        textTransform: 'uppercase', color: 'var(--fg-3)' }}>
            MOTOGIATHINH · Đăng nhập
          </div>
        </div>
        <Input label="Email" value={email} onChange={setEmail} placeholder="ten@motogiathinh.centersai"/>
        <Input label="Mật khẩu" value={password} onChange={setPassword} type="password" placeholder="••••••"/>
        {err && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12,
                              color: 'var(--neon-pink)' }}>{err}</div>}
        <Button variant="primary" onClick={submit} disabled={busy || !email || !password}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </div>
    </div>
  );
}

const centered = {
  minHeight: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg-0, var(--ink-1))',
  padding: 20,
};
