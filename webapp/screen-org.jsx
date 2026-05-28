// ====================================================================
// Tổ chức — chi nhánh / tài khoản / học phí / khuyến mãi /
//             giáo viên / phương tiện / nhật ký
// ====================================================================

function OrganizationScreen({ onOpenClass }) {
  const D = window.MGT_DATA;
  const [tab, setTab] = React.useState("branches");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PillTabs value={tab} onChange={setTab} tabs={[
        { id: "branches", label: "Chi nhánh",  count: D.branches.length },
        { id: "accounts", label: "Tài khoản",  count: D.accounts.length },
        { id: "fees",     label: "Học phí",    count: D.feePlans.length },
        { id: "promos",   label: "Khuyến mãi", count: D.promotions.length },
        { id: "teachers", label: "Giáo viên",  count: D.teachers.length },
        { id: "vehicles", label: "Phương tiện",count: D.vehicles.length },
        { id: "activity", label: "Lịch sử",    count: D.activityLog.length },
      ]}/>

      {tab === "branches" && <BranchesTab onOpenClass={onOpenClass}/>}
      {tab === "accounts" && <AccountsTab/>}
      {tab === "fees"     && <FeesTab/>}
      {tab === "promos"   && <PromosTab/>}
      {tab === "teachers" && <TeachersTab/>}
      {tab === "vehicles" && <VehiclesTab/>}
      {tab === "activity" && <ActivityTab/>}
    </div>
  );
}

