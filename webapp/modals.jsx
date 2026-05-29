// ====================================================================
// Modals: AddStudent (with doc slots + OCR auto-fill + dropdowns)
//         AddPayment
//         AddClass
// ====================================================================

// --------------------------------------------------------------------
// Add Student Modal — the demo centerpiece
// --------------------------------------------------------------------
function AddStudentModal({ open, onClose, onSave }) {
  const D = window.MGT_DATA;
  const [form, setForm] = React.useState({
    name: "", gender: "", dob: "", idNumber: "", address: "", phone: "",
    queQuan: "", ngayCapCCCD: "", noiCapCCCD: "", notes: "",
    classId: "", feePlanId: "", promotionId: "", responsibleStaffId: "",
  });
  const [docs, setDocs] = React.useState({ cccd: false, gksk: false, donDeNghi: false, the3x4: false });
  // Captured File objects (per doc key). Uploaded after the student is
  // created — we need the student id before POSTing to /students/:id/docs/:key.
  const [docFiles, setDocFiles] = React.useState({});
  const [ocrToast, setOcrToast] = React.useState(false);

  // when CCCD slot is filled, OCR auto-fills basic info
  const handleDocDrop = (key, file) => {
    setDocs(prev => ({ ...prev, [key]: true }));
    if (file) setDocFiles(prev => ({ ...prev, [key]: file }));
    if (key === "cccd" && !form.idNumber) {
      // simulate OCR: populate name + gender + dob + idNumber + address +
      // queQuan + ngày cấp + nơi cấp
      setForm(prev => ({
        ...prev,
        name:        prev.name        || "Trần Thị Mai",
        gender:      prev.gender      || "Nữ",
        dob:         prev.dob         || "12/08/2002",
        idNumber:    prev.idNumber    || "079202155678",
        address:     prev.address     || "47 Nguyễn Đình Chiểu, Q.3, TP.HCM",
        queQuan:     prev.queQuan     || "Bến Tre",
        ngayCapCCCD: prev.ngayCapCCCD || "15/03/2021",
        noiCapCCCD:  prev.noiCapCCCD  || "Cục Cảnh sát QLHC về TTXH",
      }));
      setOcrToast(true);
      setTimeout(() => setOcrToast(false), 3000);
    }
  };

  // Open classes that are accepting new students
  const openClasses = D.classes.filter(c => c.status === "đang mở");

  // Selected fee plan determines which promotions are valid
  const selectedFeePlan = form.feePlanId ? D.getFeePlan(form.feePlanId) : null;
  const validPromos = selectedFeePlan
    ? D.promotions.filter(p => p.appliesTo.includes(selectedFeePlan.licence))
    : [];
  const selectedPromo = form.promotionId ? D.getPromotion(form.promotionId) : null;
  const totalFee = selectedFeePlan
    ? selectedFeePlan.amount - (selectedPromo ? selectedPromo.discount : 0)
    : 0;

  const docsCount = Object.values(docs).filter(Boolean).length;
  const REQUIRED_FIELDS = ["name", "gender", "dob", "idNumber", "address", "phone", "classId", "feePlanId", "promotionId", "responsibleStaffId"];
  const allFieldsFilled = REQUIRED_FIELDS.every(k => form[k]);
  const profileComplete = docsCount === 4 && allFieldsFilled;

  // reset on close
  React.useEffect(() => {
    if (!open) {
      setForm({ name: "", gender: "", dob: "", idNumber: "", address: "", phone: "", queQuan: "", ngayCapCCCD: "", noiCapCCCD: "", notes: "", classId: "", feePlanId: "", promotionId: "", responsibleStaffId: "" });
      setDocs({ cccd: false, gksk: false, donDeNghi: false, the3x4: false });
      setDocFiles({});
    }
  }, [open]);

  const SectionTitle = ({ children }) => (
    <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.015em" }}>{children}</h3>
  );

  return (
    <Modal open={open} onClose={onClose} width={880}
           primaryLabel="Lưu học viên"
           primaryAction={() => { onSave && onSave({ form, docs, profileComplete, docFiles }); onClose(); }}
           primaryDisabled={!form.name || !form.classId || !form.responsibleStaffId || openClasses.length === 0}
           footerStart={
             openClasses.length === 0 ? (
               <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--neon-pink)" }}>
                 Không có lớp đang mở — hãy tạo lớp trước.
               </span>
             ) : !profileComplete ? (
               <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--neon-amber)" }}>
                 Còn {4 - docsCount} ô tài liệu và {REQUIRED_FIELDS.filter(k=>!form[k]).length} trường chưa điền.
               </span>
             ) : null
           }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* OCR toast — pinned at top */}
        {ocrToast && (
          <div style={{
            padding: "8px 12px", borderRadius: 10,
            background: "color-mix(in oklab, var(--neon-cyan) 14%, transparent)",
            border: "1px solid color-mix(in oklab, var(--neon-cyan) 36%, transparent)",
            display: "flex", alignItems: "center", gap: 8,
            animation: "fadeIn 220ms ease-out",
          }}>
            <Icon name="check" size={14} color="var(--neon-cyan)"/>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-1)" }}>
              OCR đã điền 8 trường từ ảnh CCCD
            </span>
          </div>
        )}

        {/* Top row — Thông tin cá nhân  |  Đăng ký & Lớp học. */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionTitle>Thông tin cá nhân</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "span 2" }}>
                <Input label="Số CCCD"        value={form.idNumber}    onChange={v => setForm({ ...form, idNumber: v })}    placeholder="079 202 155 678" mono/>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <Input label="Họ và tên"      value={form.name}        onChange={v => setForm({ ...form, name: v })}        placeholder="Nguyễn Văn A"/>
              </div>
              <Input label="Ngày sinh"        value={form.dob}         onChange={v => setForm({ ...form, dob: v })}         placeholder="dd/mm/yyyy" mono/>
              <Input label="Giới tính"        value={form.gender}      onChange={v => setForm({ ...form, gender: v })}      placeholder="Nam / Nữ"/>
              <div style={{ gridColumn: "span 2" }}>
                <Input label="Quê quán"       value={form.queQuan}     onChange={v => setForm({ ...form, queQuan: v })}     placeholder="Bến Tre"/>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <Input label="Nơi thường trú" value={form.address}     onChange={v => setForm({ ...form, address: v })}     placeholder="Số nhà, đường, phường, quận"/>
              </div>
              <Input label="Ngày cấp"         value={form.ngayCapCCCD} onChange={v => setForm({ ...form, ngayCapCCCD: v })} placeholder="dd/mm/yyyy" mono/>
              <Input label="Nơi cấp"          value={form.noiCapCCCD}  onChange={v => setForm({ ...form, noiCapCCCD: v })}  placeholder="Cục CS QLHC về TTXH"/>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionTitle>Đăng ký & Lớp học</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "span 2" }}>
                <Input label="SĐT" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="090 123 4567" mono/>
              </div>
              <Select label="Lớp" value={form.classId} onChange={v => setForm({ ...form, classId: v })}
                      placeholder={openClasses.length === 0 ? "Chưa có lớp đang mở" : "Chọn lớp đang mở"}
                      options={openClasses.map(c => ({ value: c.id, label: c.code }))}
                      note={openClasses.length === 0 ? "Không có lớp đang mở — hãy tạo lớp trước." : null}/>
              <Select label="Nhân viên" value={form.responsibleStaffId} onChange={v => setForm({ ...form, responsibleStaffId: v })}
                      placeholder="Chọn nhân viên"
                      options={D.accounts.filter(a => a.role === "staff").map(a => ({ value: a.id, label: a.name }))}/>
              <Select label="Học phí" value={form.feePlanId} onChange={v => setForm({ ...form, feePlanId: v, promotionId: "" })}
                      placeholder="Chọn gói học phí"
                      options={D.feePlans.map(f => ({ value: f.id, label: `${f.name} · ${window.fmtVND(f.amount)}` }))}/>
              <Select label="Khuyến mãi" value={form.promotionId} onChange={v => setForm({ ...form, promotionId: v })}
                      placeholder={selectedFeePlan ? "Chọn khuyến mãi" : "Chọn học phí trước"}
                      options={validPromos.map(p => ({ value: p.id, label: p.discount > 0 ? `${p.name} · −${window.fmtVND(p.discount)}` : p.name }))}/>
            </div>
            {selectedFeePlan && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10,
                            background: "var(--ink-2)", border: "1px solid var(--glass-stroke)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Tổng học phí</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--neon-lime)", fontVariantNumeric: "tabular-nums" }}>
                  {window.fmtVND(totalFee)}
                </span>
              </div>
            )}

            {/* Ghi chú — typable textarea, mirrors profile detail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Ghi chú</span>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                        placeholder="Nhập ghi chú…"
                        rows={3}
                        style={{
                          width: "100%", resize: "vertical",
                          background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
                          color: "var(--fg-1)", borderRadius: 10,
                          padding: "8px 10px",
                          fontFamily: "var(--font-ui)", fontSize: 13, lineHeight: 1.5,
                          outline: "none",
                          transition: "border-color 140ms var(--ease-out), box-shadow 140ms var(--ease-out)",
                        }}
                        onFocus={e => { e.target.style.borderColor = "var(--neon-cyan)"; e.target.style.boxShadow = "0 0 12px var(--neon-cyan-haze)"; }}
                        onBlur={e => { e.target.style.borderColor = "var(--glass-stroke)"; e.target.style.boxShadow = "none"; }}/>
            </div>
          </div>
        </div>

        {/* Bottom — Tài liệu (full width). Helper hint is inlined next
            to the heading to save vertical space. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <SectionTitle>Tài liệu</SectionTitle>
            <span style={{
              fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--neon-cyan)",
              textShadow: "0 0 6px var(--neon-cyan-haze)",
            }}>
              Chụp từ camera, chọn ảnh, copy paste, hoặc kéo thả
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {D.PROFILE_DOCS.map(doc => (
              <DocSlot key={doc.key} doc={doc} filled={docs[doc.key]}
                       onDrop={handleDocDrop}
                       onClear={(k) => setDocs({ ...docs, [k]: false })}
                       compact/>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------------
// Add Payment Modal
// --------------------------------------------------------------------
function AddPaymentModal({ open, onClose, onSave, defaultStudentId, defaultAmount }) {
  const D = window.MGT_DATA;
  const [form, setForm] = React.useState({ studentId: "", amount: "", method: "", bienLaiId: "" });
  const [bienLaiPhoto, setBienLaiPhoto] = React.useState(false);
  const [bienLaiFile, setBienLaiFile] = React.useState(null);

  React.useEffect(() => {
    if (open) setForm({
      studentId: defaultStudentId || "",
      amount: defaultAmount != null ? String(defaultAmount) : "",
      method: "", bienLaiId: "",
    });
    if (!open) { setBienLaiPhoto(false); setBienLaiFile(null); }
  }, [open, defaultStudentId, defaultAmount]);

  const student = form.studentId ? D.getStudent(form.studentId) : null;
  const amount = parseInt(form.amount.replace(/\D/g, ""), 10) || 0;
  const newPaid = student ? student.paid + amount : 0;
  const newBalance = student ? student.totalFee - newPaid : 0;
  const newStatus = student
    ? (newPaid >= student.totalFee ? "100%" : newPaid > 0 ? "50%" : "0%")
    : "—";

  return (
    <Modal open={open} onClose={onClose} width={620}
           title="Ghi nhận thanh toán"
           primaryLabel="Lưu thanh toán"
           primaryAction={() => { onSave && onSave({ ...form, amount, bienLaiPhoto, bienLaiFile }); onClose(); }}
           primaryDisabled={!form.studentId || !amount || !form.method || !form.bienLaiId}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <StudentSearchPicker label="Học viên"
                             value={form.studentId}
                             onChange={v => setForm({ ...form, studentId: v })}/>

        {student && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: 14, borderRadius: 12, background: "var(--ink-2)", border: "1px solid var(--glass-stroke)" }}>
            <MiniStat label="Tổng học phí" value={window.fmtVND(student.totalFee)}/>
            <MiniStat label="Đã thu"      value={window.fmtVND(student.paid)} color="var(--neon-lime)"/>
            <MiniStat label="Còn nợ"      value={window.fmtVND(student.balance)} color="var(--neon-pink)"/>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Số tiền" value={form.amount} onChange={v => setForm({ ...form, amount: v })} placeholder="0" mono prefix="₫"/>
          <Select label="Hình thức" value={form.method} onChange={v => setForm({ ...form, method: v })}
                  placeholder="Chọn hình thức"
                  options={[{ value: "Tiền mặt", label: "Tiền mặt" }, { value: "Chuyển khoản", label: "Chuyển khoản" }]}/>
        </div>

        <Input label="Mã biên lai" value={form.bienLaiId} onChange={v => setForm({ ...form, bienLaiId: v })} placeholder="BL-2026-…" mono/>

        <div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Ảnh biên lai (tuỳ chọn)</span>
          <div style={{ marginTop: 6 }}>
            <DocSlot doc={{ key: "bienLai", label: "Biên lai", hint: "Kéo & thả ảnh biên lai" }}
                     filled={bienLaiPhoto}
                     onDrop={(_k, file) => { setBienLaiPhoto(true); if (file) setBienLaiFile(file); }}
                     onClear={() => { setBienLaiPhoto(false); setBienLaiFile(null); }}
                     compact/>
          </div>
        </div>

        {/* Preview the auto-update */}
        {student && amount > 0 && (
          <div style={{
            padding: 14, borderRadius: 12,
            background: "color-mix(in oklab, var(--neon-lime) 6%, transparent)",
            border: "1px solid color-mix(in oklab, var(--neon-lime) 24%, transparent)",
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--neon-lime)" }}>
              Sau khi lưu — tự cập nhật
            </span>
            <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>
                Đã thu: <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-1)", fontWeight: 600 }}>{window.fmtVND(newPaid)}</span>
              </span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>
                Còn nợ: <span style={{ fontFamily: "var(--font-mono)", color: newBalance > 0 ? "var(--neon-pink)" : "var(--neon-lime)", fontWeight: 600 }}>{window.fmtVND(newBalance)}</span>
              </span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>
                Trạng thái: <PaymentPill status={newStatus}/>
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
        color: color || "var(--fg-1)", fontVariantNumeric: "tabular-nums",
      }}>{value}</span>
    </div>
  );
}

