// ====================================================================
// GuestApp — vertical mobile-style shell for kiosk users.
//
// Guests have only two screens (Home / My students) and one action
// (Add student). No sidebar, no tabs, no charts. Centred narrow column
// to simulate a phone display even on desktop.
// ====================================================================

const GUEST_MAX_WIDTH = 420;

function GuestApp() {
  const D = window.MGT_DATA;
  const me = D.currentUser;
  const [, _bump] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const fn = () => _bump();
    window.addEventListener("mgt:datachanged", fn);
    return () => window.removeEventListener("mgt:datachanged", fn);
  }, []);

  const [tab, setTab]       = React.useState("home");
  const [addOpen, setAddOpen] = React.useState(false);
  const myStudents = D.students;  // server already scopes to guest's own

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", background: "var(--bg-0)",
    }}>
      <div style={{
        width: "100%", maxWidth: GUEST_MAX_WIDTH,
        minHeight: "100vh", display: "flex", flexDirection: "column",
        background: "var(--glass-1)",
        borderLeft: "1px solid var(--glass-stroke)",
        borderRight: "1px solid var(--glass-stroke)",
      }}>
        {/* Top bar */}
        <header style={{
          padding: "18px 18px 14px", display: "flex", alignItems: "center", gap: 10,
          borderBottom: "1px solid var(--ink-4)",
        }}>
          <Avatar name={me.name} size={36}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{me.name}</div>
            <div style={{ ...LABEL_STYLE, fontSize: 9 }}>Khách · {myStudents.length} học viên</div>
          </div>
          <button onClick={async () => {
            try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
            window.location.reload();
          }} style={{
            background: "transparent", border: "1px solid var(--glass-stroke)",
            color: "var(--fg-3)", padding: "6px 10px", borderRadius: 8, cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
          }}>Thoát</button>
        </header>

        {/* Body */}
        <main style={{ flex: 1, overflowY: "auto", padding: "16px 18px 80px" }}>
          {tab === "home" && (
            <GuestHome onAdd={() => setAddOpen(true)} onOpenList={() => setTab("list")} count={myStudents.length}/>
          )}
          {tab === "list" && <GuestStudentList students={myStudents}/>}
        </main>

        {/* Bottom nav */}
        <nav style={{
          position: "sticky", bottom: 0, padding: "10px 18px",
          background: "var(--glass-2)", borderTop: "1px solid var(--ink-4)",
          backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
          display: "flex", gap: 10,
        }}>
          <GuestNavButton active={tab === "home"} onClick={() => setTab("home")} icon="home" label="Trang chủ"/>
          <GuestNavButton active={tab === "list"} onClick={() => setTab("list")} icon="users" label="Học viên" badge={myStudents.length}/>
        </nav>
      </div>

      <GuestAddStudentModal open={addOpen} onClose={() => setAddOpen(false)}/>
    </div>
  );
}

function GuestNavButton({ active, onClick, icon, label, badge }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, background: active ? "var(--ink-2)" : "transparent",
      border: "1px solid", borderColor: active ? "var(--neon-cyan)" : "var(--glass-stroke)",
      color: active ? "var(--neon-cyan)" : "var(--fg-2)",
      padding: "10px 8px", borderRadius: 12, cursor: "pointer",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600,
      boxShadow: active ? "0 0 14px var(--neon-cyan-haze)" : "none",
      position: "relative",
    }}>
      <Icon name={icon} size={18}/>
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{ position: "absolute", top: 4, right: 10,
                       background: "var(--neon-cyan)", color: "var(--ink-0)",
                       fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 999 }}>{badge}</span>
      )}
    </button>
  );
}

function GuestHome({ onAdd, onOpenList, count }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 12 }}>
      <div style={{ textAlign: "center", padding: "24px 12px 18px" }}>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600,
                     color: "var(--fg-1)", letterSpacing: "-0.02em" }}>Chào bạn 👋</h1>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-3)" }}>
          Thêm học viên mới hoặc xem danh sách của bạn.
        </p>
      </div>

      <button onClick={onAdd} style={{
        padding: "22px 18px", borderRadius: 16, border: "none", cursor: "pointer",
        background: "var(--neon-cyan)", color: "var(--ink-0)",
        boxShadow: "0 0 28px var(--neon-cyan-haze), 0 0 0 1px var(--neon-cyan)",
        display: "flex", alignItems: "center", gap: 14,
        fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600,
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(0,0,0,0.18)",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="user-plus" size={22} color="var(--ink-0)"/>
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div>Thêm học viên</div>
          <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.75, marginTop: 2 }}>Tên + CCCD + ảnh là đủ</div>
        </div>
      </button>

      <button onClick={onOpenList} style={{
        padding: "20px 18px", borderRadius: 16, cursor: "pointer",
        background: "var(--glass-2)", border: "1px solid var(--glass-stroke-strong)",
        color: "var(--fg-1)", display: "flex", alignItems: "center", gap: 14,
        fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600,
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--ink-2)",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="users" size={20}/>
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div>Học viên của tôi</div>
          <div style={{ ...LABEL_STYLE, marginTop: 4 }}>{count} hồ sơ đã đăng ký</div>
        </div>
        <Icon name="arrow-right" size={18} color="var(--fg-3)"/>
      </button>
    </div>
  );
}