function BranchesTab({ onOpenClass }) {
  const D = window.MGT_DATA;
  const branchTones = window.useBranchTones();   // single hook call — index per branch below
  const [selectedId, setSelectedId] = React.useState(null);

  const toggle = (id) => setSelectedId(prev => prev === id ? null : id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {D.branches.map(b => {
          // Use index maps — O(1) per branch instead of three full scans.
          const branchStaff   = D.accounts.filter(a => a.branchId === b.id && a.role === "staff");
          const branchStudents = D._indexes.studentsByBranchId.get(b.id) || [];
          const branchPayments = D._indexes.paymentsByBranchId.get(b.id) || [];
          const staffCount = branchStaff.length;
          const studentCount = branchStudents.length;
          let revenue = 0;
          for (const p of branchPayments) revenue += p.amount;
          const isSelected = selectedId === b.id;
          const tone = branchTones[b.id]?.tones[0] || "var(--neon-cyan)";
          return (
            <GlassCard key={b.id} padding={22}
                       onClick={() => toggle(b.id)}
                       style={{
                         cursor: "pointer",
                         transition: "all 220ms var(--ease-out)",
                         borderColor: isSelected ? tone : "var(--glass-stroke)",
                         boxShadow: isSelected
                           ? `0 0 0 1px ${tone}, 0 0 28px color-mix(in oklab, ${tone} 42%, transparent), var(--shadow-2)`
                           : `0 0 18px color-mix(in oklab, ${tone} 14%, transparent), var(--shadow-2)`,
                         background: `linear-gradient(135deg, color-mix(in oklab, ${tone} 9%, transparent), transparent 70%), var(--glass-2)`,
                         transform: isSelected ? "translateY(-2px)" : "none",
                       }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 55%, var(--ink-0)))`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 0 16px color-mix(in oklab, ${tone} 52%, transparent)`,
                  }}>
                    <Icon name="home" size={20} color="var(--ink-0)"/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{b.name}</h3>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)" }}>{b.address}</span>
                  </div>
                </div>

                <Divider/>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <MicroStat label="Nhân viên" value={staffCount}/>
                  <MicroStat label="Học viên"  value={studentCount}/>
                  <MicroStat label="Doanh thu" value={window.fmtVND(revenue)} mono color="var(--neon-lime)"/>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
                  {(() => {
                    const mgr = D.getStaff(b.manager_id);
                    const mgrName = mgr?.name || "—";
                    return (
                      <>
                        <Avatar name={mgrName} size={26}/>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Quản lý</span>
                          <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "var(--fg-1)" }}>{mgrName}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {selectedId && <BranchExpanded branchId={selectedId} onClose={() => setSelectedId(null)} onOpenClass={onOpenClass}/>}
    </div>
  );
}

// Expanded detail card — appears under the 3 branch cards on click.
// Subtle roll-down animation, content swaps in-place when selection changes.
function BranchExpanded({ branchId, onClose, onOpenClass }) {
  const D = window.MGT_DATA;
  const tone = window.useBranchTone(branchId);
  const b = D.getBranch(branchId);
  const branchStaff   = D.accounts.filter(a => a.branchId === branchId && a.role === "staff");
  const branchClasses = D.classes.filter(c => c.branchId === branchId);
  // Parse dd/mm/yyyy → ms so the sort respects calendar order.
  const dateMs = (s) => {
    if (!s) return 0;
    const [d, m, y] = s.split("/").map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  const sortedClasses = branchClasses.slice().sort((a, c) => dateMs(c.openDate) - dateMs(a.openDate));

  // Compute total revenue per class
  const classWithRevenue = sortedClasses.map(cls => {
    const studentsInClass = D.studentsInClass(cls.id);
    const studentIds = new Set(studentsInClass.map(s => s.id));
    const revenue = D.payments.filter(p => studentIds.has(p.studentId)).reduce((acc, p) => acc + p.amount, 0);
    return { cls, count: studentsInClass.length, revenue };
  });

  return (
    <div key={branchId} style={{ animation: "mgt-roll-down 280ms var(--ease-out)" }}>
      <style>{`
        @keyframes mgt-roll-down {
          from { opacity: 0; transform: translateY(-8px) scaleY(0.96); transform-origin: top; max-height: 0; }
          to   { opacity: 1; transform: translateY(0) scaleY(1); max-height: 2000px; }
        }
      `}</style>
      <GlassCard padding={26}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 8, height: 28, borderRadius: 2,
              background: tone,
              boxShadow: `0 0 12px color-mix(in oklab, ${tone} 60%, transparent)`,
            }}/>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{b.name}</h3>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-3)" }}>{b.address} · Quản lý: {D.getStaff(b.manager_id)?.name || "—"}</span>
            </div>
            <Button variant="ghost" size="sm" icon="x" onClick={onClose}>Đóng</Button>
          </div>

          {/* Staff cards */}
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {branchStaff.map(s => (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 12,
                  background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
                }}>
                  <Avatar name={s.name} size={28}/>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.email}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Classes list */}
          <div>
            <div style={{
              display: "grid", gridTemplateColumns: "1.6fr 130px 130px 90px 130px 140px",
              padding: "10px 14px", gap: 12, borderBottom: "1px solid var(--ink-4)",
              fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
            }}>
              <span>Mã lớp</span><span>Ngày mở</span><span>Ngày thi</span><span>Sĩ số</span><span>Trạng thái</span><span style={{ textAlign: "right" }}>Doanh thu</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {classWithRevenue.map((row, i) => (
                <div key={row.cls.id}
                     onClick={() => onOpenClass && onOpenClass(row.cls.id)}
                     style={{
                       display: "grid", gridTemplateColumns: "1.6fr 130px 130px 90px 130px 140px",
                       padding: "12px 14px", gap: 12, alignItems: "center",
                       borderBottom: i < classWithRevenue.length - 1 ? "1px solid var(--ink-4)" : "none",
                       cursor: onOpenClass ? "pointer" : "default",
                       transition: "background 140ms var(--ease-out)",
                     }}
                     onMouseEnter={e => { if (onOpenClass) e.currentTarget.style.background = "var(--glass-2)"; }}
                     onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)" }}>{row.cls.code}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{row.cls.openDate}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{row.cls.examDate}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)", fontVariantNumeric: "tabular-nums" }}>{row.count}</span>
                  <ClassStatusPill status={row.cls.status}/>
                  <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--neon-lime)", fontVariantNumeric: "tabular-nums" }}>{window.fmtVND(row.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function AccountsTab() {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  const branchOpts = [
    { id: "", label: "— Chọn chi nhánh —" },
    ...D.branches.map(b => ({ id: b.id, label: b.name })),
  ];
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{D.accounts.length} tài khoản</span>
        <div style={{ flex: 1 }}></div>
        <Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Tạo tài khoản</Button>
      </div>
      <RecordCreatorModal open={open} onClose={() => setOpen(false)}
        title="Tạo tài khoản mới"
        onCreate={(d) => window.MGT_DATA.api.createAccount(d).catch(e => alert("Lỗi: " + e.message))}
        fields={[
          { id: "name",     label: "Họ tên",        type: "text",   placeholder: "Nguyễn Văn A", fullWidth: true },
          { id: "phone",    label: "Số điện thoại", type: "text",   placeholder: "090 123 4567" },
          { id: "email",    label: "Email",         type: "text",   placeholder: "you@motogiathinh.vn" },
          { id: "role",     label: "Vai trò",       type: "select", options: [{ id: "staff", label: "Nhân viên" }, { id: "admin", label: "Admin" }] },
          { id: "branchId", label: "Chi nhánh",     type: "select", options: branchOpts },
        ]}/>
      <div style={{
        display: "grid", gridTemplateColumns: "1.6fr 110px 1.4fr 1fr 140px 100px",
        padding: "12px 22px", gap: 12, borderBottom: "1px solid var(--ink-4)",
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
      }}>
        <span>Tài khoản</span><span>Vai trò</span><span>Email</span><span>Chi nhánh</span><span>Hoạt động cuối</span><span>Trạng thái</span>
      </div>
      {D.accounts.map((a, i) => {
        const b = D.getBranch(a.branchId);
        return (
          <div key={a.id} style={{
            display: "grid", gridTemplateColumns: "1.6fr 110px 1.4fr 1fr 140px 100px",
            padding: "14px 22px", gap: 12, alignItems: "center",
            borderBottom: i < D.accounts.length - 1 ? "1px solid var(--ink-4)" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={a.name} size={30}/>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)" }}>{a.name}</span>
            </div>
            <Chip color={a.role === "admin" ? "var(--neon-violet)" : "var(--fg-1)"}>
              {a.role === "admin" ? "Admin" : "Nhân viên"}
            </Chip>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>{a.email}</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>{b ? b.name : "—"}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>{a.lastActive}</span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
              padding: "3px 8px", borderRadius: 999,
              background: a.active ? "color-mix(in oklab, var(--neon-lime) 14%, transparent)" : "var(--ink-3)",
              color: a.active ? "var(--neon-lime)" : "var(--fg-3)",
              border: `1px solid ${a.active ? "color-mix(in oklab, var(--neon-lime) 36%, transparent)" : "var(--glass-stroke)"}`,
              display: "inline-block", textAlign: "center",
            }}>{a.active ? "ACTIVE" : "DISABLED"}</span>
          </div>
        );
      })}
    </GlassCard>
  );
}

