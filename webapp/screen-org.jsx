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
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const isAdmin = D.currentUser?.role === "admin";

  const toggle = (id) => setSelectedId(prev => prev === id ? null : id);
  // Managers come from admin/staff accounts (any active account is eligible).
  const managerOpts = [
    { id: "", label: "— Chưa gán —" },
    ...D.accounts.filter(a => a.active !== false).map(a => ({ id: a.id, label: `${a.name} · ${a.role === "admin" ? "Admin" : "NV"}` })),
  ];
  const branchFields = [
    { id: "name",       label: "Tên chi nhánh", type: "text",   placeholder: "Chi nhánh Quận 1", fullWidth: true },
    { id: "address",    label: "Địa chỉ",       type: "text",   placeholder: "123 Lê Lợi, Q.1, TP.HCM", fullWidth: true },
    { id: "manager_id", label: "Quản lý",       type: "select", options: managerOpts, fullWidth: true },
  ];
  const editing = editingId ? D.getBranch(editingId) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {isAdmin && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
            {D.branches.length} chi nhánh
          </span>
          <Button variant="primary" size="sm" icon="plus" onClick={() => setCreateOpen(true)}>Thêm chi nhánh</Button>
        </div>
      )}
      <RecordCreatorModal open={createOpen} onClose={() => setCreateOpen(false)}
        title="Thêm chi nhánh"
        onCreate={(d) => window.MGT_DATA.api.createBranch(d).catch(e => reportWriteError(e, "Lỗi tạo chi nhánh"))}
        fields={branchFields}/>
      <EditRecordModal open={!!editing} onClose={() => setEditingId(null)}
        title="Sửa chi nhánh"
        subtitle={editing?.name}
        initialValues={editing || {}}
        fields={branchFields}
        onSave={(d) => window.MGT_DATA.api.updateBranch(editingId, d).catch(e => reportWriteError(e, "Lỗi cập nhật"))}/>
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
                  {isAdmin && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <MoreMenu items={[
                        { label: "Sửa", onClick: () => setEditingId(b.id) },
                        { label: "Xóa", danger: true, onClick: () => {
                            if (!window.confirm(`Xóa chi nhánh "${b.name}"?`)) return;
                            window.MGT_DATA.api.deleteBranch(b.id).catch(e => reportWriteError(e, "Lỗi xóa chi nhánh"));
                          }},
                      ]}/>
                    </div>
                  )}
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
  const [editingId, setEditingId] = React.useState(null);
  const [pwId, setPwId] = React.useState(null);
  const isAdmin = D.currentUser?.role === "admin";
  const branchOpts = [
    { id: "", label: "— Chọn chi nhánh —" },
    ...D.branches.map(b => ({ id: b.id, label: b.name })),
  ];
  const accountCreateFields = [
    { id: "name",     label: "Họ tên",        type: "text",   placeholder: "Nguyễn Văn A", fullWidth: true },
    { id: "phone",    label: "Số điện thoại", type: "text",   placeholder: "090 123 4567" },
    { id: "email",    label: "Email",         type: "text",   placeholder: "you@motogiathinh.vn" },
    { id: "role",     label: "Vai trò",       type: "select", options: [{ id: "staff", label: "Nhân viên" }, { id: "admin", label: "Admin" }] },
    { id: "branchId", label: "Chi nhánh",     type: "select", options: branchOpts },
    { id: "password", label: "Mật khẩu tạm thời", type: "text", placeholder: "≥10 ký tự, có chữ + số", fullWidth: true },
  ];
  // PATCH doesn't accept `password` — keep the edit form without it
  // (use Đặt lại mật khẩu instead).
  const accountEditFields = accountCreateFields.filter(f => f.id !== "password");
  const editing = editingId ? D.accounts.find(x => x.id === editingId) : null;
  const pwAccount = pwId ? D.accounts.find(x => x.id === pwId) : null;
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{D.accounts.length} tài khoản</span>
        <div style={{ flex: 1 }}></div>
        <Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Tạo tài khoản</Button>
      </div>
      <RecordCreatorModal open={open} onClose={() => setOpen(false)}
        title="Tạo tài khoản mới"
        onCreate={(d) => window.MGT_DATA.api.createAccount(d)}
        fields={accountCreateFields}/>
      <EditRecordModal open={!!editing} onClose={() => setEditingId(null)}
        title="Sửa tài khoản" subtitle={editing?.name}
        initialValues={editing || {}} fields={accountEditFields}
        onSave={(d) => window.MGT_DATA.api.updateAccount(editingId, d).catch(e => reportWriteError(e, "Lỗi cập nhật"))}/>
      <PasswordResetModal open={!!pwAccount} onClose={() => setPwId(null)}
        account={pwAccount}
        onSubmit={(pw) => window.MGT_DATA.api.resetPassword(pwId, pw).catch(e => reportWriteError(e, "Lỗi đặt lại mật khẩu"))}/>
      <div style={{
        display: "grid", gridTemplateColumns: "1.6fr 110px 1.4fr 1fr 140px 100px 40px",
        padding: "12px 22px", gap: 12, borderBottom: "1px solid var(--ink-4)",
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
      }}>
        <span>Tài khoản</span><span>Vai trò</span><span>Email</span><span>Chi nhánh</span><span>Hoạt động cuối</span><span>Trạng thái</span><span></span>
      </div>
      {D.accounts.map((a, i) => {
        const b = D.getBranch(a.branchId);
        return (
          <div key={a.id} style={{
            display: "grid", gridTemplateColumns: "1.6fr 110px 1.4fr 1fr 140px 100px 40px",
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
            <MoreMenu items={[
              { label: "Sửa", onClick: () => setEditingId(a.id), hidden: !isAdmin },
              { label: a.active ? "Vô hiệu hoá" : "Kích hoạt",
                onClick: () => window.MGT_DATA.api.updateAccount(a.id, { active: !a.active }).catch(e => reportWriteError(e, "Lỗi cập nhật")),
                hidden: !isAdmin },
              { label: "Đặt lại mật khẩu", onClick: () => setPwId(a.id), hidden: !isAdmin },
            ]}/>
          </div>
        );
      })}
    </GlassCard>
  );
}

