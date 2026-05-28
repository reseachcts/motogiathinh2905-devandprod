// data-loader.js — HTTP-backed loader replacing the original CSV reader.
// Mirrors the frozen `window.MGT_DATA` contract from frontend/CLAUDE.md.
// Derived fields (paid/balance/paymentStatus/class.status) are recomputed
// locally per "derived fields are NEVER read from the wire".

(function () {
  const API = (window.MGT_API_BASE || '') + '/api';
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
    const payments = paymentsRaw.map(p => ({ ...p, createdAtMs: parseDT(p.createdAt) }));

    const branchesById   = new Map(branches.map(b => [b.id, b]));
    const accountsById   = new Map(accounts.map(a => [a.id, a]));
    const classesById    = new Map(classes.map(c => [c.id, c]));
    const studentsById   = new Map(students.map(s => [s.id, s]));
    const feePlansById   = new Map(feePlans.map(f => [f.id, f]));
    const promotionsById = new Map(promotions.map(p => [p.id, p]));

    const paymentsByStudentId = new Map(), paymentsByBranchId = new Map();
    const pushTo = (map, key, val) => { const l = map.get(key); if (l) l.push(val); else map.set(key, [val]); };
    for (const p of payments) { pushTo(paymentsByStudentId, p.studentId, p); pushTo(paymentsByBranchId, p.branchId, p); }
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
      const p = { ...raw, createdAtMs: parseDT(raw.createdAt) };
      payments.push(p);
      pushTo(paymentsByStudentId, p.studentId, p); pushTo(paymentsByBranchId, p.branchId, p);
      const s = studentsById.get(p.studentId); if (s) recomputeDerived(s);
      return p;
    }
    function patchClassIn(raw) {
      const c = { ...raw, _openMs: parseDT(raw.openDate), _examMs: parseDT(raw.examDate) };
      setClassStatus(c);
      classes.push(c); classesById.set(c.id, c);
      return c;
    }

    const MGT_DATA = {
      branches, accounts, feePlans, promotions, teachers, vehicles,
      classes, students, payments, notifications, activityLog,
      _byId: { branchesById, accountsById, classesById, studentsById, feePlansById, promotionsById },
      _indexes: { paymentsByStudentId, studentsByClassId, studentsByBranchId, paymentsByBranchId },

      currentUserId: me.id,
      get currentUser() { return accountsById.get(this.currentUserId) || me; },

      getStaff:     (id) => accountsById.get(id),
      getBranch:    (id) => branchesById.get(id),
      getClass:     (id) => classesById.get(id),
      getStudent:   (id) => studentsById.get(id),
      getFeePlan:   (id) => feePlansById.get(id),
      getPromotion: (id) => promotionsById.get(id),
      paymentsForStudent: (id) => paymentsByStudentId.get(id) || [],
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
        // Fired after every successful write; AppRoot listens and re-renders
        // so the new/updated row becomes visible without a tab-bounce.
        _bump() { try { window.dispatchEvent(new Event('mgt:datachanged')); } catch {} },
        async createStudent(payload) { const r = patchStudentIn(await api('/students', { method: 'POST', body: payload })); this._bump(); return r; },
        async createPayment(payload) { const r = patchPaymentIn(await api('/payments', { method: 'POST', body: payload })); this._bump(); return r; },
        async createClass(payload)   { const r = patchClassIn(  await api('/classes',  { method: 'POST', body: payload })); this._bump(); return r; },
        async createAccount(payload) {
          const raw = await api('/accounts', { method: 'POST', body: payload });
          accounts.push(raw); accountsById.set(raw.id, raw); this._bump(); return raw;
        },
        async createFeePlan(payload) {
          const body = { ...payload, amount: parseInt(payload.amount, 10) || 0 };
          const raw = await api('/fee-plans', { method: 'POST', body });
          feePlans.push(raw); feePlansById.set(raw.id, raw); this._bump(); return raw;
        },
        async createPromotion(payload) {
          const body = { ...payload, discount: parseInt(payload.discount, 10) || 0 };
          const raw = await api('/promotions', { method: 'POST', body });
          raw.appliesTo = (raw.appliesTo_csv || '').split('|').filter(Boolean);
          promotions.push(raw); promotionsById.set(raw.id, raw); this._bump(); return raw;
        },
        async createTeacher(payload) {
          const body = { ...payload, yearsExp: parseInt(payload.yearsExp, 10) || 0 };
          const raw = await api('/teachers', { method: 'POST', body });
          teachers.push(raw); this._bump(); return raw;
        },
        async createVehicle(payload) {
          const body = { ...payload, year: parseInt(payload.year, 10) || null };
          const raw = await api('/vehicles', { method: 'POST', body });
          vehicles.push(raw); this._bump(); return raw;
        },
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
        async uploadBienLai(paymentId, file) {
          const out = await this._upload('/payments/' + encodeURIComponent(paymentId) + '/bien-lai', file);
          const p = payments.find(p => p.id === paymentId);
          if (p) { p.bienLaiPhoto = true; p.bienLaiPhoto_url = out.url; }
          this._bump(); return out;
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

  window.MGT_DATA_READY = boot().catch(err => {
    console.error('[data-loader] boot failed:', err);
    throw err;
  });
})();
