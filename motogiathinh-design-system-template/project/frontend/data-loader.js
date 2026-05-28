// =====================================================================
// data-loader.js — async loader for the CSV "database" under /data
//
// Replaces the old `data.js` procedural generator. Exposes the SAME
// `window.MGT_DATA` shape so the rest of the app keeps working
// unchanged. Backend integration: replace the fetch() calls with HTTP
// requests against your real API. See BACKEND.md for the contract.
//
// USAGE in index.html — load this BEFORE atoms.jsx:
//   <script src="data-loader.js"></script>
// Then in app.jsx, render only after window.MGT_DATA_READY resolves.
// =====================================================================

(function () {
  // -------------------------------------------------------------------
  // EDIT-ME ⇩  Mock clock — change ONE block when shipping to real backend.
  // See frontend/CLAUDE.md "Mock clock" for the production replacement.
  // -------------------------------------------------------------------
  const TODAY_STR = "30/05/2026";
  const NOW       = new Date(2026, 4, 30, 15, 0, 0);
  const NOW_MS    = NOW.getTime();
  // ⇧ EDIT-ME

  // -------------------------------------------------------------------
  // CSV parser — tolerant of quoted fields, escaped quotes, BOM, CRLF.
  // -------------------------------------------------------------------
  function parseCsv(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let row = [], cell = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else inQ = false;
        } else cell += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ",")  { row.push(cell); cell = ""; }
        else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
        else if (ch === "\r") { /* skip */ }
        else cell += ch;
      }
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") rows.pop();
    if (!rows.length) return [];
    const header = rows[0];
    return rows.slice(1).map(r => {
      const o = {};
      for (let j = 0; j < header.length; j++) o[header[j]] = r[j] ?? "";
      return o;
    });
  }

  // Type-coerce a parsed CSV row using a schema map { col: "string" | "int" | "bool" }.
  function coerceRow(row, schema) {
    for (const k of Object.keys(schema)) {
      const v = row[k];
      if (schema[k] === "int")  row[k] = v === "" ? 0    : parseInt(v, 10);
      if (schema[k] === "bool") row[k] = v === "true";
    }
    return row;
  }

  // -------------------------------------------------------------------
  // EDIT-ME ⇩  Data source. For dev, fetch CSVs from frontend/data/.
  // For production, replace with HTTP calls to your backend API —
  // see frontend/CLAUDE.md "Step 2 — replace the data source".
  // -------------------------------------------------------------------
  async function loadCsv(name, schema) {
    const res = await fetch("data/" + name + ".csv");
    if (!res.ok) throw new Error(`Failed to load data/${name}.csv (${res.status})`);
    const rows = parseCsv(await res.text());
    return rows.map(r => coerceRow(r, schema || {}));
  }
  // ⇧ EDIT-ME

  // -------------------------------------------------------------------
  // Date helpers (same format as before).
  // -------------------------------------------------------------------
  // Parse "dd/mm/yyyy HH:MM:SS" or "dd/mm/yyyy" → ms-epoch
  function parseDT(s) {
    if (!s) return 0;
    const parts = s.trim().split(/[\/\s:]/).map(n => parseInt(n, 10));
    const [d, m, y, hh = 0, mm = 0, ss = 0] = parts;
    return new Date(y, m - 1, d, hh, mm, ss).getTime();
  }

  // -------------------------------------------------------------------
  // Money + label formatters (used by the dashboard).
  // -------------------------------------------------------------------
  window.fmtVND = (n) => {
    const abs = Math.abs(Math.round(n));
    const s = abs.toLocaleString("en-US");
    return (n < 0 ? "−" : "") + s + "đ";
  };
  window.fmtVNDShort = (n) => {
    const abs = Math.abs(n);
    if (abs >= 1000000) return (n / 1000000).toFixed(abs >= 10000000 ? 1 : 2).replace(/\.?0+$/, "") + "Mđ";
    if (abs >= 1000)    return (n / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.?0+$/, "") + "Kđ";
    return n + "đ";
  };

  // -------------------------------------------------------------------
  // Boot — fetch all CSVs in parallel, then build MGT_DATA.
  // -------------------------------------------------------------------
  async function boot() {
    const [
      branches, accounts, feePlans, promotions, teachers, vehicles,
      classesRaw, studentsRaw, paymentsRaw, notifications, activityLog
    ] = await Promise.all([
      loadCsv("branches",   { id: "string", name: "string", address: "string", manager_id: "string" }),
      loadCsv("accounts",   { active: "bool" }),
      loadCsv("fee_plans",  { amount: "int" }),
      loadCsv("promotions", { discount: "int" }),
      loadCsv("teachers",   { yearsExp: "int", active: "bool" }),
      loadCsv("vehicles",   { year: "int" }),
      loadCsv("classes",    {}),
      loadCsv("students",   {
        totalFee: "int", profileComplete: "bool",
        docs_cccd: "bool", docs_gksk: "bool", docs_donDeNghi: "bool", docs_the3x4: "bool",
      }),
      loadCsv("payments",   { amount: "int", bienLaiPhoto: "bool" }),
      loadCsv("notifications", { read: "bool" }),
      loadCsv("activity_log",  {}),
    ]);

    // ---- Promotion appliesTo → array (was pipe-joined string in CSV)
    promotions.forEach(p => { p.appliesTo = (p.appliesTo_csv || "").split("|").filter(Boolean); });

    // ---- Classes: derive status from openDate / examDate vs NOW
    const classes = classesRaw.map(c => ({
      ...c,
      _openMs: parseDT(c.openDate),
      _examMs: parseDT(c.examDate),
    }));
    classes.forEach(c => {
      if (c._examMs < NOW_MS)        c.status = "đã kết thúc";
      else if (c._openMs > NOW_MS)   c.status = "đang mở";
      else                           c.status = "đang diễn ra";
    });

    // ---- Students: parse createdAt, attach _createdMs, normalise docs object
    const students = studentsRaw.map(s => ({
      ...s,
      createdAtMs: parseDT(s.createdAt),
      docs: { cccd: s.docs_cccd, gksk: s.docs_gksk, donDeNghi: s.docs_donDeNghi, the3x4: s.docs_the3x4 },
    }));

    // ---- Payments: parse createdAt
    const payments = paymentsRaw.map(p => ({ ...p, createdAtMs: parseDT(p.createdAt) }));

    // =================================================================
    // INDEX MAPS — built once at boot for O(1) lookups everywhere.
    //
    // Backend equivalent: add B-tree indexes on the same columns in
    // Postgres (id PKs are already there; add (studentId), (classId),
    // (branchId), (createdAt) where called out).
    // =================================================================
    const branchesById  = new Map(branches.map(b => [b.id, b]));
    const accountsById  = new Map(accounts.map(a => [a.id, a]));
    const classesById   = new Map(classes.map(c => [c.id, c]));
    const studentsById  = new Map(students.map(s => [s.id, s]));
    const feePlansById  = new Map(feePlans.map(f => [f.id, f]));
    const promotionsById= new Map(promotions.map(p => [p.id, p]));

    // Reverse indexes — keyed by FK, values are pre-grouped arrays.
    // Replaces .filter(...) in tight loops.
    const paymentsByStudentId = new Map();
    for (const p of payments) {
      const list = paymentsByStudentId.get(p.studentId);
      if (list) list.push(p); else paymentsByStudentId.set(p.studentId, [p]);
    }
    const studentsByClassId = new Map();
    const studentsByBranchId = new Map();
    for (const s of students) {
      let l = studentsByClassId.get(s.classId);
      if (l) l.push(s); else studentsByClassId.set(s.classId, [s]);
      l = studentsByBranchId.get(s.branchId);
      if (l) l.push(s); else studentsByBranchId.set(s.branchId, [s]);
    }
    const paymentsByBranchId = new Map();
    for (const p of payments) {
      const l = paymentsByBranchId.get(p.branchId);
      if (l) l.push(p); else paymentsByBranchId.set(p.branchId, [p]);
    }

    // ---- DERIVED student fields (paid, balance, paymentStatus, noPayOnRegistration)
    //      Always recomputed from the payment ledger — never read from CSV.
    //      Uses paymentsByStudentId so each student is O(payments-for-this-student)
    //      not O(all-payments) — dropped boot cost from O(N²) to O(N).
    students.forEach(s => {
      const sPays = paymentsByStudentId.get(s.id) || [];
      let paid = 0;
      let hasRegPayment = false;
      const cutoff = s.createdAtMs + 10 * 60 * 1000;
      for (const p of sPays) {
        paid += p.amount;
        if (!hasRegPayment && p.createdAtMs <= cutoff && p.amount >= s.totalFee) {
          hasRegPayment = true;
        }
      }
      s.paid = paid;
      s.balance = s.totalFee - paid;
      if (paid <= 0)                  s.paymentStatus = "0%";
      else if (paid >= s.totalFee)    s.paymentStatus = "100%";
      else                            s.paymentStatus = "50%";
      // noPayOnRegistration = no full payment covering totalFee within
      // 10 minutes of createdAt. (Earlier definition mixed concerns;
      // this is the canonical one used by branchPerformance.)
      s.noPayOnRegistration = !hasRegPayment;
    });

    // -----------------------------------------------------------------
    // Bucket helpers — same shape + math as the old data.js methods.
    // -----------------------------------------------------------------
    const _NOW = NOW;
    function bucketLabel(d, grain) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = String(d.getFullYear()).slice(2);
      const hh = String(d.getHours()).padStart(2, "0");
      if (grain === "hour")  return `${hh}h ${dd}/${mm}`;
      if (grain === "day")   return `${dd}/${mm}`;
      return `${mm}/${yy}`;
    }
    function bucketRanges(grain, count) {
      const out = []; const now = _NOW;
      for (let i = count - 1; i >= 0; i--) {
        let start, end;
        if (grain === "hour") {
          end   = new Date(now); end.setHours(now.getHours() - i, 59, 59);
          start = new Date(end); start.setMinutes(0, 0, 0);
        } else if (grain === "day") {
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0);
          end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59);
        } else {
          const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
          start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0);
          end   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59);
        }
        out.push({ start, end, label: bucketLabel(start, grain) });
      }
      return out;
    }
    function periodToDateRanges(grain) {
      const now = _NOW; const out = [];
      if (grain === "hour") {
        for (let h = 0; h <= now.getHours(); h++) {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0);
          const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 59, 59);
          out.push({ start, end, label: bucketLabel(start, "hour") });
        }
      } else if (grain === "day") {
        const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
        const days = Math.floor((now - monday) / 86400000);
        for (let i = 0; i <= days; i++) {
          const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 0, 0, 0);
          const end   = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 23, 59, 59);
          out.push({ start, end, label: bucketLabel(start, "day") });
        }
      } else {
        for (let m = 0; m <= now.getMonth(); m++) {
          const start = new Date(now.getFullYear(), m, 1, 0, 0, 0);
          const end   = new Date(now.getFullYear(), m + 1, 0, 23, 59, 59);
          out.push({ start, end, label: bucketLabel(start, "month") });
        }
      }
      return out;
    }

    const MGT_DATA = {
      branches, accounts, feePlans, promotions, teachers, vehicles,
      classes, students, payments, notifications, activityLog,

      // Index maps — exposed so screen code can use them directly when
      // needed (e.g. in tight render loops). Treat as read-only.
      _byId: { branchesById, accountsById, classesById, studentsById, feePlansById, promotionsById },
      _indexes: {
        paymentsByStudentId,   // Map<studentId, Payment[]>
        studentsByClassId,     // Map<classId,   Student[]>
        studentsByBranchId,    // Map<branchId,  Student[]>
        paymentsByBranchId,    // Map<branchId,  Payment[]>
      },

      currentUserId: "u-admin",
      get currentUser() { return accountsById.get(this.currentUserId); },

      // O(1) FK lookups — were .find() linear scans before.
      getStaff:     (id) => accountsById.get(id),
      getBranch:    (id) => branchesById.get(id),
      getClass:     (id) => classesById.get(id),
      getStudent:   (id) => studentsById.get(id),
      getFeePlan:   (id) => feePlansById.get(id),
      getPromotion: (id) => promotionsById.get(id),

      // O(1) reverse lookups — pre-grouped at boot.
      paymentsForStudent: (id) => paymentsByStudentId.get(id) || [],
      studentsInClass:    (id) => studentsByClassId.get(id) || [],

      TODAY: TODAY_STR,
      NOW,
      _NOW: NOW,
      paymentsToday()       { return payments.filter(p => p.createdAt.startsWith(TODAY_STR)); },
      studentsCreatedToday(){ return students.filter(s => s.createdAt.startsWith(TODAY_STR)); },

      firstRecordMs() {
        let earliest = Infinity;
        for (const p of payments) if (p.createdAtMs < earliest) earliest = p.createdAtMs;
        for (const s of students) if (s.createdAtMs < earliest) earliest = s.createdAtMs;
        return earliest === Infinity ? NOW_MS : earliest;
      },

      _ranges(mode, grain, count) {
        return mode === "ptd" ? periodToDateRanges(grain) : bucketRanges(grain, count);
      },

      revenueBuckets(grain, count, branchId = null, mode = "rolling") {
        const ranges = this._ranges(mode, grain, count);
        // Pre-filter by branch via index map — O(1) instead of O(N).
        const ps = branchId ? (paymentsByBranchId.get(branchId) || []) : payments;
        const ss = branchId ? (studentsByBranchId.get(branchId) || []) : students;
        return ranges.map(b => {
          const sMs = b.start.getTime(), eMs = b.end.getTime();
          let daNhan = 0;
          for (const p of ps) { if (p.createdAtMs >= sMs && p.createdAtMs <= eMs) daNhan += p.amount; }
          let tong = 0;
          for (const s of ss) { if (s.createdAtMs >= sMs && s.createdAtMs <= eMs) tong += s.totalFee; }
          return { label: b.label, tong, daNhan, conNo: Math.max(0, tong - daNhan) };
        });
      },

      studentBuckets(grain, count, branchId = null, mode = "rolling") {
        const ranges = this._ranges(mode, grain, count);
        const ss = branchId ? (studentsByBranchId.get(branchId) || []) : students;
        return ranges.map(b => {
          const sMs = b.start.getTime(), eMs = b.end.getTime();
          let tong = 0, A = 0, A1 = 0;
          for (const s of ss) {
            if (s.createdAtMs >= sMs && s.createdAtMs <= eMs) {
              tong += 1;
              if (s.licence === "A") A += 1; else A1 += 1;
            }
          }
          return { label: b.label, tong, A, A1 };
        });
      },

      revenueCumulative(grain, count, mode = "rolling") {
        const buckets = this.revenueBuckets(grain, count, null, mode);
        let t = 0, d = 0, c = 0;
        return buckets.map(b => { t += b.tong; d += b.daNhan; c += b.conNo; return { label: b.label, tong: t, daNhan: d, conNo: c }; });
      },

      studentCumulative(grain, count, mode = "rolling") {
        const buckets = this.studentBuckets(grain, count, null, mode);
        let t = 0, a = 0, a1 = 0;
        return buckets.map(b => { t += b.tong; a += b.A; a1 += b.A1; return { label: b.label, tong: t, A: a, A1: a1 }; });
      },

      branchPerformance() {
        return branches.map(b => {
          // Use index maps instead of full-array filters (3x faster).
          const sList = studentsByBranchId.get(b.id) || [];
          const pList = paymentsByBranchId.get(b.id) || [];
          let tong = 0, daNhan = 0, conNo = 0;
          let paidFull = 0, partial = 0, unpaid = 0, noPayOnReg = 0;
          let paidImmediately = 0;
          for (const s of sList) {
            tong  += s.totalFee;
            conNo += s.balance;
            if (s.paymentStatus === "100%") paidFull++;
            else if (s.paymentStatus === "50%") partial++;
            else unpaid++;
            if (s.noPayOnRegistration) noPayOnReg++;
            // paidImmediately: derived once at boot via the same cutoff
            // pass as noPayOnRegistration — re-read it here.
            if (s.paymentStatus === "100%" && !s.noPayOnRegistration) {
              const cutoff = s.createdAtMs + 10 * 60 * 1000;
              const sPays = paymentsByStudentId.get(s.id) || [];
              for (const p of sPays) {
                if (p.createdAtMs <= cutoff && p.amount >= s.totalFee) {
                  paidImmediately++; break;
                }
              }
            }
          }
          for (const p of pList) daNhan += p.amount;
          return {
            branchId: b.id, name: b.name,
            students: sList.length, revenue: daNhan, committed: tong, outstanding: conNo,
            paidFull, partial, unpaid, noPayOnReg, paidImmediately,
          };
        });
      },

      PROFILE_DOCS: [
        { key: "cccd",      label: "CCCD",                 hint: "Hình mặt trước · OCR sẽ tự điền thông tin" },
        { key: "gksk",      label: "Giấy khám sức khỏe",   hint: "Bản scan / chụp" },
        { key: "donDeNghi", label: "Đơn đề nghị học",      hint: "Đơn đề nghị học sát hạch" },
        { key: "the3x4",    label: "Thẻ 3×4",              hint: "Ảnh chân dung" },
      ],
    };

    window.MGT_DATA = MGT_DATA;
    return MGT_DATA;
  }

  // Expose the boot promise — app.jsx will await this before rendering.
  window.MGT_DATA_READY = boot().catch(err => {
    console.error("[data-loader] boot failed:", err);
    throw err;
  });
})();