function FeesTab() {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const isAdmin = D.currentUser?.role === "admin";
  const feeFields = [
    { id: "name",     label: "Tên gói",  type: "text",   placeholder: "A — Trọn gói" },
    { id: "licence",  label: "Bằng",     type: "select", options: [{ id: "A", label: "A" }, { id: "A1", label: "A1" }] },
    { id: "amount",   label: "Số tiền",  type: "text",   placeholder: "1995000" },
  ];
  const editing = editingId ? D.getFeePlan(editingId) : null;
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{D.feePlans.length} gói học phí</span>
        <Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Tạo gói</Button>
      </div>
      <RecordCreatorModal open={open} onClose={() => setOpen(false)}
        title="Tạo gói học phí"
        onCreate={(d) => window.MGT_DATA.api.createFeePlan(d)}
        fields={feeFields}/>
      <EditRecordModal open={!!editing} onClose={() => setEditingId(null)}
        title="Sửa gói học phí" subtitle={editing?.name}
        initialValues={editing || {}} fields={feeFields}
        onSave={(d) => window.MGT_DATA.api.updateFeePlan(editingId, d).catch(e => reportWriteError(e, "Lỗi cập nhật"))}/>
      {D.feePlans.map((f, i) => (
        <div key={f.id} style={{
          display: "grid", gridTemplateColumns: "1fr 80px 200px 40px",
          padding: "14px 22px", gap: 14, alignItems: "center",
          borderBottom: i < D.feePlans.length - 1 ? "1px solid var(--ink-4)" : "none",
        }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{f.name}</span>
          <Chip>{f.licence}</Chip>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--fg-1)",
            fontVariantNumeric: "tabular-nums",
          }}>{window.fmtVND(f.amount)}</span>
          <MoreMenu items={[
            { label: "Sửa", onClick: () => setEditingId(f.id), hidden: !isAdmin },
          ]}/>
        </div>
      ))}
    </GlassCard>
  );
}

