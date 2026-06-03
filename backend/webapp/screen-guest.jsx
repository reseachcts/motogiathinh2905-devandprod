// ====================================================================
// GuestApp — single-page vertical mobile shell for kiosk users.
//
// One page: a big "Thêm học viên" card at the top, then the operator's
// student list below. Tap a row to open the detail/edit view.
//
// MOBILE-PORT NOTE: this file uses several browser-only APIs that a
// native shell will need to substitute:
//   - window.MGT_DATA / window.MGT_TOAST / window.useTheme / window.fmtPhone
//     (global injection points from the web shell — pass via props or
//      a context provider in RN)
//   - window.addEventListener("mgt:datachanged") for cross-screen
//     refresh (replace with the store's subscribe API)
//   - document.addEventListener("mousedown") for click-outside on the
//     user-chip menu (use a touch-outside / Pressable backdrop)
//   - window.location.reload() on logout (clear auth state + navigate)
//   - <input type="file" capture="environment"> for photo capture
//     (use expo-image-picker or react-native-image-picker)
//   - fetch('/api/auth/logout') — keep, just point at absolute URL
// ====================================================================

const GUEST_MAX_WIDTH = 420;

// Single seam for user-facing toast. On web this delegates to the
// shared window.MGT_TOAST bus (data-loader.js). On a native port,
// swap the function body to call the platform toast/snackbar — the
// rest of this file calls only `toast()`, never the global directly.
const toast = (msg) => { if (window.MGT_TOAST) window.MGT_TOAST(msg); };

// Shared inline-error banner style (the pink QR error chip). Used in
// both the create modal and the detail screen.
const ERROR_BANNER_STYLE = {
  marginTop: 8, padding: "8px 12px", borderRadius: 10,
  fontFamily: "var(--font-mono)", fontSize: 12,
  background: "color-mix(in oklab, var(--neon-pink) 12%, transparent)",
  color: "var(--neon-pink)", border: "1px solid var(--neon-pink)",
};

