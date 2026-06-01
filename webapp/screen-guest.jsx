// ====================================================================
// GuestApp — single-page vertical mobile shell for kiosk users.
//
// One page: a big "Thêm học viên" card at the top, then the operator's
// student list below. Tap a row to open the detail/edit view.
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

  const [addOpen, setAddOpen] = React.useState(false);
  const [viewingId, setViewingId] = React.useState(null);
  const myStudents = D.students;  // server already scopes to guest's own
  const viewing = viewingId ? D.getStudent(viewingId) : null;

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
            <div style={{ ...LABEL_STYLE, fontSize: 9 }}>Cộng tác viên · {myStudents.length} hồ sơ</div>
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
        <main style={{ flex: 1, overflowY: "auto", padding: "16px 18px 32px" }}>
          {viewing ? (
            <GuestStudentDetail student={viewing} onBack={() => setViewingId(null)}/>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Create-profile card on top */}
              <button onClick={() => setAddOpen(true)} style={{
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
                <span style={{ flex: 1, textAlign: "left" }}>Thêm học viên</span>
              </button>

              <GuestStudentList students={myStudents} onOpen={(id) => setViewingId(id)}/>
            </div>
          )}
        </main>
      </div>

      <GuestAddStudentModal open={addOpen} onClose={() => setAddOpen(false)}/>
    </div>
  );
}

function GuestHome({ onAdd, onOpenList, count }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 36 }}>
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
        <span style={{ flex: 1, textAlign: "left" }}>Thêm học viên</span>
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
          <div style={{ ...LABEL_STYLE, marginTop: 4 }}>{count}</div>
        </div>
        <Icon name="arrow-right" size={18} color="var(--fg-3)"/>
      </button>
    </div>
  );
}