function PromosTab() {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const isAdmin = D.currentUser?.role === "admin";
  // Edit form takes the licence array directly (the create form maps fee-
  // plan ids → distinct licences before sending — preserved for parity).
  const promoEditFields = [
    { id: "name",      label: "Tên chương trình",   type: "text",      placeholder: "Hè Vui — Giảm 200K", fullWidth: true },
    { id: "discount",  label: "Số tiền giảm (đ)",   type: "text",      placeholder: "200000",             fullWidth: true },
    { id: "appliesTo", label: "Áp dụng cho bằng",   type: "multipill", color: "lime",
      options: [{ id: "A", label: "A" }, { id: "A1", label: "A1" }] },
  ];
  const editing = editingId ? D.getPromotion(editingId) : null;
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
          return window.MGT_DATA.api.createPromotion({ ...d, appliesTo: licences });
        }}
        fields={[
          { id: "name",      label: "Tên chương trình",  type: "text",      placeholder: "Hè Vui — Giảm 200K", fullWidth: true },
          { id: "discount",  label: "Số tiền giảm (đ)",  type: "text",      placeholder: "200000",             fullWidth: true },
          { id: "appliesTo", label: "Áp dụng cho gói học phí", type: "multipill", color: "lime",
            options: D.feePlans.map(f => ({ id: f.id, label: `${f.name} · ${window.fmtVND(f.amount)}` })),
          },
        ]}/>
      <EditRecordModal open={!!editing} onClose={() => setEditingId(null)}
        title="Sửa khuyến mãi" subtitle={editing?.name}
        initialValues={editing || {}} fields={promoEditFields}
        onSave={(d) => window.MGT_DATA.api.updatePromotion(editingId, d).catch(e => reportWriteError(e, "Lỗi cập nhật"))}/>
      {D.promotions.map((p, i) => (
        <div key={p.id} style={{
          display: "grid", gridTemplateColumns: "1fr 180px 200px 40px",
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
          <MoreMenu items={[
            { label: "Sửa", onClick: () => setEditingId(p.id), hidden: !isAdmin },
          ]}/>
        </div>
      ))}
    </GlassCard>
  );
}

function TeachersTab() {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const isAdmin = D.currentUser?.role === "admin";
  const branchOpts = [
    { id: "", label: "— Chọn chi nhánh —" },
    ...D.branches.map(b => ({ id: b.id, label: b.name })),
  ];
  const teacherFields = [
    { id: "name",     label: "Họ tên",        type: "text",   placeholder: "Trần Văn B" },
    { id: "phone",    label: "Số điện thoại", type: "text",   placeholder: "09…" },
    { id: "branchId", label: "Chi nhánh",     type: "select", options: branchOpts },
  ];
  const editing = editingId ? D.teachers.find(x => x.id === editingId) : null;
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{D.teachers.length} giáo viên</span>
        <Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Thêm giáo viên</Button>
      </div>
      <RecordCreatorModal open={open} onClose={() => setOpen(false)}
        title="Thêm giáo viên"
        onCreate={(d) => window.MGT_DATA.api.createTeacher(d)}
        fields={teacherFields}/>
      <EditRecordModal open={!!editing} onClose={() => setEditingId(null)}
        title="Sửa giáo viên" subtitle={editing?.name}
        initialValues={editing || {}} fields={teacherFields}
        onSave={(d) => window.MGT_DATA.api.updateTeacher(editingId, d).catch(e => reportWriteError(e, "Lỗi cập nhật"))}/>
      <div style={{
        display: "grid", gridTemplateColumns: "1.6fr 160px 1fr 100px 40px",
        padding: "12px 22px", gap: 12, borderBottom: "1px solid var(--ink-4)",
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
      }}>
        <span>Họ tên</span><span>SĐT</span><span>Chi nhánh</span><span>Trạng thái</span><span></span>
      </div>
      {D.teachers.map((t, i) => {
        const b = D.getBranch(t.branchId);
        const active = t.active !== false;
        return (
          <div key={t.id} style={{
            display: "grid", gridTemplateColumns: "1.6fr 160px 1fr 100px 40px",
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
              background: active ? "color-mix(in oklab, var(--neon-lime) 14%, transparent)" : "var(--ink-3)",
              color: active ? "var(--neon-lime)" : "var(--fg-3)",
              border: `1px solid ${active ? "color-mix(in oklab, var(--neon-lime) 36%, transparent)" : "var(--glass-stroke)"}`,
              display: "inline-block", textAlign: "center",
            }}>{active ? "ACTIVE" : "DISABLED"}</span>
            <MoreMenu items={[
              { label: "Sửa", onClick: () => setEditingId(t.id), hidden: !isAdmin },
              { label: active ? "Vô hiệu hoá" : "Kích hoạt",
                onClick: () => window.MGT_DATA.api.updateTeacher(t.id, { active: !active }).catch(e => reportWriteError(e, "Lỗi cập nhật")),
                hidden: !isAdmin },
            ]}/>
          </div>
        );
      })}
    </GlassCard>
  );
}