function FeesTab() {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{D.feePlans.length} gói học phí</span>
        <Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Tạo gói</Button>
      </div>
      <RecordCreatorModal open={open} onClose={() => setOpen(false)}
        title="Tạo gói học phí"
        onCreate={(d) => window.MGT_DATA.api.createFeePlan(d).catch(e => alert("Lỗi: " + e.message))}
        fields={[
          { id: "name",     label: "Tên gói",  type: "text",   placeholder: "A — Trọn gói" },
          { id: "licence",  label: "Bằng",     type: "select", options: [{ id: "A", label: "A" }, { id: "A1", label: "A1" }] },
          { id: "amount",   label: "Số tiền",  type: "text",   placeholder: "1995000" },
        ]}/>
      {D.feePlans.map((f, i) => (
        <div key={f.id} style={{
          display: "grid", gridTemplateColumns: "1fr 80px 200px 30px",
          padding: "14px 22px", gap: 14, alignItems: "center",
          borderBottom: i < D.feePlans.length - 1 ? "1px solid var(--ink-4)" : "none",
        }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{f.name}</span>
          <Chip>{f.licence}</Chip>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--fg-1)",
            fontVariantNumeric: "tabular-nums",
          }}>{window.fmtVND(f.amount)}</span>
          <Icon name="more" size={16} color="var(--fg-3)"/>
        </div>
      ))}
    </GlassCard>
  );
}