function GuestStudentList({ students, onOpen }) {
  if (students.length === 0) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--fg-3)" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 14 }}>Chưa có học viên nào</div>
      </div>
    );
  }
  const sorted = [...students].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sorted.map(s => (
        <button key={s.id} onClick={() => onOpen(s.id)} style={{
          padding: "14px 14px", borderRadius: 14, cursor: "pointer", textAlign: "left",
          background: "var(--glass-2)", border: "1px solid var(--glass-stroke)",
          display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit",
          transition: "background 140ms var(--ease-out), border-color 140ms var(--ease-out)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--neon-cyan)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--glass-stroke)"; }}>
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
          <Icon name="arrow-right" size={14} color="var(--fg-3)"/>
        </button>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------
// GuestStudentDetail — edit only Họ tên, SĐT, and the three photos
// (CCCD front, CCCD back, 3×4 portrait). Mirrors the create dialog.
// --------------------------------------------------------------------
function GuestStudentDetail({ student, onBack }) {
  const D = window.MGT_DATA;
  const [name,  setName]  = React.useState(student.name  || "");
  const [phone, setPhone] = React.useState(student.phone || "");
  // newFiles tracks photos the user picked this session; existing photo
  // status comes from student.docs.{cccd,cccd_back,the3x4}.
  const [newFiles, setNewFiles] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [err,  setErr]  = React.useState(null);
  const busyRef = React.useRef(false);

  const fieldsDirty = (name  !== (student.name  || "")) || (phone !== (student.phone || ""));
  const photosDirty = !!(newFiles.cccd || newFiles.cccd_back || newFiles.the3x4);
  const isDirty = fieldsDirty || photosDirty;

  const pickPhoto = (key, file) => { if (file) setNewFiles(prev => ({ ...prev, [key]: file })); };

  const submit = async () => {
    if (busyRef.current || !isDirty) return;
    busyRef.current = true;
    try {
      setBusy(true); setErr(null);
      // 1) PATCH the text fields if changed.
      if (fieldsDirty) {
        const patch = {};
        if (name  !== (student.name  || "")) patch.name  = name  || null;
        if (phone !== (student.phone || "")) patch.phone = phone || null;
        await D.api.updateStudent(student.id, patch);
      }
      // 2) Upload any new photos. Each upload flips docs_<key> = true on
      //    the server and the in-memory row.
      const uploads = Object.entries(newFiles).filter(([, f]) => !!f);
      for (const [key, file] of uploads) {
        try { await D.api.uploadStudentDoc(student.id, key, file); }
        catch (e) {
          if (window.MGT_TOAST) window.MGT_TOAST(`Lỗi tải ảnh ${key}: ${e.message}`);
        }
      }
      setNewFiles({});
      if (window.MGT_TOAST) window.MGT_TOAST("Đã lưu thay đổi.");
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      busyRef.current = false; setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button onClick={onBack} style={{
        background: "transparent", border: "none", color: "var(--fg-3)",
        fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6, padding: 0, alignSelf: "flex-start",
      }}>
        <Icon name="arrow-up" size={14} style={{ transform: "rotate(-90deg)" }}/>
        Danh sách
      </button>

      {/* Hero */}
      <div style={{
        padding: "18px 16px", borderRadius: 16,
        background: "var(--glass-2)", border: "1px solid var(--glass-stroke)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <Avatar name={student.name} size={56} glow/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--fg-1)",
                        letterSpacing: "-0.02em",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.name}</div>
          <div style={{ ...LABEL_STYLE, marginTop: 4 }}>{student.maHV}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input label="Họ tên" value={name} onChange={setName}/>
        <Input label="Số điện thoại" value={phone} onChange={setPhone}
               digits maxDigits={10} format={window.fmtPhone}/>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <PhotoSlot label="CCCD mặt trước"
                     file={newFiles.cccd}     existing={student.docs?.cccd}
                     onPick={(f) => pickPhoto("cccd", f)}/>
          <PhotoSlot label="CCCD mặt sau"
                     file={newFiles.cccd_back} existing={student.docs?.cccd_back}
                     onPick={(f) => pickPhoto("cccd_back", f)}/>
          <div style={{ gridColumn: "1 / -1" }}>
            <PhotoSlot label="Ảnh thẻ 3×4"
                       file={newFiles.the3x4}  existing={student.docs?.the3x4}
                       onPick={(f) => pickPhoto("the3x4", f)}/>
          </div>
        </div>
      </div>

      {err && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-pink)" }}>Lỗi: {err}</span>
      )}

      <button onClick={submit} disabled={!isDirty || busy} style={{
        padding: "14px 16px", borderRadius: 14, border: "none",
        cursor: (!isDirty || busy) ? "not-allowed" : "pointer",
        background: isDirty ? "var(--neon-cyan)" : "var(--glass-2)",
        color: isDirty ? "var(--ink-0)" : "var(--fg-3)",
        boxShadow: isDirty ? "0 0 0 1px var(--neon-cyan), 0 0 18px var(--neon-cyan-haze)" : "none",
        fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600,
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        opacity: busy ? 0.6 : 1,
      }}>
        <Icon name="check" size={16}/>
        {busy ? "Đang lưu…" : isDirty ? "Lưu thay đổi" : "Không có thay đổi"}
      </button>
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
  const [phone,     setPhone]     = React.useState("");
  const [docFiles,  setDocFiles]  = React.useState({});  // { cccd, cccd_back, the3x4 }
  const [ocrToast,  setOcrToast]  = React.useState(null);
  const [ocrBusy,   setOcrBusy]   = React.useState(false);
  // OCR-derived hidden fields (idNumber, dob, gender, address, ...).
  const [extraForm, setExtraForm] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [err,  setErr]  = React.useState(null);
  const busyRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    setName(""); setPhone(""); setDocFiles({}); setOcrToast(null);
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
      if (f.name && !name) { setName(f.name); applied.push("tên"); }
      const extras = {};
      ["idNumber", "dob", "gender", "queQuan", "address", "ngayCapCCCD"].forEach(k => {
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
      const form = { name: name.trim(), phone: phone.trim() || null, ...extraForm };
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
           primaryAction={submit}
           primaryLabel={busy ? "Đang lưu…" : "Lưu học viên"}
           primaryIcon="check"
           primaryDisabled={!canSubmit}
           footerStart={err ? (
             <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-pink)" }}>Lỗi: {err}</span>
           ) : null}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="Họ tên" value={name} onChange={setName} placeholder="Nguyễn Văn A"/>
        <Input label="Số điện thoại" value={phone} onChange={setPhone} placeholder="090 123 4567"
               digits maxDigits={10} format={window.fmtPhone}/>

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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <PhotoSlot label="CCCD mặt trước" hint="OCR tự điền" file={docFiles.cccd}
                     onPick={(f) => handlePhoto("cccd", f)} accent={ocrBusy ? "cyan-spin" : "cyan"}/>
          <PhotoSlot label="CCCD mặt sau" file={docFiles.cccd_back}
                     onPick={(f) => handlePhoto("cccd_back", f)}/>
          <div style={{ gridColumn: "1 / -1" }}>
            <PhotoSlot label="Ảnh thẻ 3×4" file={docFiles.the3x4}
                       onPick={(f) => handlePhoto("the3x4", f)}/>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PhotoSlot({ label, file, existing, onPick }) {
  const inputRef = React.useRef(null);
  const justPicked = !!file;
  const has = justPicked || !!existing;
  return (
    <button type="button" onClick={() => inputRef.current?.click()} style={{
      padding: "16px 12px", borderRadius: 12, cursor: "pointer", textAlign: "center",
      background: has ? "color-mix(in oklab, var(--neon-lime) 10%, transparent)" : "var(--ink-2)",
      border: "1px dashed",
      borderColor: has ? "var(--neon-lime)" : "var(--glass-stroke-strong)",
      color: has ? "var(--neon-lime)" : "var(--fg-2)",
      fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600,
      minHeight: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
    }}>
      <span>{label}</span>
      <Icon name={has ? "check" : "plus"} size={36}
            color={has ? "var(--neon-lime)" : "var(--fg-3)"}/>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
             onChange={(e) => onPick(e.target.files?.[0])}
             style={{ display: "none" }}/>
    </button>
  );
}

window.GuestApp = GuestApp;
