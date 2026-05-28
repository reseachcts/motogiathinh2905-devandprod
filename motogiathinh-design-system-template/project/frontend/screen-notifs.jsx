// ====================================================================
// Notifications — outstanding cases, bulk actions
// ====================================================================

function NotificationsScreen({ onOpenStudent }) {
  const D = window.MGT_DATA;
  const [items, setItems] = React.useState(D.notifications);
  const [selected, setSelected] = React.useState(new Set());

  const unread = items.filter(i => !i.read).length;

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const selectAll = () => {
    setSelected(selected.size === items.length ? new Set() : new Set(items.map(i => i.id)));
  };
  const markAllRead = () => setItems(items.map(i => ({ ...i, read: true })));
  const deleteSelected = () => {
    setItems(items.filter(i => !selected.has(i.id)));
    setSelected(new Set());
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <SmallStat label="Chưa đọc" value={unread} color="pink"/>
        <SmallStat label="Thanh toán trễ" value={items.filter(i => i.type === "payment").length} color="amber"/>
        <SmallStat label="Hồ sơ thiếu"     value={items.filter(i => i.type === "doc").length}     color="cyan"/>
        <SmallStat label="Lớp sắp đóng"    value={items.filter(i => i.type === "class").length}   color="violet"/>
      </div>

      <GlassCard padding={0}>
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={selectAll}
                   style={{ width: 16, height: 16, accentColor: "var(--neon-cyan)" }}/>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {selected.size > 0 ? `${selected.size} đã chọn` : "Chọn tất cả"}
            </span>
          </label>
          <div style={{ flex: 1 }}></div>
          {selected.size > 0 && <Button variant="ghost" size="sm" icon="x" onClick={deleteSelected}>Xóa đã chọn</Button>}
          <Button variant="secondary" size="sm" icon="check" onClick={markAllRead}>Đánh dấu đã đọc</Button>
        </div>

        {items.map((n, i) => (
          <NotificationRow key={n.id} n={n} selected={selected.has(n.id)} onToggle={() => toggle(n.id)}
                           onOpenStudent={onOpenStudent}
                           last={i === items.length - 1}/>
        ))}

        {items.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--fg-3)", fontFamily: "var(--font-ui)", fontSize: 14 }}>
            Không có thông báo nào. Tất cả mọi việc đều đang ổn.
          </div>
        )}
      </GlassCard>
    </div>
  );
}

const SEVERITY = {
  info:  { c: "var(--neon-cyan)",  g: "var(--neon-cyan-glow)" },
  warn:  { c: "var(--neon-amber)", g: "var(--neon-amber-glow)" },
  error: { c: "var(--neon-pink)",  g: "var(--neon-pink-glow)" },
};
const NTYPE_ICON = { payment: "wallet", doc: "users", class: "calendar", system: "settings" };

function NotificationRow({ n, selected, onToggle, onOpenStudent, last }) {
  const s = SEVERITY[n.severity] || SEVERITY.info;
  return (
    <div style={{
      display: "flex", gap: 14, padding: "16px 22px",
      borderBottom: last ? "none" : "1px solid var(--ink-4)",
      background: n.read ? "transparent" : "color-mix(in oklab, var(--neon-cyan) 4%, transparent)",
      cursor: n.studentId ? "pointer" : "default",
      transition: "background 140ms var(--ease-out)",
    }}
    onClick={() => n.studentId && onOpenStudent(n.studentId)}>
      <input type="checkbox" checked={selected} onChange={(e) => { e.stopPropagation(); onToggle(); }} onClick={(e) => e.stopPropagation()}
             style={{ width: 16, height: 16, accentColor: "var(--neon-cyan)", marginTop: 2 }}/>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `color-mix(in oklab, ${s.c} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${s.c} 30%, transparent)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon name={NTYPE_ICON[n.type] || "bell"} size={16} color={s.c} style={{ filter: `drop-shadow(0 0 6px ${s.g})` }}/>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{n.title}</span>
          {!n.read && <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--neon-cyan)", boxShadow: "0 0 8px var(--neon-cyan-glow)" }}></span>}
        </div>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5 }}>{n.detail}</span>
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", whiteSpace: "nowrap", alignSelf: "flex-start", marginTop: 4 }}>{n.createdAt}</span>
    </div>
  );
}

function SmallStat({ label, value, color = "cyan" }) {
  const c = `var(--neon-${color})`;
  return (
    <GlassCard padding={16}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
        <span style={{
          fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 28, lineHeight: 1,
          color: c, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
        }}>{value}</span>
      </div>
    </GlassCard>
  );
}

Object.assign(window, { NotificationsScreen, NotificationRow, SmallStat });