function PromosTab() {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{D.promotions.length} khuyến mãi</span>
        <Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Tạo khuyến mãi</Button>
      </div>
      <RecordCreatorModal open={open} onClose={() => setOpen(false)}
        title="Tạo khuyến mãi"
        onCreate={(d) => {
          // multipill option ids are fee-plan ids; spec stores licences (A/A1).
          // Resolve fee-plan ids → distinct licences before sending.
          const licences = Array.from(new Set(
            (d.appliesTo || []).map(id => D.getFeePlan(id)?.licence).filter(Boolean)
          ));
          window.MGT_DATA.api.createPromotion({ ...d, appliesTo: licences })
            .catch(e => alert("Lỗi: " + e.message));
        }}
        fields={[
          { id: "name",      label: "Tên chương trình",  type: "text",      placeholder: "Hè Vui — Giảm 200K", fullWidth: true },
          { id: "discount",  label: "Số tiền giảm (đ)",  type: "text",      placeholder: "200000",             fullWidth: true },
          { id: "appliesTo", label: "Áp dụng cho gói học phí", type: "multipill", color: "lime",
            options: D.feePlans.map(f => ({ id: f.id, label: `${f.name} · ${window.fmtVND(f.amount)}` })),
          },
        ]}/>
      {D.promotions.map((p, i) => (
        <div key={p.id} style={{
          display: "grid", gridTemplateColumns: "1fr 180px 200px 30px",
          padding: "14px 22px", gap: 14, alignItems: "center",
          borderBottom: i < D.promotions.length - 1 ? "1px solid var(--ink-4)" : "none",
        }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{p.name}</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {p.appliesTo.map(a => <Chip key={a}>{a}</Chip>)}
          </div>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700,
            color: p.discount > 0 ? "var(--neon-lime)" : "var(--fg-3)",
            fontVariantNumeric: "tabular-nums",
          }}>{p.discount > 0 ? `−${window.fmtVND(p.discount)}` : window.fmtVND(0)}</span>
          <Icon name="more" size={16} color="var(--fg-3)"/>
        </div>
      ))}
    </GlassCard>
  );
}

function TeachersTab() {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  const branchOpts = [
    { id: "", label: "— Chọn chi nhánh —" },
    ...D.branches.map(b => ({ id: b.id, label: b.name })),
  ];
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{D.teachers.length} giáo viên</span>
        <Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Thêm giáo viên</Button>
      </div>
      <RecordCreatorModal open={open} onClose={() => setOpen(false)}
        title="Thêm giáo viên"
        onCreate={(d) => window.MGT_DATA.api.createTeacher(d).catch(e => alert("Lỗi: " + e.message))}
        fields={[
          { id: "name",     label: "Họ tên",        type: "text",   placeholder: "Trần Văn B" },
          { id: "phone",    label: "Số điện thoại", type: "text",   placeholder: "09…" },
          { id: "branchId", label: "Chi nhánh",     type: "select", options: branchOpts },
        ]}/>
      <div style={{
        display: "grid", gridTemplateColumns: "1.6fr 160px 1fr 100px",
        padding: "12px 22px", gap: 12, borderBottom: "1px solid var(--ink-4)",
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
      }}>
        <span>Họ tên</span><span>SĐT</span><span>Chi nhánh</span><span>Trạng thái</span>
      </div>
      {D.teachers.map((t, i) => {
        const b = D.getBranch(t.branchId);
        return (
          <div key={t.id} style={{
            display: "grid", gridTemplateColumns: "1.6fr 160px 1fr 100px",
            padding: "14px 22px", gap: 12, alignItems: "center",
            borderBottom: i < D.teachers.length - 1 ? "1px solid var(--ink-4)" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={t.name} size={32}/>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{t.name}</span>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{t.phone}</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>{b ? b.name : "—"}</span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
              padding: "3px 8px", borderRadius: 999,
              background: "color-mix(in oklab, var(--neon-lime) 14%, transparent)",
              color: "var(--neon-lime)",
              border: "1px solid color-mix(in oklab, var(--neon-lime) 36%, transparent)",
              display: "inline-block", textAlign: "center",
            }}>ACTIVE</span>
          </div>
        );
      })}
    </GlassCard>
  );
}