function GuestStudentList({ students }) {
  if (students.length === 0) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--fg-3)" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 14 }}>Chưa có học viên nào</div>
        <div style={{ ...LABEL_STYLE, marginTop: 10 }}>Bấm "Thêm học viên" ở trang chủ</div>
      </div>
    );
  }
  const sorted = [...students].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ ...LABEL_STYLE, padding: "4px 4px 8px" }}>{students.length} học viên</div>
      {sorted.map(s => (
        <div key={s.id} style={{
          padding: "14px 14px", borderRadius: 14,
          background: "var(--glass-2)", border: "1px solid var(--glass-stroke)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <Avatar name={s.name} size={40}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
            <div style={{ ...LABEL_STYLE, fontSize: 9, marginTop: 2 }}>{s.maHV} · {s.createdAt?.split(" ")[0] || ""}</div>
          </div>
          {s.idNumber && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", textAlign: "right" }}>
              CCCD<br/>{s.idNumber.slice(-4)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------
// GuestAddStudentModal — minimal create form for guest users.
//   Inputs: Name + CCCD number.
//   Uploads: CCCD front (with OCR autofill), CCCD back, 3×4 portrait.
//   Server fills classId=null, responsibleStaffId=guest's id.
// --------------------------------------------------------------------
function GuestAddStudentModal({ open, onClose }) {
  const D = window.MGT_DATA;
  const [name,      setName]      = React.useState("");
  const [idNumber,  setIdNumber]  = React.useState("");
  const [docFiles,  setDocFiles]  = React.useState({});  // { cccd, cccd_back, the3x4 }
  const [ocrToast,  setOcrToast]  = React.useState(null);
  const [ocrBusy,   setOcrBusy]   = React.useState(false);
  const [extraForm, setExtraForm] = React.useState({});  // OCR-derived fields
  const [busy, setBusy] = React.useState(false);
  const [err,  setErr]  = React.useState(null);
  const busyRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    setName(""); setIdNumber(""); setDocFiles({}); setOcrToast(null);
    setOcrBusy(false); setExtraForm({}); setBusy(false); setErr(null);
    busyRef.current = false;
  }, [open]);

  const handlePhoto = async (key, file) => {
    if (!file) return;
    setDocFiles(prev => ({ ...prev, [key]: file }));
    if (key !== "cccd") return;
    setOcrBusy(true);
    setOcrToast({ kind: "info", msg: "Đang quét CCCD…" });
    try {
      const out = await D.api.ocrCccd(file);
      const f = out.fields || {};
      const applied = [];
      if (f.idNumber && !idNumber) { setIdNumber(f.idNumber); applied.push("CCCD"); }
      if (f.name     && !name)     { setName(f.name);         applied.push("tên"); }
      const extras = {};
      ["dob", "gender", "queQuan", "address", "ngayCapCCCD"].forEach(k => {
        if (f[k]) { extras[k] = f[k]; applied.push(k); }
      });
      if (Object.keys(extras).length) setExtraForm(prev => ({ ...prev, ...extras }));
      setOcrToast({
        kind: applied.length ? "ok" : "warn",
        msg: applied.length ? `OCR điền ${applied.length} trường` : "Không trích xuất được — kiểm tra ảnh",
      });
    } catch (e) {
      setOcrToast({ kind: "err", msg: "OCR thất bại: " + (e.message || e) });
    } finally {
      setOcrBusy(false);
      setTimeout(() => setOcrToast(null), 3500);
    }
  };

  const canSubmit = !busy && name.trim();
  const submit = async () => {
    if (busyRef.current || !canSubmit) return;
    busyRef.current = true;
    try {
      setBusy(true); setErr(null);
      const form = { name: name.trim(), idNumber: idNumber.trim() || null, ...extraForm };
      const docs = { cccd: !!docFiles.cccd, cccd_back: !!docFiles.cccd_back, the3x4: !!docFiles.the3x4 };
      const created = await D.api.createStudent({ form, docs, profileComplete: false });
      // Upload files after the row exists.
      await Promise.all(Object.entries(docFiles).map(
        ([key, file]) => file ? D.api.uploadStudentDoc(created.id, key, file).catch((e) => {
          if (window.MGT_TOAST) window.MGT_TOAST(`Lỗi tải ảnh ${key}: ${e.message}`);
        }) : null
      ));
      if (window.MGT_TOAST) window.MGT_TOAST(`Đã thêm học viên: ${form.name}`);
      onClose();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      busyRef.current = false; setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} width={GUEST_MAX_WIDTH}
           title="Thêm học viên"
           subtitle="Chỉ cần tên + CCCD"
           primaryAction={submit}
           primaryLabel={busy ? "Đang lưu…" : "Lưu học viên"}
           primaryIcon="check"
           primaryDisabled={!canSubmit}
           footerStart={err ? (
             <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-pink)" }}>Lỗi: {err}</span>
           ) : null}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="Họ tên" value={name} onChange={setName} placeholder="Nguyễn Văn A"/>
        <Input label="Số CCCD" value={idNumber} onChange={setIdNumber} placeholder="012345678901"
               digits maxDigits={12} mono format={window.fmtCCCD}/>

        {ocrToast && (
          <div style={{
            padding: "8px 12px", borderRadius: 10, fontSize: 12,
            fontFamily: "var(--font-mono)",
            background: ocrToast.kind === "err"  ? "color-mix(in oklab, var(--neon-pink) 12%, transparent)"
                     :  ocrToast.kind === "ok"   ? "color-mix(in oklab, var(--neon-lime) 12%, transparent)"
                     :                            "color-mix(in oklab, var(--neon-cyan) 12%, transparent)",
            color:      ocrToast.kind === "err"  ? "var(--neon-pink)"
                     :  ocrToast.kind === "ok"   ? "var(--neon-lime)"
                     :                            "var(--neon-cyan)",
            border: "1px solid currentColor",
          }}>{ocrBusy ? "⏳ " : ""}{ocrToast.msg}</div>
        )}

        <div style={{ ...LABEL_STYLE, paddingTop: 4 }}>Hình ảnh</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <PhotoSlot label="CCCD mặt trước" hint="OCR tự điền" file={docFiles.cccd}
                     onPick={(f) => handlePhoto("cccd", f)} accent={ocrBusy ? "cyan-spin" : "cyan"}/>
          <PhotoSlot label="CCCD mặt sau" file={docFiles.cccd_back}
                     onPick={(f) => handlePhoto("cccd_back", f)}/>
          <div style={{ gridColumn: "1 / -1" }}>
            <PhotoSlot label="Ảnh 3×4 chân dung" file={docFiles.the3x4}
                       onPick={(f) => handlePhoto("the3x4", f)}/>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PhotoSlot({ label, hint, file, onPick, accent }) {
  const inputRef = React.useRef(null);
  const filled = !!file;
  const cyan = accent === "cyan" || accent === "cyan-spin";
  return (
    <button type="button" onClick={() => inputRef.current?.click()} style={{
      padding: "14px 12px", borderRadius: 12, cursor: "pointer", textAlign: "left",
      background: filled ? "color-mix(in oklab, var(--neon-lime) 10%, transparent)"
                : cyan  ? "color-mix(in oklab, var(--neon-cyan) 8%, transparent)"
                :         "var(--ink-2)",
      border: "1px dashed",
      borderColor: filled ? "var(--neon-lime)" : cyan ? "var(--neon-cyan)" : "var(--glass-stroke-strong)",
      color: "var(--fg-1)", fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600,
      minHeight: 84, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name={filled ? "check" : "plus"} size={14}
              color={filled ? "var(--neon-lime)" : cyan ? "var(--neon-cyan)" : "var(--fg-3)"}/>
        <span>{label}</span>
      </div>
      <div style={{ ...LABEL_STYLE, fontSize: 9, color: filled ? "var(--neon-lime)" : "var(--fg-3)" }}>
        {filled ? "Đã chọn ảnh" : hint || "Bấm để chọn ảnh"}
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
             onChange={(e) => onPick(e.target.files?.[0])}
             style={{ display: "none" }}/>
    </button>
  );
}

window.GuestApp = GuestApp;