// --------------------------------------------------------------------
// StudentSearchPicker — typeable input that filters students by name /
// SĐT / Mã HV. Opens a dropdown of matches; clicking one fills the
// value. Replaces the long unwieldy dropdown the Select used to render.
// --------------------------------------------------------------------
function StudentSearchPicker({ label, value, onChange }) {
  const D = window.MGT_DATA;
  const selected = value ? D.getStudent(value) : null;
  const [query, setQuery] = React.useState("");
  const [open, setOpen]   = React.useState(false);
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    // Whenever the parent's value changes externally, sync the visible text.
    setQuery(selected ? `${selected.name} · ${selected.phone}` : "");
  }, [value]);   // eslint-disable-line

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Match against name, phone, and Mã HV — case-insensitive substring.
  const q = query.trim().toLowerCase();
  const matches = (q === "" || (selected && query === `${selected.name} · ${selected.phone}`))
    ? D.students.slice(0, 30)
    : D.students.filter(s => (s.name + " " + s.phone + " " + s.maHV).toLowerCase().includes(q)).slice(0, 30);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      <div style={{ position: "relative" }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (value) onChange(""); }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm theo tên, SĐT, Mã HV…"
          style={{
            width: "100%",
            background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
            color: "var(--fg-1)", borderRadius: 10,
            padding: "10px 36px 10px 12px",
            fontFamily: "var(--font-ui)", fontSize: 13, outline: "none",
            transition: "border-color 140ms var(--ease-out), box-shadow 140ms var(--ease-out)",
          }}
          onFocusCapture={e => { e.target.style.borderColor = "var(--neon-cyan)"; e.target.style.boxShadow = "0 0 14px var(--neon-cyan-haze)"; }}
          onBlurCapture={e => { e.target.style.borderColor = "var(--glass-stroke)"; e.target.style.boxShadow = "none"; }}/>
        <Icon name="search" size={14} color="var(--fg-3)"
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}/>
      </div>
      {open && matches.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
          maxHeight: 240, overflowY: "auto",
          background: "var(--ink-2)",
          backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
          border: "1px solid var(--glass-stroke-strong)", borderRadius: 10,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          padding: 4,
        }}>
          {matches.map(s => {
            const isActive = s.id === value;
            return (
              <button key={s.id} onClick={() => { onChange(s.id); setOpen(false); }} style={{
                display: "flex", width: "100%", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                background: isActive ? "var(--ink-3)" : "transparent",
                border: "none",
                color: "var(--fg-1)",
                transition: "background 140ms var(--ease-out)",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--ink-3)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>{s.phone} · {s.maHV}</span>
                </div>
                {isActive && <Icon name="check" size={13} color="var(--neon-cyan)"/>}
              </button>
            );
          })}
        </div>
      )}
      {open && matches.length === 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
          padding: "12px 14px",
          background: "var(--ink-2)",
          border: "1px solid var(--glass-stroke)", borderRadius: 10,
          fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)",
        }}>
          Không tìm thấy học viên phù hợp.
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------
// Add Class Modal (admin only)
//   No licence field — A & A1 students share the same class.
//   No max capacity — classes have no upper limit.
// --------------------------------------------------------------------
function AddClassModal({ open, onClose, onSave }) {
  const D = window.MGT_DATA;
  const [form, setForm] = React.useState({ code: "", openDate: "", examDate: "", branchId: "" });
  React.useEffect(() => { if (!open) setForm({ code: "", openDate: "", examDate: "", branchId: "" }); }, [open]);
  return (
    <Modal open={open} onClose={onClose} width={520}
           title="Tạo lớp mới"
           primaryLabel="Tạo lớp"
           primaryAction={() => { onSave && onSave(form); onClose(); }}
           primaryDisabled={!form.code || !form.branchId}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input label="Mã lớp" value={form.code} onChange={v => setForm({ ...form, code: v })} placeholder="MÔ TÔ 06/2026"/>
        <Select label="Chi nhánh" value={form.branchId} onChange={v => setForm({ ...form, branchId: v })}
                placeholder="Chọn chi nhánh"
                options={D.branches.map(b => ({ value: b.id, label: b.name }))}/>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Ngày mở"  value={form.openDate} onChange={v => setForm({ ...form, openDate: v })} placeholder="01/06/2026" mono/>
          <Input label="Ngày thi" value={form.examDate} onChange={v => setForm({ ...form, examDate: v })} placeholder="30/06/2026" mono/>
        </div>
      </div>
    </Modal>
  );
}

Object.assign(window, { AddStudentModal, AddPaymentModal, AddClassModal });