function VehiclesTab() {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  const branchOpts = [
    { id: "", label: "— Chọn chi nhánh —" },
    ...D.branches.map(b => ({ id: b.id, label: b.name })),
  ];
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{D.vehicles.length} phương tiện</span>
        <Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Thêm phương tiện</Button>
      </div>
      <RecordCreatorModal open={open} onClose={() => setOpen(false)}
        title="Thêm phương tiện"
        onCreate={(d) => window.MGT_DATA.api.createVehicle(d).catch(e => alert("Lỗi: " + e.message))}
        fields={[
          { id: "name",     label: "Tên xe",   type: "text",   placeholder: "Honda Wave Alpha" },
          { id: "licence",  label: "Bằng",     type: "select", options: [{ id: "A", label: "A" }, { id: "A1", label: "A1" }] },
          { id: "plate",    label: "Biển số",  type: "text",   placeholder: "59-K1 123.45" },
          { id: "year",     label: "Năm sản xuất", type: "text", placeholder: "2024" },
          { id: "branchId", label: "Chi nhánh", type: "select", options: branchOpts },
        ]}/>
      <div style={{
        display: "grid", gridTemplateColumns: "1.4fr 80px 160px 100px 1fr 120px",
        padding: "12px 22px", gap: 12, borderBottom: "1px solid var(--ink-4)",
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
      }}>
        <span>Tên xe</span><span>Bằng</span><span>Biển số</span><span>Năm</span><span>Chi nhánh</span><span>Trạng thái</span>
      </div>
      {D.vehicles.map((v, i) => {
        const b = D.getBranch(v.branchId);
        return (
          <div key={v.id} style={{
            display: "grid", gridTemplateColumns: "1.4fr 80px 160px 100px 1fr 120px",
            padding: "14px 22px", gap: 12, alignItems: "center",
            borderBottom: i < D.vehicles.length - 1 ? "1px solid var(--ink-4)" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "color-mix(in oklab, var(--neon-cyan) 14%, transparent)",
                border: "1px solid color-mix(in oklab, var(--neon-cyan) 30%, transparent)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name="bike" size={16} color="var(--neon-cyan)" style={{ filter: "drop-shadow(0 0 4px var(--neon-cyan-glow))" }}/>
              </div>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{v.name}</span>
            </div>
            <Chip>{v.licence}</Chip>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-1)", fontVariantNumeric: "tabular-nums" }}>{v.plate}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{v.year}</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>{b ? b.name : "—"}</span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
              padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap",
              background: "color-mix(in oklab, var(--neon-lime) 14%, transparent)",
              color: "var(--neon-lime)",
              border: "1px solid color-mix(in oklab, var(--neon-lime) 36%, transparent)",
              display: "inline-block", textAlign: "center",
            }}>HOẠT ĐỘNG</span>
          </div>
        );
      })}
    </GlassCard>
  );
}

function ActivityTab() {
  const D = window.MGT_DATA;
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>Nhật ký hoạt động</span>
      </div>
      {D.activityLog.map((log, i) => {
        const user = D.getStaff(log.userId);
        return (
          <div key={log.id} style={{
            display: "grid", gridTemplateColumns: "120px 1fr 1.6fr 1fr",
            padding: "14px 22px", gap: 14, alignItems: "center",
            borderBottom: i < D.activityLog.length - 1 ? "1px solid var(--ink-4)" : "none",
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>{log.at}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={user.name} size={24}/>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-1)" }}>{user.name}</span>
            </div>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-2)" }}>
              <span style={{ color: "var(--neon-cyan)" }}>{log.action}</span> · {log.target}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{user.role === "admin" ? "Admin" : "Nhân viên"}</span>
          </div>
        );
      })}
    </GlassCard>
  );
}

function MicroStat({ label, value, mono, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      <span style={{ fontFamily: mono ? "var(--font-mono)" : "var(--font-display)", fontSize: 18, fontWeight: 600, color: color || "var(--fg-1)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.015em" }}>{value}</span>
    </div>
  );
}