function VehiclesTab() {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const isAdmin = D.currentUser?.role === "admin";
  const branchOpts = [
    { id: "", label: "— Chọn chi nhánh —" },
    ...D.branches.map(b => ({ id: b.id, label: b.name })),
  ];
  const vehicleFields = [
    { id: "name",     label: "Tên xe",   type: "text",   placeholder: "Honda Wave Alpha" },
    { id: "licence",  label: "Bằng",     type: "select", options: [{ id: "A", label: "A" }, { id: "A1", label: "A1" }] },
    { id: "plate",    label: "Biển số",  type: "text",   placeholder: "59-K1 123.45" },
    { id: "year",     label: "Năm sản xuất", type: "text", placeholder: "2024" },
    { id: "branchId", label: "Chi nhánh", type: "select", options: branchOpts },
  ];
  const editing = editingId ? D.vehicles.find(x => x.id === editingId) : null;
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{D.vehicles.length} phương tiện</span>
        <Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Thêm phương tiện</Button>
      </div>
      <RecordCreatorModal open={open} onClose={() => setOpen(false)}
        title="Thêm phương tiện"
        onCreate={(d) => window.MGT_DATA.api.createVehicle(d)}
        fields={vehicleFields}/>
      <EditRecordModal open={!!editing} onClose={() => setEditingId(null)}
        title="Sửa phương tiện" subtitle={editing?.name}
        initialValues={editing || {}} fields={vehicleFields}
        onSave={(d) => window.MGT_DATA.api.updateVehicle(editingId, d).catch(e => reportWriteError(e, "Lỗi cập nhật"))}/>
      <div style={{
        display: "grid", gridTemplateColumns: "1.4fr 80px 160px 100px 1fr 120px 40px",
        padding: "12px 22px", gap: 12, borderBottom: "1px solid var(--ink-4)",
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
      }}>
        <span>Tên xe</span><span>Bằng</span><span>Biển số</span><span>Năm</span><span>Chi nhánh</span><span>Trạng thái</span><span></span>
      </div>
      {D.vehicles.map((v, i) => {
        const b = D.getBranch(v.branchId);
        return (
          <div key={v.id} style={{
            display: "grid", gridTemplateColumns: "1.4fr 80px 160px 100px 1fr 120px 40px",
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
            <MoreMenu items={[
              { label: "Sửa", onClick: () => setEditingId(v.id), hidden: !isAdmin },
            ]}/>
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

// --------------------------------------------------------------------
// MoreMenu — small popover triggered by the ··· icon button on a row.
// `items` is an array of { label, onClick, danger?, hidden? }. Click-
// outside closes the panel. Uses fixed positioning so it escapes the
// row's overflow clip.
// --------------------------------------------------------------------
function MoreMenu({ items, stopPropagation = true }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const btnRef = React.useRef(null);
  const panelRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", onDoc); window.removeEventListener("scroll", onScroll, true); };
  }, [open]);
  const visible = (items || []).filter(it => !it.hidden);
  if (!visible.length) return null;
  const onToggle = (e) => {
    if (stopPropagation) e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // Anchor right-edge of menu to right-edge of trigger.
      setPos({ top: r.bottom + 4, left: Math.max(8, r.right - 180) });
    }
    setOpen(o => !o);
  };
  return (
    <>
      <button ref={btnRef} onClick={onToggle} aria-label="Tác vụ"
        style={{
          width: 28, height: 28, borderRadius: 8, cursor: "pointer",
          background: "transparent", border: "1px solid var(--glass-stroke)",
          color: "var(--fg-3)", display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "all 140ms var(--ease-out)",
        }}>
        <Icon name="more" size={14}/>
      </button>
      {open && ReactDOM.createPortal(
        <div ref={panelRef} onClick={e => e.stopPropagation()} style={{
          position: "fixed", top: pos.top, left: pos.left, zIndex: 1100,
          minWidth: 180, padding: 6, borderRadius: 12,
          background: "var(--glass-3)", border: "1px solid var(--glass-stroke-strong)",
          boxShadow: "var(--shadow-3)",
          backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
          display: "flex", flexDirection: "column",
        }}>
          {visible.map((it, i) => (
            <button key={i} onClick={() => { setOpen(false); it.onClick && it.onClick(); }}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                padding: "8px 10px", borderRadius: 8, textAlign: "left",
                fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500,
                color: it.danger ? "var(--neon-pink)" : "var(--fg-1)",
                transition: "background 120ms var(--ease-out)",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--glass-2)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {it.label}
            </button>
          ))}
        </div>, document.body)}
    </>
  );
}

// --------------------------------------------------------------------
// EditRecordModal — slim wrapper around the RecordCreatorModal field
// renderer, but seeded from `initialValues` and emitting onSave(patch).
// Used by every "Sửa" action across the Tổ chức tabs.
// --------------------------------------------------------------------
function EditRecordModal({ open, onClose, title, subtitle, fields, initialValues, onSave }) {
  const buildSeed = () => {
    const seed = {};
    for (const f of fields || []) {
      const v = initialValues?.[f.id];
      seed[f.id] = v != null ? v
                 : f.type === "select"   ? (f.options?.[0]?.id ?? "")
                 : f.type === "multipill" ? []
                 : "";
    }
    return seed;
  };
  const [draft, setDraft] = React.useState(buildSeed);
  React.useEffect(() => { if (open) setDraft(buildSeed()); }, [open, initialValues]);  // eslint-disable-line
  const set = (id, v) => setDraft(prev => ({ ...prev, [id]: v }));
  const submit = () => { onSave && onSave(draft); onClose(); };
  const useGrid = (fields || []).length >= 4;
  return (
    <Modal open={open} onClose={onClose}
           title={title} subtitle={subtitle}
           primaryAction={submit} primaryLabel="Lưu thay đổi" primaryIcon="check"
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

// --------------------------------------------------------------------
// PasswordResetModal — admin-only prompt for resetting an account's
// password. Single password field; sends POST /accounts/:id/reset-password.
// --------------------------------------------------------------------
function PasswordResetModal({ open, onClose, account, onSubmit }) {
  const [pw, setPw] = React.useState("");
  React.useEffect(() => { if (open) setPw(""); }, [open]);
  return (
    <Modal open={open} onClose={onClose}
           title="Đặt lại mật khẩu"
           subtitle={account ? `Cho ${account.name} · ${account.email}` : ""}
           primaryAction={() => { onSubmit && onSubmit(pw); onClose(); }}
           primaryLabel="Đặt lại" primaryIcon="check" width={420}
           primaryDisabled={(pw || "").length < 10}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Input label="Mật khẩu mới (≥ 10 ký tự)" value={pw} onChange={setPw} placeholder="••••••••••"/>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Người dùng sẽ phải đăng nhập lại bằng mật khẩu này.
        </span>
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------------
// Helper — unified error toast for write failures. Surfaces a friendly
// Vietnamese message; falls back to the raw error.message for unknown
// codes. Called by every MoreMenu action.
// --------------------------------------------------------------------
function reportWriteError(e, fallback = "Lỗi") {
  const msg = String(e?.message || e || "");
  let friendly = fallback;
  if (/branch_in_use/.test(msg)) friendly = "Không thể xóa: chi nhánh đang có lớp, học viên hoặc nhân viên.";
  else if (/in_use|in use|FK|FOREIGN/i.test(msg)) friendly = "Không thể xóa: bản ghi đang được tham chiếu.";
  else if (/password_too_short|password_too|password_weak/.test(msg)) friendly = "Mật khẩu chưa đạt yêu cầu (≥ 10 ký tự, có chữ và số).";
  else if (/forbidden|admin_only|requireAdmin/i.test(msg)) friendly = "Chỉ admin mới thực hiện được thao tác này.";
  else friendly = fallback + ": " + msg;
  alert(friendly);
}

Object.assign(window, {
  OrganizationScreen, BranchesTab, AccountsTab, FeesTab, PromosTab,
  TeachersTab, VehiclesTab, ActivityTab, RecordCreatorModal,
  MoreMenu, EditRecordModal, PasswordResetModal,
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
  const [busy, setBusy]   = React.useState(false);
  const [err, setErr]     = React.useState(null);
  React.useEffect(() => { if (open) { setDraft(buildSeed()); setBusy(false); setErr(null); } }, [open]);  // eslint-disable-line

  const set = (id, v) => setDraft(prev => ({ ...prev, [id]: v }));
  // Await the onCreate promise; only close on success so failure alerts
  // surface inline rather than after the dialog has already vanished.
  const submit = async () => {
    try {
      setBusy(true); setErr(null);
      await onCreate?.(draft);
      onClose();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  // Pair text fields into a 2-col grid when there are 4+ fields, so the
  // dialog visually matches the sectioned grids in AddStudent/AddClass.
  const useGrid = (fields || []).length >= 4;

  return (
    <Modal open={open} onClose={onClose}
           title={title}
           subtitle={subtitle}
           primaryAction={submit}
           primaryLabel={busy ? "Đang tạo…" : "Tạo mới"}
           primaryIcon="plus"
           primaryDisabled={busy}
           footerStart={err ? (
             <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-pink)" }}>
               Lỗi: {err}
             </span>
           ) : null}
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
