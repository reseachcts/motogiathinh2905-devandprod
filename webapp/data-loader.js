// data-loader.js — HTTP-backed loader replacing the original CSV reader.
// Mirrors the frozen `window.MGT_DATA` contract from frontend/CLAUDE.md.
// Derived fields (paid/balance/paymentStatus/class.status) are recomputed
// locally per "derived fields are NEVER read from the wire".

(function () {
  const API = (window.MGT_API_BASE || '') + '/api';

  // Print mode (?print=dashboard) — inject stylesheet that paginates one
  // section per PDF page and kills the breathing-card animations so
  // playwright doesn't capture a mid-frame. Light theme is forced by
  // ThemeProvider; this stylesheet is layout / animation only.
  try {
    if (new URLSearchParams(window.location.search).get('print') === 'dashboard') {
      const css = document.createElement('style');
      css.textContent = `
        /* Exactly one section per page. KPI strip is hidden so the
           first section (Tổng) gets a clean page-1 to itself. */
        .mgt-print-hide { display: none !important; }
        .mgt-print-section + .mgt-print-section { break-before: page; page-break-before: always; }
        /* Live screen uses display:contents on these wrappers so they're
           invisible to layout. In print we override to block so the
           page-break-before rule has a box to break against. zoom + svg
           cap shrink So sánh's stacked charts to fit one A4 landscape. */
        .mgt-print-section { display: block !important; break-inside: avoid-page; zoom: 0.78; }
        .mgt-print-section svg { max-height: 200px !important; }
        /* Kill breathing/glow animations so the render is deterministic. */
        *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; }
        /* Drop the page outer padding so each section fills the A4 page. */
        body, .mgt-canvas { background: #ffffff !important; }
        .mgt-canvas { padding: 12px !important; gap: 0 !important; }
        /* Suppress backdrop blur in print to avoid heavy raster output. */
        * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
        /* @page is owned by playwright's page.pdf() — don't set it here
           or it conflicts with the scale: option. */
      `;
      document.head.appendChild(css);
    }
  } catch {}
  const p2  = (n) => String(n).padStart(2, '0');

  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
      body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
    });
    if (res.status === 401 && path !== '/me') { window.location.reload(); throw new Error('auth_required'); }
    if (!res.ok) {
      let detail = ''; try { detail = JSON.stringify(await res.json()); } catch {}
      throw new Error(`HTTP ${res.status} ${path} ${detail}`);
    }
    return res.json();
  }

  // dd/mm/yyyy [HH:MM:SS] → ms-epoch.
  function parseDT(s) {
    if (!s) return 0;
    const [d, m, y, hh = 0, mm = 0, ss = 0] = s.trim().split(/[\/\s:]/).map(n => parseInt(n, 10));
    return new Date(y, m - 1, d, hh, mm, ss).getTime();
  }

  // Lightweight transient toast — vanilla DOM, no React dep. Used for
  // "Tính năng đang phát triển" placeholders, soft-failure notices,
  // etc. Stacks bottom-right; auto-dismisses after `ms` (default 2.6s).
  window.MGT_TOAST = (msg, opts = {}) => {
    if (!msg) return;
    let host = document.getElementById('mgt-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'mgt-toast-host';
      Object.assign(host.style, {
        position: 'fixed', right: '20px', bottom: '20px', zIndex: 100000,
        display: 'flex', flexDirection: 'column', gap: '8px',
        pointerEvents: 'none',
      });
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.textContent = String(msg);
    Object.assign(el.style, {
      pointerEvents: 'auto',
      fontFamily: 'var(--font-ui, system-ui, sans-serif)', fontSize: '13px', fontWeight: '500',
      color: 'var(--fg-1, #fff)',
      background: 'var(--glass-3, rgba(20,22,28,0.92))',
      border: '1px solid var(--glass-stroke-strong, rgba(255,255,255,0.16))',
      borderRadius: '12px', padding: '10px 14px',
      boxShadow: '0 12px 30px rgba(0,0,0,0.38)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      maxWidth: '320px', opacity: '0', transform: 'translateY(6px)',
      transition: 'opacity 180ms ease-out, transform 180ms ease-out',
    });
    host.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    const ms = opts.ms || 2600;
    setTimeout(() => {
      el.style.opacity = '0'; el.style.transform = 'translateY(6px)';
      setTimeout(() => { el.remove(); if (!host.children.length) host.remove(); }, 220);
    }, ms);
  };

  window.fmtVND = (n) => {
    const abs = Math.abs(Math.round(n));
    return (n < 0 ? '−' : '') + abs.toLocaleString('en-US') + 'đ';
  };
  window.fmtVNDShort = (n) => {
    const abs = Math.abs(n);
    if (abs >= 1e6) return (n / 1e6).toFixed(abs >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'Mđ';
    if (abs >= 1e3) return (n / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.?0+$/, '') + 'Kđ';
    return n + 'đ';
  };
  // Strip non-digits — canonical store form for phone/CCCD/digit-only fields.
  window.digitsOnly = (s) => String(s || '').replace(/\D+/g, '');

  // VN mobile phone — canonical 10 digits, rendered `xxx xxx xxxx`.
  // Partial-build formatting so the mask appears WHILE the user is typing:
  //   "09" → "09" ; "0901" → "090 1" ; "0901234" → "090 123 4" ; etc.
  window.fmtPhone = (s) => {
    const d = window.digitsOnly(s).slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + ' ' + d.slice(3);
    return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
  };

  // VN CCCD — canonical 12 digits, rendered `xxx xxx xxx xxx`. Partial-build
  // formatting like fmtPhone so users see the spaces appear as they type.
  window.fmtCCCD = (s) => {
    const d = window.digitsOnly(s).slice(0, 12);
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + ' ' + d.slice(3);
    if (d.length <= 9) return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
    return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6, 9) + ' ' + d.slice(9);
  };

  // Money — thousands-separator with commas. Used for live-format inside
  // the input box AND for display in lists/details (alongside fmtVND which
  // adds the đ suffix). Stored value is always bare integer digits.
  window.fmtMoneyInput = (s) => {
    const d = window.digitsOnly(s);
    if (!d) return '';
    return d.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Date — build `dd/mm/yyyy` from raw digits as the user types.
  //   "1"        → "1"
  //   "12"       → "12"
  //   "1208"     → "12/08"
  //   "12082002" → "12/08/2002"
  // The stored value IS the formatted string (matches existing dd/mm/yyyy
  // column convention everywhere).
  window.fmtDateInput = (s) => {
    const d = window.digitsOnly(s).slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
    return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
  };

  // Login overlay — vanilla DOM, only shown if /api/me returns 401.
  // Attaches to document.body (NOT #root) so React's reconciler doesn't
  // overwrite it on the loading-state render.
  function showLoginOverlay() {
    return new Promise((resolve) => {
      const root = document.body;
      const css = `.mgt-login{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg-0,#0b0d12);z-index:99999;font-family:var(--font-ui,system-ui,sans-serif)}
.mgt-login-card{padding:32px 28px;min-width:340px;max-width:380px;border-radius:20px;background:var(--glass-2,rgba(255,255,255,.04));border:1px solid var(--glass-stroke,rgba(255,255,255,.08));box-shadow:0 24px 60px rgba(0,0,0,.4),0 0 24px color-mix(in oklab,var(--neon-cyan,#4ad6ff) 18%,transparent)}
.mgt-login h2{margin:0;font-family:var(--font-display,inherit);font-size:22px;font-weight:600;color:var(--fg-1,#fff);letter-spacing:-.015em}
.mgt-login .sub{font-family:var(--font-mono,monospace);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--fg-3,#888);margin:4px 0 18px}
.mgt-login label{display:block;font-size:11px;font-weight:500;color:var(--fg-2,#ccc);margin:12px 0 6px;letter-spacing:.04em}
.mgt-login input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;background:var(--glass-1,rgba(255,255,255,.03));border:1px solid var(--ink-4,rgba(255,255,255,.1));color:var(--fg-1,#fff);font-family:var(--font-ui,inherit);font-size:13px;outline:none}
.mgt-login input:focus{border-color:var(--neon-cyan,#4ad6ff);box-shadow:0 0 14px color-mix(in oklab,var(--neon-cyan,#4ad6ff) 30%,transparent)}
.mgt-login button{width:100%;margin-top:18px;padding:11px 16px;border-radius:12px;border:none;cursor:pointer;background:var(--neon-cyan,#4ad6ff);color:var(--bg-0,#000);font-family:var(--font-ui,inherit);font-size:13px;font-weight:600;letter-spacing:.02em;transition:filter 160ms}
.mgt-login button:hover{filter:brightness(1.08)}
.mgt-login button:disabled{opacity:.55;cursor:progress}
.mgt-login .err{margin-top:12px;padding:8px 10px;border-radius:8px;font-size:12px;background:color-mix(in oklab,var(--neon-pink,#ff5e8a) 14%,transparent);color:var(--neon-pink,#ff5e8a);display:none}`;
      const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
      const overlay = document.createElement('div'); overlay.className = 'mgt-login';
      overlay.innerHTML = `<form class="mgt-login-card" autocomplete="on">
<h2>CENTERSAI.com</h2><div class="sub">đăng nhập hệ thống CRM</div>
<label>Email</label><input name="email" type="email" autocomplete="username" required>
<label>Mật khẩu</label><input name="password" type="password" autocomplete="current-password" required>
<button type="submit">Đăng nhập</button><div class="err"></div></form>`;
      root.appendChild(overlay);
      const form = overlay.querySelector('form'), err = overlay.querySelector('.err'), btn = overlay.querySelector('button');
      form.addEventListener('submit', async (e) => {
        e.preventDefault(); err.style.display = 'none'; btn.disabled = true;
        const fd = new FormData(form);
        try {
          const out = await api('/auth/login', { method: 'POST', body: { email: fd.get('email'), password: fd.get('password') } });
          overlay.remove(); style.remove(); resolve(out.user);
        } catch (e2) {
          err.textContent = /401/.test(String(e2.message)) ? 'Email hoặc mật khẩu không đúng.' : String(e2.message);
          err.style.display = 'block'; btn.disabled = false;
        }
      });
      overlay.querySelector('input[name=email]').focus();
    });
  }

  async function boot() {
    let me = null;
    try { me = (await api('/me')).user; } catch { me = await showLoginOverlay(); }

    const [branches, accounts, feePlans, promotions, teachers, vehicles,
           classesRaw, studentsRaw, paymentsRaw, notifications, activityLog, profileDocs] =
      await Promise.all([
        api('/branches'), api('/accounts'), api('/fee-plans'), api('/promotions'),
        api('/teachers'), api('/vehicles'), api('/classes'), api('/students'),
        api('/payments'), api('/notifications'), api('/activity-log'),
        api('/constants/profile-docs'),
      ]);

    const NOW = new Date(), NOW_MS = NOW.getTime();
    const TODAY_STR = `${p2(NOW.getDate())}/${p2(NOW.getMonth() + 1)}/${NOW.getFullYear()}`;

    promotions.forEach(p => { p.appliesTo = (p.appliesTo_csv || '').split('|').filter(Boolean); });
    // Compat: NotificationRow reads n.detail; spec name is n.message.
    notifications.forEach(n => { if (n.detail == null) n.detail = n.message; });

    const classes = classesRaw.map(c => ({ ...c, _openMs: parseDT(c.openDate), _examMs: parseDT(c.examDate) }));
    const setClassStatus = (c) => {
      if (c.statusOverride) c.status = c.statusOverride;
      else if (c._examMs < NOW_MS) c.status = 'đã kết thúc';
      else if (c._openMs > NOW_MS) c.status = 'đang mở';
      else c.status = 'đang diễn ra';
    };
    classes.forEach(setClassStatus);

    const students = studentsRaw.map(s => ({
      ...s, createdAtMs: parseDT(s.createdAt),
      docs: { cccd: !!s.docs_cccd, gksk: !!s.docs_gksk, donDeNghi: !!s.docs_donDeNghi, the3x4: !!s.docs_the3x4 },
    }));
    // Split the wire payload by kind. Existing rows that pre-date the
    // schema migration come back as kind=undefined → coerce to 'tuition'
    // so legacy behaviour is preserved.
    // `payments` (tuition) is what feeds the Thanh toán list, dashboard
    // revenue, branch performance and the student paid/balance derive.
    // `rentals` is the parallel ledger surfaced on Phương tiện cards and
    // in the formal report's "Cho thuê xe" section. Rentals never count
    // toward revenue or student outstanding balance.
    const allPaymentsRaw = paymentsRaw.map(p => ({ ...p, kind: p.kind || 'tuition', createdAtMs: parseDT(p.createdAt) }));
    const payments = allPaymentsRaw.filter(p => p.kind === 'tuition');
    const rentals  = allPaymentsRaw.filter(p => p.kind === 'rental');

    const branchesById   = new Map(branches.map(b => [b.id, b]));
    const accountsById   = new Map(accounts.map(a => [a.id, a]));
    const classesById    = new Map(classes.map(c => [c.id, c]));
    const studentsById   = new Map(students.map(s => [s.id, s]));
    const feePlansById   = new Map(feePlans.map(f => [f.id, f]));
    const promotionsById = new Map(promotions.map(p => [p.id, p]));
    const vehiclesById   = new Map(vehicles.map(v => [v.id, v]));

    const paymentsByStudentId = new Map(), paymentsByBranchId = new Map();
    const rentalsByStudentId  = new Map(), rentalsByVehicleId  = new Map();
    const pushTo = (map, key, val) => { const l = map.get(key); if (l) l.push(val); else map.set(key, [val]); };
    for (const p of payments) { pushTo(paymentsByStudentId, p.studentId, p); pushTo(paymentsByBranchId, p.branchId, p); }
    for (const r of rentals)  { pushTo(rentalsByStudentId,  r.studentId, r); if (r.vehicleId) pushTo(rentalsByVehicleId, r.vehicleId, r); }
    const studentsByClassId = new Map(), studentsByBranchId = new Map();
    for (const s of students) { pushTo(studentsByClassId, s.classId, s); pushTo(studentsByBranchId, s.branchId, s); }

    function recomputeDerived(s) {
      const sPays = paymentsByStudentId.get(s.id) || [];
      let paid = 0, hasReg = false;
      const cutoff = s.createdAtMs + 6e5;
      for (const p of sPays) {
        paid += p.amount;
        if (!hasReg && p.createdAtMs <= cutoff && p.amount >= s.totalFee) hasReg = true;
      }
      s.paid = paid; s.balance = s.totalFee - paid;
      s.paymentStatus = paid <= 0 ? '0%' : paid >= s.totalFee ? '100%' : '50%';
      s.noPayOnRegistration = !hasReg;
    }
    students.forEach(recomputeDerived);

    function bucketLabel(d, g) {
      const dd = p2(d.getDate()), mm = p2(d.getMonth() + 1), yy = String(d.getFullYear()).slice(2), hh = p2(d.getHours());
      return g === 'hour' ? `${hh}h ${dd}/${mm}` : g === 'day' ? `${dd}/${mm}` : `${mm}/${yy}`;
    }
    const Y = NOW.getFullYear(), M = NOW.getMonth(), D = NOW.getDate(), H = NOW.getHours();
    const mkBucket = (start, end, grain) => ({ start, end, label: bucketLabel(start, grain) });
    function bucketRanges(grain, count) {
      const out = [];
      for (let i = count - 1; i >= 0; i--) {
        if (grain === 'hour') {
          const end = new Date(NOW); end.setHours(H - i, 59, 59);
          const start = new Date(end); start.setMinutes(0, 0, 0);
          out.push(mkBucket(start, end, grain));
        } else if (grain === 'day') {
          out.push(mkBucket(new Date(Y, M, D - i, 0, 0, 0), new Date(Y, M, D - i, 23, 59, 59), grain));
        } else {
          out.push(mkBucket(new Date(Y, M - i, 1, 0, 0, 0), new Date(Y, M - i + 1, 0, 23, 59, 59), grain));
        }
      }
      return out;
    }
    function periodToDateRanges(grain) {
      const out = [];
      if (grain === 'hour') {
        for (let h = 0; h <= H; h++) out.push(mkBucket(new Date(Y, M, D, h, 0, 0), new Date(Y, M, D, h, 59, 59), 'hour'));
      } else if (grain === 'day') {
        const dow = NOW.getDay() === 0 ? 6 : NOW.getDay() - 1;
        const days = Math.floor((NOW - new Date(Y, M, D - dow)) / 86400000);
        for (let i = 0; i <= days; i++)
          out.push(mkBucket(new Date(Y, M, D - dow + i, 0, 0, 0), new Date(Y, M, D - dow + i, 23, 59, 59), 'day'));
      } else {
        for (let m = 0; m <= M; m++) out.push(mkBucket(new Date(Y, m, 1, 0, 0, 0), new Date(Y, m + 1, 0, 23, 59, 59), 'month'));
      }
      return out;
    }

    function patchStudentIn(raw) {
      const s = { ...raw, createdAtMs: parseDT(raw.createdAt),
        docs: { cccd: !!raw.docs_cccd, gksk: !!raw.docs_gksk, donDeNghi: !!raw.docs_donDeNghi, the3x4: !!raw.docs_the3x4 } };
      students.push(s); studentsById.set(s.id, s);
      pushTo(studentsByClassId, s.classId, s); pushTo(studentsByBranchId, s.branchId, s);
      recomputeDerived(s);
      return s;
    }
    function patchPaymentIn(raw) {
      const p = { ...raw, kind: raw.kind || 'tuition', createdAtMs: parseDT(raw.createdAt) };
      if (p.kind === 'rental') {
        rentals.push(p);
        pushTo(rentalsByStudentId, p.studentId, p);
        if (p.vehicleId) pushTo(rentalsByVehicleId, p.vehicleId, p);
      } else {
        payments.push(p);
        pushTo(paymentsByStudentId, p.studentId, p);
        pushTo(paymentsByBranchId,  p.branchId,  p);
        const s = studentsById.get(p.studentId); if (s) recomputeDerived(s);
      }
      return p;
    }
    function patchClassIn(raw) {
      const c = { ...raw, _openMs: parseDT(raw.openDate), _examMs: parseDT(raw.examDate) };
      setClassStatus(c);
      classes.push(c); classesById.set(c.id, c);
      return c;
    }

    const _normPromo = (raw) => { raw.appliesTo = (raw.appliesTo_csv || '').split('|').filter(Boolean); };

    const MGT_DATA = {
      branches, accounts, feePlans, promotions, teachers, vehicles,
      classes, students, payments, rentals, notifications, activityLog,
      _byId: { branchesById, accountsById, classesById, studentsById, feePlansById, promotionsById, vehiclesById },
      _indexes: { paymentsByStudentId, studentsByClassId, studentsByBranchId, paymentsByBranchId,
                  rentalsByStudentId, rentalsByVehicleId },

      currentUserId: me.id,
      get currentUser() { return accountsById.get(this.currentUserId) || me; },

      getStaff:     (id) => accountsById.get(id),
      getBranch:    (id) => branchesById.get(id),
      getClass:     (id) => classesById.get(id),
      getStudent:   (id) => studentsById.get(id),
      getFeePlan:   (id) => feePlansById.get(id),
      getPromotion: (id) => promotionsById.get(id),
      getVehicle:   (id) => vehiclesById.get(id),
      paymentsForStudent: (id) => paymentsByStudentId.get(id) || [],
      rentalsForStudent:  (id) => rentalsByStudentId.get(id)  || [],
      rentalsForVehicle:  (id) => rentalsByVehicleId.get(id)  || [],
      studentsInClass:    (id) => studentsByClassId.get(id) || [],

      TODAY: TODAY_STR, NOW, _NOW: NOW,
      paymentsToday()        { return payments.filter(p => p.createdAt.startsWith(TODAY_STR)); },
      studentsCreatedToday() { return students.filter(s => s.createdAt.startsWith(TODAY_STR)); },
      firstRecordMs() {
        let e = Infinity;
        for (const p of payments) if (p.createdAtMs < e) e = p.createdAtMs;
        for (const s of students) if (s.createdAtMs < e) e = s.createdAtMs;
        return e === Infinity ? NOW_MS : e;
      },
      _ranges(mode, grain, count) { return mode === 'ptd' ? periodToDateRanges(grain) : bucketRanges(grain, count); },

      revenueBuckets(grain, count, branchId = null, mode = 'rolling') {
        const ranges = this._ranges(mode, grain, count);
        const ps = branchId ? (paymentsByBranchId.get(branchId) || []) : payments;
        const ss = branchId ? (studentsByBranchId.get(branchId) || []) : students;
        return ranges.map(b => {
          const sMs = b.start.getTime(), eMs = b.end.getTime();
          let daNhan = 0, tong = 0;
          for (const p of ps) if (p.createdAtMs >= sMs && p.createdAtMs <= eMs) daNhan += p.amount;
          for (const s of ss) if (s.createdAtMs >= sMs && s.createdAtMs <= eMs) tong += s.totalFee;
          return { label: b.label, tong, daNhan, conNo: Math.max(0, tong - daNhan) };
        });
      },
      studentBuckets(grain, count, branchId = null, mode = 'rolling') {
        const ranges = this._ranges(mode, grain, count);
        const ss = branchId ? (studentsByBranchId.get(branchId) || []) : students;
        return ranges.map(b => {
          const sMs = b.start.getTime(), eMs = b.end.getTime();
          let tong = 0, A = 0, A1 = 0;
          for (const s of ss) if (s.createdAtMs >= sMs && s.createdAtMs <= eMs) {
            tong++; if (s.licence === 'A') A++; else A1++;
          }
          return { label: b.label, tong, A, A1 };
        });
      },
      revenueCumulative(grain, count, mode = 'rolling') {
        let t = 0, d = 0, c = 0;
        return this.revenueBuckets(grain, count, null, mode).map(b => {
          t += b.tong; d += b.daNhan; c += b.conNo;
          return { label: b.label, tong: t, daNhan: d, conNo: c };
        });
      },
      studentCumulative(grain, count, mode = 'rolling') {
        let t = 0, a = 0, a1 = 0;
        return this.studentBuckets(grain, count, null, mode).map(b => {
          t += b.tong; a += b.A; a1 += b.A1;
          return { label: b.label, tong: t, A: a, A1: a1 };
        });
      },
      branchPerformance() {
        return branches.map(b => {
          const sList = studentsByBranchId.get(b.id) || [];
          const pList = paymentsByBranchId.get(b.id) || [];
          let tong = 0, daNhan = 0, conNo = 0, paidFull = 0, partial = 0, unpaid = 0, noPayOnReg = 0, paidImmediately = 0;
          for (const s of sList) {
            tong += s.totalFee; conNo += s.balance;
            if (s.paymentStatus === '100%') paidFull++;
            else if (s.paymentStatus === '50%') partial++;
            else unpaid++;
            if (s.noPayOnRegistration) noPayOnReg++;
            if (s.paymentStatus === '100%' && !s.noPayOnRegistration) {
              const cutoff = s.createdAtMs + 6e5;
              for (const p of paymentsByStudentId.get(s.id) || []) {
                if (p.createdAtMs <= cutoff && p.amount >= s.totalFee) { paidImmediately++; break; }
              }
            }
          }
          for (const p of pList) daNhan += p.amount;
          return { branchId: b.id, name: b.name, students: sList.length, revenue: daNhan,
            committed: tong, outstanding: conNo, paidFull, partial, unpaid, noPayOnReg, paidImmediately };
        });
      },

      PROFILE_DOCS: profileDocs,

      api: {
        // AppRoot listens for 'mgt:datachanged' and re-renders after writes.
        _bump() { try { window.dispatchEvent(new Event('mgt:datachanged')); } catch {} },
        // Generic CRUD helper for admin support tables; POST/PATCH/DELETEs
        // backend then patches the local array + byId map and _bumps.
        async _crud(op, path, arr, byId, opts = {}) {
          const { id, body, sub, normalize } = opts;
          const method = { create: 'POST', update: 'PATCH', delete: 'DELETE', post: 'POST' }[op];
          const raw = await api(path + (id ? '/' + encodeURIComponent(id) : '') + (sub || ''), { method, body });
          if (op === 'create')      { normalize?.(raw); arr.push(raw); byId?.set(raw.id, raw); }
          else if (op === 'update') { normalize?.(raw); const i = arr.findIndex(r => r.id === id);
            if (i >= 0) { Object.assign(arr[i], raw); byId?.set(id, arr[i]); } }
          else if (op === 'delete') { const i = arr.findIndex(r => r.id === id);
            if (i >= 0) arr.splice(i, 1); byId?.delete(id); }
          this._bump(); return raw;
        },
        async createStudent(payload) { const r = patchStudentIn(await api('/students', { method: 'POST', body: payload })); this._bump(); return r; },
        async createPayment(payload) { const r = patchPaymentIn(await api('/payments', { method: 'POST', body: payload })); this._bump(); return r; },
        async createRental(payload) {
          // Convenience wrapper. Server computes amount = vehicle.price ×
          // rentalRounds; we just pass kind=rental + the ids.
          const body = { kind: 'rental', studentId: payload.studentId, vehicleId: payload.vehicleId,
                         rentalRounds: parseInt(payload.rounds || payload.rentalRounds, 10) || 0,
                         method: payload.method || 'Tiền mặt' };
          const r = patchPaymentIn(await api('/payments', { method: 'POST', body }));
          this._bump(); return r;
        },
        async createClass(payload)   { const r = patchClassIn(  await api('/classes',  { method: 'POST', body: payload })); this._bump(); return r; },
        createAccount(p)     { return this._crud('create', '/accounts',  accounts,   accountsById,   { body: p }); },
        updateAccount(id, p) { return this._crud('update', '/accounts',  accounts,   accountsById,   { id, body: p }); },
        resetPassword(id, newPassword) { return this._crud('post', '/accounts', accounts, null, { id, sub: '/reset-password', body: { newPassword } }); },
        createFeePlan(p)     { return this._crud('create', '/fee-plans', feePlans,   feePlansById,   { body: { ...p, amount: parseInt(p.amount, 10) || 0 } }); },
        updateFeePlan(id, p) { return this._crud('update', '/fee-plans', feePlans,   feePlansById,   { id, body: 'amount' in p ? { ...p, amount: parseInt(p.amount, 10) || 0 } : p }); },
        createPromotion(p)     { return this._crud('create', '/promotions', promotions, promotionsById, { body: { ...p, discount: parseInt(p.discount, 10) || 0 }, normalize: _normPromo }); },
        updatePromotion(id, p) { return this._crud('update', '/promotions', promotions, promotionsById, { id, body: 'discount' in p ? { ...p, discount: parseInt(p.discount, 10) || 0 } : p, normalize: _normPromo }); },
        createTeacher(p)     { return this._crud('create', '/teachers',  teachers,   null,           { body: { ...p, yearsExp: parseInt(p.yearsExp, 10) || 0 } }); },
        updateTeacher(id, p) { return this._crud('update', '/teachers',  teachers,   null,           { id, body: p }); },
        createVehicle(p)     { return this._crud('create', '/vehicles',  vehicles,   vehiclesById,   { body: { ...p, year: parseInt(p.year, 10) || null, price: parseInt(p.price, 10) || 0 } }); },
        updateVehicle(id, p) { return this._crud('update', '/vehicles',  vehicles,   vehiclesById,   { id, body: 'price' in p ? { ...p, price: parseInt(p.price, 10) || 0 } : p }); },
        createBranch(p)      { return this._crud('create', '/branches',  branches,   branchesById,   { body: p }); },
        updateBranch(id, p)  { return this._crud('update', '/branches',  branches,   branchesById,   { id, body: p }); },
        deleteBranch(id)     { return this._crud('delete', '/branches',  branches,   branchesById,   { id }); },
        async deleteNotification(id) {
          await api('/notifications/' + encodeURIComponent(id), { method: 'DELETE' });
          const i = notifications.findIndex(n => n.id === id);
          if (i >= 0) notifications.splice(i, 1);
          this._bump();
          return { id };
        },
        async _upload(path, file) {
          const fd = new FormData(); fd.append('file', file);
          const res = await fetch(API + path, { method: 'POST', credentials: 'include', body: fd });
          if (!res.ok) throw new Error('upload_failed: ' + res.status);
          return res.json();
        },
        async uploadStudentDoc(studentId, key, file) {
          const out = await this._upload('/students/' + encodeURIComponent(studentId) + '/docs/' + encodeURIComponent(key), file);
          const s = studentsById.get(studentId);
          if (s) { s.docs[key] = true; s['docs_' + key] = true; s['docs_' + key + '_url'] = out.url; }
          this._bump(); return out;
        },
        async deleteStudentDoc(studentId, key) {
          await api('/students/' + encodeURIComponent(studentId) + '/docs/' + encodeURIComponent(key), { method: 'DELETE' });
          const s = studentsById.get(studentId);
          if (s) {
            s.docs[key] = false;
            s['docs_' + key] = false;
            s['docs_' + key + '_url'] = null;
          }
          this._bump();
          return { studentId, key };
        },
        async uploadBienLai(paymentId, file) {
          const out = await this._upload('/payments/' + encodeURIComponent(paymentId) + '/bien-lai', file);
          const p = payments.find(p => p.id === paymentId);
          if (p) { p.bienLaiPhoto = true; p.bienLaiPhoto_url = out.url; }
          this._bump(); return out;
        },
        // GET /api/reports/dashboard.pdf — backend renders the Tổng quan
        // page via headless chromium + returns a PDF blob. Triggers a
        // browser download.
        async downloadDashboardPdf() { return this._downloadReport('/reports/dashboard.pdf', 'tongquan', 'pdf', 'báo cáo trực quan'); },
        async downloadFormalReportPdf()  { return this._downloadReport('/reports/data.pdf',  'baocao',   'pdf',  'báo cáo số liệu PDF'); },
        async downloadFormalReportXlsx() { return this._downloadReport('/reports/data.xlsx', 'baocao',   'xlsx', 'báo cáo Excel'); },
        async _downloadReport(path, prefix, ext, humanLabel) {
          try {
            window.MGT_TOAST && window.MGT_TOAST(`Đang tạo ${humanLabel}…`, { ms: 6000 });
            const res = await fetch(API + path, { credentials: 'include' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${prefix}-${new Date().toISOString().slice(0,10)}.${ext}`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            window.MGT_TOAST && window.MGT_TOAST(`Đã tạo ${humanLabel}.`);
          } catch (e) {
            window.MGT_TOAST && window.MGT_TOAST(`Lỗi tạo ${humanLabel}: ` + (e.message || e));
          }
        },

        // POST a CCCD image to /api/ocr/cccd and return { fields, raw, ms,
        // confidence }. fields = { idNumber, name, dob, gender, queQuan,
        // address, ngayCapCCCD } (any subset may be null). Caller decides
        // which to apply. Does NOT persist the image — caller still needs
        // to POST /api/students/:id/docs/cccd after the student exists.
        async ocrCccd(file) {
          const fd = new FormData(); fd.append('file', file);
          const res = await fetch(API + '/ocr/cccd', { method: 'POST', credentials: 'include', body: fd });
          if (!res.ok) throw new Error('ocr_failed: ' + res.status);
          return res.json();
        },
        async updateStudent(id, patch) {
          const raw = await api('/students/' + encodeURIComponent(id), { method: 'PATCH', body: patch });
          const ex = studentsById.get(id);
          if (ex) {
            Object.assign(ex, raw, {
              createdAtMs: parseDT(raw.createdAt),
              docs: { cccd: !!raw.docs_cccd, gksk: !!raw.docs_gksk, donDeNghi: !!raw.docs_donDeNghi, the3x4: !!raw.docs_the3x4 },
            });
            recomputeDerived(ex);
          }
          this._bump();
          return ex || raw;
        },
        async updateClass(id, patch) {
          const raw = await api('/classes/' + encodeURIComponent(id), { method: 'PATCH', body: patch });
          const ex = classesById.get(id);
          if (ex) {
            Object.assign(ex, raw, { _openMs: parseDT(raw.openDate), _examMs: parseDT(raw.examDate) });
            setClassStatus(ex);
          }
          this._bump();
          return ex || raw;
        },
        async markNotificationRead(id, read = true) {
          const raw = await api('/notifications/' + encodeURIComponent(id), { method: 'PATCH', body: { read } });
          const ex = notifications.find(n => n.id === id);
          if (ex) Object.assign(ex, raw, { detail: raw.message ?? ex.detail });
          this._bump();
          return raw;
        },
        async logout() {
          try { await api('/auth/logout', { method: 'POST' }); } catch {}
          window.location.reload();
        },
      },
    };

    window.MGT_DATA = MGT_DATA;
    return MGT_DATA;
  }

  window.MGT_DATA_READY = boot().catch(err => { console.error('[data-loader] boot failed:', err); throw err; });
})();