Object.assign(window, {
  OrganizationScreen, BranchesTab, AccountsTab, FeesTab, PromosTab,
  TeachersTab, VehiclesTab, ActivityTab, RecordCreatorModal,
});

// --------------------------------------------------------------------
// RecordCreatorModal — shared modal used by every "+ Tạo / Thêm" button
// on the Tổ chức page. Renders a list of fields (text or select) and
// emits the resulting object via onCreate (visual-only — we don't mutate
// MGT_DATA in this prototype).
// --------------------------------------------------------------------
function RecordCreatorModal({ open, onClose, title, subtitle, fields, onCreate }) {
  // Build a draft seeded with the option `id` for any select, "" for text,
  // and [] for multipill (multi-select pills).
  const buildSeed = () => {
    const seed = {};
    for (const f of fields || []) {
      seed[f.id] = f.type === "select"   ? (f.options?.[0]?.id ?? "")
                : f.type === "multipill" ? []
                : "";
    }
    return seed;
  };
  const [draft, setDraft] = React.useState(buildSeed);
  React.useEffect(() => { if (open) setDraft(buildSeed()); }, [open]);  // eslint-disable-line

  const set = (id, v) => setDraft(prev => ({ ...prev, [id]: v }));
  const submit = () => { onCreate && onCreate(draft); onClose(); };

  // Pair text fields into a 2-col grid when there are 4+ fields, so the
  // dialog visually matches the sectioned grids in AddStudent/AddClass.
  const useGrid = (fields || []).length >= 4;

  return (
    <Modal open={open} onClose={onClose}
           title={title}
           subtitle={subtitle}
           primaryAction={submit}
           primaryLabel="Tạo mới"
           primaryIcon="plus"
           width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h4 style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>
          Thông tin
        </h4>
        <div style={{
          display: useGrid ? "grid" : "flex",
          gridTemplateColumns: useGrid ? "1fr 1fr" : undefined,
          flexDirection: useGrid ? undefined : "column",
          gap: 12,
        }}>
          {(fields || []).map((f) => {
            // multipill rows always span the full width — pills wrap naturally.
            const span = f.fullWidth || f.type === "multipill" ? 2 : 1;
            const node = f.type === "select"
              ? <Select label={f.label} value={draft[f.id]}
                        onChange={(v) => set(f.id, v)}
                        placeholder={f.placeholder || "Chọn…"}
                        options={(f.options || []).map(o => ({ value: o.id, label: o.label }))}/>
              : f.type === "multipill"
              ? <MultiPillFieldInline label={f.label} values={draft[f.id]}
                                       options={f.options}
                                       onChange={(v) => set(f.id, v)}
                                       color={f.color || "cyan"}/>
              : <Input  label={f.label} value={draft[f.id]}
                        onChange={(v) => set(f.id, v)} placeholder={f.placeholder}/>;
            return (
              <div key={f.id} style={{ gridColumn: useGrid && span === 2 ? "span 2" : "auto" }}>
                {node}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// MultiPillFieldInline — local helper for RecordCreatorModal's multipill
// type. Renders a label + a row of selectable pills. `values` is an array
// of selected ids; each pill toggles its membership on click.
function MultiPillFieldInline({ label, values = [], options, onChange, color = "cyan" }) {
  const c = `var(--neon-${color})`;
  const isOn = (id) => values.includes(id);
  const toggle = (id) => onChange(isOn(id) ? values.filter(v => v !== id) : [...values, id]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(options || []).map(o => {
          const active = isOn(o.id);
          return (
            <button key={o.id} onClick={() => toggle(o.id)} style={{
              // Matches the `ChipButton` pill primitive used in
              // FloatingFilterPanel for visual consistency.
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 11px", borderRadius: 999,
              background: active ? `color-mix(in oklab, ${c} 14%, transparent)` : "var(--ink-2)",
              border: `1px solid ${active ? c : "var(--glass-stroke)"}`,
              boxShadow: active ? `0 0 12px color-mix(in oklab, ${c} 40%, transparent)` : "none",
              color: active ? "var(--fg-1)" : "var(--fg-2)",
              fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap",
              transition: "all 140ms var(--ease-out)",
            }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}