function GuestApp() {
  const D = window.MGT_DATA;
  const me = D.currentUser;
  const [, _bump] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const fn = () => _bump();
    window.addEventListener("mgt:datachanged", fn);
    return () => window.removeEventListener("mgt:datachanged", fn);
  }, []);

  const [addOpen, _setAddOpen] = React.useState(false);
  const setAddOpen = (v) => {
    if (v) D.api.refreshMe?.().catch(() => {});  // fresh assignedClassId
    _setAddOpen(v);
  };
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
          position: "relative",
        }}>
          <GuestUserChip me={me} count={myStudents.length}/>
          <div style={{ flex: 1 }}/>
          <GuestThemeToggle/>
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
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)",
                          fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{window.fmtPhone ? window.fmtPhone(s.phone || "") : (s.phone || "")}</div>
          </div>
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
  const [name,    setName]    = React.useState(student.name    || "");
  const [phone,   setPhone]   = React.useState(student.phone   || "");
  const [licence, setLicence] = React.useState(student.licence || "A1");
  // newFiles tracks photos the user picked this session; existing photo
  // status comes from student.docs.{cccd,cccd_back,cccd_qr}.
  const [newFiles, setNewFiles] = React.useState({});
  // QR re-scan state. When the operator picks a NEW QR photo we must
  // re-validate it through /api/ocr/cccd-qr before allowing save; the
  // existing QR on the student row is assumed already-valid since it
  // was gated at create time.
  const [qrInfo,  setQrInfo]  = React.useState(null);
  const [qrErr,   setQrErr]   = React.useState(null);
  const [qrBusy,  setQrBusy]  = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err,  setErr]  = React.useState(null);
  const busyRef = React.useRef(false);

  const fieldsDirty = (name    !== (student.name    || ""))
                   || (phone   !== (student.phone   || ""))
                   || (licence !== (student.licence || ""));
  // Non-QR photos are unrestricted; the QR slot is gated below.
  const otherPhotosDirty = !!(newFiles.cccd || newFiles.cccd_back);
  const qrReplaced       = !!newFiles.cccd_qr;
  const isDirty = fieldsDirty || otherPhotosDirty || qrReplaced;

  const pickPhoto = (key, file) => { if (file) setNewFiles(prev => ({ ...prev, [key]: file })); };

  // Same scanQr logic as the create dialog.
  const scanQr = async (file) => {
    if (!file) return;
    setQrBusy(true); setQrErr(null);
    try {
      const out = await D.api.cccdQr(file);
      setQrInfo(out.fields);
      setNewFiles(prev => ({ ...prev, cccd_qr: file }));
    } catch (e) {
      setQrInfo(null);
      setNewFiles(prev => { const { cccd_qr, ...rest } = prev; return rest; });
      setQrErr(e.code === 'qr_unreadable' || e.code === 'qr_failed'
        ? "QR chưa rõ. Hãy chụp rõ hơn."
        : (e.message || "QR chưa rõ. Hãy chụp rõ hơn."));
    } finally {
      setQrBusy(false);
    }
  };

  // Save is blocked if the operator picked a new QR but it didn't scan.
  // Picking another photo first re-arms qrInfo via scanQr success path.
  const canSubmit = !busy && isDirty && (!qrReplaced || !!qrInfo?.idNumber);

  const submit = async () => {
    if (busyRef.current || !canSubmit) return;
    busyRef.current = true;
    try {
      setBusy(true); setErr(null);
      // 1) PATCH text fields + (if QR was re-scanned) the new idNumber
      //    pulled from the QR payload.
      const patch = {};
      if (name    !== (student.name    || "")) patch.name    = name    || null;
      if (phone   !== (student.phone   || "")) patch.phone   = phone   || null;
      if (licence !== (student.licence || "")) patch.licence = licence || null;
      if (qrReplaced && qrInfo?.idNumber)      patch.idNumber = qrInfo.idNumber;
      if (Object.keys(patch).length) await D.api.updateStudent(student.id, patch);
      // 2) Upload any new photos.
      const uploads = Object.entries(newFiles).filter(([, f]) => !!f);
      for (const [key, file] of uploads) {
        try { await D.api.uploadStudentDoc(student.id, key, file); }
        catch (e) {
          toast(`Lỗi tải ảnh ${key}: ${e.message}`);
        }
      }
      setNewFiles({}); setQrInfo(null);
      toast("Đã lưu thay đổi.");
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
          <div style={{ marginTop: 4 }}>
            <GuestClassChip variant="subheading"/>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input label="Họ tên" value={name} onChange={setName}/>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
          <Input label="Số điện thoại" value={phone} onChange={setPhone}
                 digits maxDigits={10} format={window.fmtPhone}/>
          <LicencePill value={licence} onChange={setLicence}/>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <PhotoSlot label="CCCD mặt trước"
                     file={newFiles.cccd}     existing={student.docs?.cccd}
                     onPick={(f) => pickPhoto("cccd", f)}/>
          <PhotoSlot label="CCCD mặt sau"
                     file={newFiles.cccd_back} existing={student.docs?.cccd_back}
                     onPick={(f) => pickPhoto("cccd_back", f)}/>
          <div style={{ gridColumn: "1 / -1" }}>
            <QrSlot file={newFiles.cccd_qr}
                    busy={qrBusy}
                    ok={qrReplaced ? !!qrInfo?.idNumber : !!student.docs?.cccd_qr}
                    idNumber={qrInfo?.idNumber || (qrReplaced ? null : student.idNumber)}
                    onPick={scanQr}/>
            {qrErr && <div style={ERROR_BANNER_STYLE}>{qrErr}</div>}
          </div>
        </div>
      </div>

      {err && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-pink)" }}>Lỗi: {err}</span>
      )}

      <button onClick={submit} disabled={!canSubmit} style={{
        padding: "14px 16px", borderRadius: 14, border: "none",
        cursor: canSubmit ? "pointer" : "not-allowed",
        background: canSubmit ? "var(--neon-cyan)" : "var(--glass-2)",
        color: canSubmit ? "var(--ink-0)" : "var(--fg-3)",
        boxShadow: canSubmit ? "0 0 0 1px var(--neon-cyan), 0 0 18px var(--neon-cyan-haze)" : "none",
        fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600,
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        opacity: busy ? 0.6 : 1,
      }}>
        <Icon name="check" size={16}/>
        {busy ? "Đang lưu…" : !isDirty ? "Không có thay đổi" : (qrReplaced && !qrInfo?.idNumber) ? "Chờ QR hợp lệ" : "Lưu thay đổi"}
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
  const [name,     setName]     = React.useState("");
  const [phone,    setPhone]    = React.useState("");
  const [licence,  setLicence]  = React.useState("A1");    // hạng bằng — A or A1
  const [docFiles, setDocFiles] = React.useState({});      // { cccd, cccd_back, cccd_qr }
  const [qrInfo,   setQrInfo]   = React.useState(null);    // { idNumber, name, ... } after a successful scan
  const [qrErr,    setQrErr]    = React.useState(null);    // "QR chưa rõ. Hãy chụp rõ hơn." etc
  const [qrBusy,   setQrBusy]   = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err,  setErr]  = React.useState(null);
  const busyRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    setName(""); setPhone(""); setLicence("A1"); setDocFiles({});
    setQrInfo(null); setQrErr(null); setQrBusy(false);
    setBusy(false); setErr(null);
    busyRef.current = false;
  }, [open]);

  const pickPhoto = (key, file) => { if (file) setDocFiles(prev => ({ ...prev, [key]: file })); };

  // QR-scan slot: when the operator picks a photo, ship it to the server
  // for QR decode. Only "approved" (idNumber returned) photos are kept.
  const scanQr = async (file) => {
    if (!file) return;
    setQrBusy(true); setQrErr(null);
    try {
      const out = await D.api.cccdQr(file);
      setQrInfo(out.fields);
      setDocFiles(prev => ({ ...prev, cccd_qr: file }));
    } catch (e) {
      setQrInfo(null);
      setDocFiles(prev => { const { cccd_qr, ...rest } = prev; return rest; });
      setQrErr(e.code === 'qr_unreadable' || e.code === 'qr_failed'
        ? "QR chưa rõ. Hãy chụp rõ hơn."
        : (e.message || "QR chưa rõ. Hãy chụp rõ hơn."));
    } finally {
      setQrBusy(false);
    }
  };

  // Submit blocked until the QR returns a CCCD number.
  const canSubmit = !busy && name.trim() && !!qrInfo?.idNumber;
  const submit = async () => {
    if (busyRef.current || !canSubmit) return;
    busyRef.current = true;
    try {
      setBusy(true); setErr(null);
      // Backfill form from QR payload (idNumber + any extras QR provided).
      const form = {
        name: name.trim(),
        phone: phone.trim() || null,
        licence,
        idNumber: qrInfo.idNumber,
        ...(qrInfo.dob         && { dob: qrInfo.dob }),
        ...(qrInfo.gender      && { gender: qrInfo.gender }),
        ...(qrInfo.address     && { address: qrInfo.address }),
        ...(qrInfo.ngayCapCCCD && { ngayCapCCCD: qrInfo.ngayCapCCCD }),
      };
      const uploadMap = { cccd: docFiles.cccd, cccd_back: docFiles.cccd_back, cccd_qr: docFiles.cccd_qr };
      const docs = { cccd: !!uploadMap.cccd, cccd_back: !!uploadMap.cccd_back, cccd_qr: !!uploadMap.cccd_qr };
      const created = await D.api.createStudent({ form, docs, profileComplete: false });
      await Promise.all(Object.entries(uploadMap).map(
        ([key, file]) => file ? D.api.uploadStudentDoc(created.id, key, file).catch((e) => {
          toast(`Lỗi tải ảnh ${key}: ${e.message}`);
        }) : null
      ));
      toast(`Đã thêm học viên: ${form.name}`);
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
           secondary={null}
           footerStart={<GuestClassChip variant="button"/>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && (
          <div style={{
            padding: "8px 12px", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 11,
            background: "color-mix(in oklab, var(--neon-pink) 12%, transparent)",
            color: "var(--neon-pink)", border: "1px solid var(--neon-pink)",
          }}>Lỗi: {err}</div>
        )}
        <Input label="Họ tên" value={name} onChange={setName} placeholder="Nguyễn Văn A"/>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
          <Input label="Số điện thoại" value={phone} onChange={setPhone} placeholder="090 123 4567"
                 digits maxDigits={10} format={window.fmtPhone}/>
          <LicencePill value={licence} onChange={setLicence}/>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <PhotoSlot label="CCCD mặt trước" file={docFiles.cccd}
                     onPick={(f) => pickPhoto("cccd", f)}/>
          <PhotoSlot label="CCCD mặt sau" file={docFiles.cccd_back}
                     onPick={(f) => pickPhoto("cccd_back", f)}/>
          <div style={{ gridColumn: "1 / -1" }}>
            <QrSlot file={docFiles.cccd_qr} busy={qrBusy} ok={!!qrInfo?.idNumber}
                    idNumber={qrInfo?.idNumber} onPick={scanQr}/>
            {qrErr && <div style={ERROR_BANNER_STYLE}>{qrErr}</div>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function QrSlot({ file, busy, ok, idNumber, onPick }) {
  const inputRef = React.useRef(null);
  const color = busy ? "var(--neon-cyan)" : ok ? "var(--neon-lime)" : "var(--fg-2)";
  const bg    = busy ? "color-mix(in oklab, var(--neon-cyan) 10%, transparent)"
              : ok   ? "color-mix(in oklab, var(--neon-lime) 10%, transparent)"
              :       "var(--ink-2)";
  const border = busy ? "var(--neon-cyan)" : ok ? "var(--neon-lime)" : "var(--glass-stroke-strong)";
  return (
    <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} style={{
      width: "100%",
      padding: "16px 12px", borderRadius: 12, cursor: busy ? "wait" : "pointer", textAlign: "center",
      background: bg, border: `1px dashed ${border}`, color,
      fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600,
      minHeight: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
    }}>
      <span>Mã QR trên CCCD</span>
      <Icon name={ok ? "check" : "plus"} size={36} color={color}/>
      {busy && (
        <span style={{ ...LABEL_STYLE, fontSize: 9, color: "var(--neon-cyan)" }}>Đang quét…</span>
      )}
      {ok && idNumber && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-lime)",
                       letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums" }}>
          CCCD {idNumber}
        </span>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
             onChange={(e) => onPick(e.target.files?.[0])}
             style={{ display: "none" }}/>
    </button>
  );
}

function PhotoSlot({ label, file, existing, onPick }) {
  const inputRef = React.useRef(null);
  const has = !!file || !!existing;
  return (
    <button type="button" onClick={() => inputRef.current?.click()} style={{
      width: "100%",
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

// Avatar + name + role chip. Tapping it pops a small menu with a
// logout action (the only explicit way for a guest to sign out).
function GuestUserChip({ me, count }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
    window.location.reload();
  };
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 10,
                             flex: 1, minWidth: 0, maxWidth: 280 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: open ? "var(--ink-2)" : "transparent",
        border: "1px solid", borderColor: open ? "var(--glass-stroke-strong)" : "transparent",
        borderRadius: 12, padding: "4px 8px 4px 4px", cursor: "pointer",
        flex: 1, minWidth: 0, textAlign: "left", fontFamily: "inherit",
        transition: "background 140ms var(--ease-out), border-color 140ms var(--ease-out)",
      }}>
        <Avatar name={me.name} size={36}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{me.name}</div>
          <div style={{ ...LABEL_STYLE, fontSize: 9 }}>Cộng tác viên · {count} hồ sơ</div>
        </div>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 40,
          minWidth: 200, padding: 4, borderRadius: 12,
          background: "var(--glass-3)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
          border: "1px solid var(--glass-stroke-strong)", boxShadow: "var(--shadow-3)",
        }}>
          <button onClick={logout} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            padding: "10px 12px", borderRadius: 8, cursor: "pointer",
            background: "transparent", border: "none", color: "var(--neon-pink)",
            fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, textAlign: "left",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in oklab, var(--neon-pink) 12%, transparent)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <Icon name="logout" size={14}/>
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

// Compact theme toggle for the guest top bar — sun ↔ moon icon button.
function GuestThemeToggle() {
  const [theme, setTheme] = window.useTheme();
  const isLight = theme === "light";
  return (
    <button onClick={() => setTheme(isLight ? "dark" : "light")}
            title={isLight ? "Chuyển sang Dark" : "Chuyển sang Light"}
            style={{
              width: 36, height: 36, borderRadius: 999, cursor: "pointer",
              background: "var(--glass-2)", border: "1px solid var(--glass-stroke)",
              color: isLight ? "#D97500" : "var(--neon-cyan)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              transition: "all 160ms var(--ease-out)",
              boxShadow: isLight ? "0 0 12px rgba(217,117,0,0.35)" : "0 0 12px var(--neon-cyan-haze)",
            }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {isLight
          ? (<g><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></g>)
          : (<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>)}
      </svg>
    </button>
  );
}

// --------------------------------------------------------------------
// GuestClassChip — read-only display of the guest's assigned class.
// Surfaces in two places: a subheading under the student name in the
// detail hero, and a chip beside the primary action in the create
// modal footer. The assignment is written by admin via the Tổ chức
// account dialog — guest has no edit affordance anywhere.
// --------------------------------------------------------------------
function GuestClassChip({ variant = "button" }) {
  const D = window.MGT_DATA;
  const me = D.currentUser;
  const cls = me?.assignedClassId ? D.getClass(me.assignedClassId) : null;
  const label = cls?.code || "Chưa được gán lớp";

  const baseStyle = variant === "subheading"
    ? {
        fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500,
        color: cls ? "var(--neon-cyan)" : "var(--fg-3)",
        display: "inline-flex", alignItems: "center", gap: 6,
      }
    : {
        background: cls
          ? "color-mix(in oklab, var(--neon-cyan) 12%, transparent)"
          : "var(--ink-2)",
        border: "1px solid",
        borderColor: cls ? "var(--neon-cyan)" : "var(--glass-stroke-strong)",
        color: cls ? "var(--neon-cyan)" : "var(--fg-3)",
        padding: "6px 12px", borderRadius: 999,
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600,
        whiteSpace: "nowrap",
      };

  return (
    <span style={baseStyle} title={cls ? `Lớp được giao: ${cls.code}` : "Admin chưa gán lớp"}>
      <Icon name="calendar" size={variant === "subheading" ? 13 : 12}/>
      <span>{label}</span>
    </span>
  );
}

// Segmented pill for "Hạng bằng" — sits in the SĐT + Hạng bằng row
// of the guest create / detail forms. Renders like a labelled Select
// (eyebrow on top, capsule below) so it aligns visually with the
// adjacent Input atom.
function LicencePill({ value, onChange, options = [{ id: "A1", label: "A1" }, { id: "A", label: "A" }] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={LABEL_STYLE}>Hạng bằng</label>
      <div style={{
        display: "inline-flex", padding: 3, gap: 3,
        background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
        borderRadius: 10, height: 40, alignItems: "stretch",
      }}>
        {options.map(o => {
          const active = o.id === value;
          return (
            <button key={o.id} type="button" onClick={() => onChange(o.id)} style={{
              flex: 1, padding: "0 14px", borderRadius: 8, cursor: "pointer",
              background: active ? "var(--neon-cyan)" : "transparent",
              color: active ? "var(--ink-0)" : "var(--fg-2)",
              border: "none",
              fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600,
              boxShadow: active ? "0 0 12px var(--neon-cyan-haze)" : "none",
              transition: "all 140ms var(--ease-out)",
            }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

window.GuestApp = GuestApp;
