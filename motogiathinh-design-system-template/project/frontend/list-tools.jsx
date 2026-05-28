// ====================================================================
// List tools — shared toolbar + paginator + sort hook used by the
// students / payments / classes list screens.
//
// - <ListToolbar> : sticky bar with a "Lọc" button + inline quick-filter
//   chips on the left, sort-by + direction toggle on the right.
// - <Paginator>   : floating bottom-right card with page-size dropdown,
//   typeable page number, and double-arrow first/prev/next/last.
// - useListView() : owns sort/dir/page/pageSize state and returns the
//   sliced/sorted rows. Default sort is the "Thời điểm" field, desc.
// ====================================================================

// --------------------------------------------------------------------
// useListView — central state for a list screen.
//   rows        : raw, pre-filtered array
//   sortOptions : [{ id, label, accessor: (row) => sortable value }]
// --------------------------------------------------------------------
function useListView(rows, sortOptions) {
  const [sortId, setSortId] = React.useState(sortOptions[0].id);
  const [dir, setDir]       = React.useState("desc");
  const [pageSize, setPageSize] = React.useState(10);
  const [page, setPage]     = React.useState(1);

  // Reset to page 1 whenever the underlying row count changes (filter / search)
  const lenRef = React.useRef(rows.length);
  React.useEffect(() => {
    if (lenRef.current !== rows.length) {
      setPage(1);
      lenRef.current = rows.length;
    }
  }, [rows.length]);

  const sortDef = sortOptions.find(o => o.id === sortId) || sortOptions[0];
  const sorted = React.useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const va = sortDef.accessor(a);
      const vb = sortDef.accessor(b);
      if (va < vb) return dir === "asc" ? -1 :  1;
      if (va > vb) return dir === "asc" ?  1 : -1;
      return 0;
    });
    return list;
  }, [rows, sortId, dir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  return {
    rows: pageRows, total: sorted.length, totalPages, page: safePage, pageSize,
    sortId, sortDir: dir, sortOptions,
    setSortId, setDir, setPageSize, setPage,
  };
}

// --------------------------------------------------------------------
// ListToolbar — sticky toolbar above the list card.
//   Left  : "Lọc" button (advanced-filter popover hook) + inline
//           quick-filter chips
//   Right : sort-by dropdown + asc/desc arrow toggle (always cyan to
//           indicate that a sort is currently applied)
// --------------------------------------------------------------------
function ListToolbar({
  quickFilters,                  // node — inline chips rendered next to Lọc
  onLocClick,                    // optional: opens advanced-filter popover
  sortId, sortDir, sortOptions, onSortId, onSortDir,
}) {
  const [sortOpen, setSortOpen] = React.useState(false);
  const sortRef   = React.useRef(null);

  React.useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [sortOpen]);

  const activeSort = sortOptions.find(o => o.id === sortId) || sortOptions[0];

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 30,
      display: "flex", alignItems: "center", gap: 10,
      padding: "4px 0",
    }}>
      {/* Lọc button — placeholder trigger for an advanced-filter popover */}
      <button onClick={onLocClick} style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "8px 14px", borderRadius: 999, cursor: onLocClick ? "pointer" : "default",
        background: "var(--ink-2)",
        border: "1px solid var(--glass-stroke)",
        color: "var(--fg-1)",
        fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600,
        transition: "all 140ms var(--ease-out)",
      }}>
        <Icon name="filter" size={14} color="currentColor"/>
        Lọc
      </button>

      {/* Inline quick-filter chips */}
      {quickFilters && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {quickFilters}
        </div>
      )}

      <div style={{ flex: 1 }}></div>

      {/* Sort button + direction arrow — kept visually active (cyan) */}
      <div ref={sortRef} style={{ position: "relative", display: "inline-flex", alignItems: "stretch", gap: 0 }}>
        <button onClick={() => setSortOpen(v => !v)} style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          height: 36, padding: "0 14px",
          borderRadius: "999px 0 0 999px", cursor: "pointer",
          background: "var(--ink-2)",
          border: "1px solid var(--neon-cyan)",
          borderRight: "none",
          color: "var(--neon-cyan)",
          fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600,
          boxShadow: sortOpen ? "0 0 14px var(--neon-cyan-haze)" : "none",
          transition: "all 140ms var(--ease-out)",
          textShadow: "0 0 8px var(--neon-cyan-glow)",
        }}>
          {activeSort.label}
        </button>

        {/* Direction arrow */}
        <button onClick={() => onSortDir(sortDir === "asc" ? "desc" : "asc")}
                title={sortDir === "asc" ? "Tăng dần" : "Giảm dần"}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 38, height: 36, padding: 0,
                  borderRadius: "0 999px 999px 0", cursor: "pointer",
                  background: "var(--ink-2)",
                  border: "1px solid var(--neon-cyan)",
                  color: "var(--neon-cyan)",
                  transition: "all 140ms var(--ease-out)",
                }}>
          <Icon name={sortDir === "asc" ? "arrow-up" : "arrow-down"} size={14}
                color="var(--neon-cyan)"
                style={{ filter: "drop-shadow(0 0 4px var(--neon-cyan-glow))" }}/>
        </button>

        {sortOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 40,
            minWidth: 200,
            background: "var(--glass-3)",
            backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
            border: "1px solid var(--glass-stroke-strong)", borderRadius: 12,
            padding: 6, boxShadow: "var(--shadow-3)",
            animation: "fadeIn 160ms var(--ease-out)",
          }}>
            {sortOptions.map(o => {
              const active = o.id === sortId;
              return (
                <button key={o.id} onClick={() => { onSortId(o.id); setSortOpen(false); }} style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                  background: active ? "var(--ink-3)" : "transparent",
                  border: "none", color: active ? "var(--fg-1)" : "var(--fg-2)",
                  fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: active ? 600 : 500,
                  textAlign: "left",
                  transition: "background 120ms var(--ease-out)",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--ink-2)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                  {active && <Icon name="check" size={12} color="var(--neon-cyan)"/>}
                  <span style={{ marginLeft: active ? 0 : 18 }}>{o.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Paginator — floating bottom-right card.
// --------------------------------------------------------------------
function Paginator({ page, totalPages, pageSize, total, onPage, onPageSize }) {
  const [pageInput, setPageInput] = React.useState(String(page));
  React.useEffect(() => { setPageInput(String(page)); }, [page]);

  const sizes = [10, 20, 50, 100];
  const commitPage = () => {
    const n = parseInt(pageInput, 10);
    if (Number.isNaN(n)) { setPageInput(String(page)); return; }
    onPage(Math.max(1, Math.min(totalPages, n)));
  };

  return (
    <div style={{
      position: "fixed", right: 14, bottom: 14, zIndex: 80,
      display: "flex", alignItems: "center", gap: 10,
      padding: "6px 10px",
      background: "var(--glass-3)",
      backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
      border: "1px solid var(--glass-stroke-strong)", borderRadius: 12,
      boxShadow: "var(--shadow-3)",
    }}>
      {/* Page size */}
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-3)" }}>Hiển thị</span>
        <div style={{ position: "relative", display: "inline-flex" }}>
          <select value={pageSize} onChange={e => onPageSize(parseInt(e.target.value, 10))}
                  style={{
                    appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                    background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
                    color: "var(--fg-1)", borderRadius: 7,
                    padding: "4px 22px 4px 8px",
                    fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
                    cursor: "pointer",
                  }}>
            {sizes.map(n => <option key={n} value={n} style={{ background: "var(--ink-2)" }}>{n}</option>)}
          </select>
          <Icon name="arrow-down" size={10} color="var(--fg-3)"
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}/>
        </div>
      </label>

      <span style={{ width: 1, height: 18, background: "var(--ink-4)" }}></span>

      {/* Navigation arrows + page input */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <PageArrow onClick={() => onPage(1)} disabled={page <= 1} title="Trang đầu" doubled left/>
        <PageArrow onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} title="Trang trước" left/>

        <div style={{ display: "inline-flex", alignItems: "baseline", gap: 4, padding: "0 4px" }}>
          <input
            value={pageInput}
            onChange={e => setPageInput(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={commitPage}
            onKeyDown={e => { if (e.key === "Enter") { commitPage(); e.target.blur(); } }}
            style={{
              width: 32, textAlign: "center",
              background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
              color: "var(--fg-1)", borderRadius: 6, padding: "3px 2px",
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
              fontVariantNumeric: "tabular-nums", outline: "none",
            }}/>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>/</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-1)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{totalPages}</span>
        </div>

        <PageArrow onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} title="Trang sau"/>
        <PageArrow onClick={() => onPage(totalPages)} disabled={page >= totalPages} title="Trang cuối" doubled/>
      </div>

      <span style={{ width: 1, height: 18, background: "var(--ink-4)" }}></span>

      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>
        {total} bản
      </span>
    </div>
  );
}

function PageArrow({ onClick, disabled, title, left, doubled }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      width: 24, height: 24, padding: 0, borderRadius: 5,
      background: "transparent", border: "1px solid transparent",
      color: disabled ? "var(--fg-4)" : "var(--fg-2)",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.45 : 1,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      transition: "background 140ms var(--ease-out), color 140ms var(--ease-out)",
    }}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = "var(--ink-3)"; e.currentTarget.style.color = "var(--fg-1)"; } }}
    onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-2)"; } }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
           style={{ transform: left ? "rotate(180deg)" : "none" }}>
        {doubled
          ? <g><path d="M5 5l7 7-7 7"/><path d="M12 5l7 7-7 7"/></g>
          : <path d="M9 5l7 7-7 7"/>}
      </svg>
    </button>
  );
}

// ====================================================================
// Advanced filter modal — shared shell. Each list screen passes its own
// fields (FormText / FormSelect / etc) as children, plus handlers for
// apply / clear / cancel. The bottom strip uses the existing Modal's
// Hủy / Áp dụng footer; the "Xóa bộ lọc nâng cao" link sits inside the
// body so it's visually grouped with the fields.
// ====================================================================
function AdvancedFilterModal({ open, onClose, onApply, onClear, children, applyDisabled }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bộ lọc nâng cao"
      subtitle="Kết hợp với các preset ở thanh công cụ"
      primaryAction={() => { onApply(); onClose(); }}
      primaryLabel="Áp dụng"
      primaryIcon="check"
      primaryDisabled={applyDisabled}
      width={560}
      secondary={<ClearFilterPill onClick={onClear}/>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {children}
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------------
// ClearFilterPill — red pill that swaps the Hủy slot in the advanced
// filter modal. Idle: hairline pink border / pink text on transparent.
// Hover: pink fill wash + neon glow.
// --------------------------------------------------------------------
function ClearFilterPill({ onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 18px",
              borderRadius: 999,
              background: hover
                ? "color-mix(in oklab, var(--neon-pink) 16%, transparent)"
                : "transparent",
              border: "1px solid var(--neon-pink)",
              color: "var(--neon-pink)",
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.16em", textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: hover
                ? "0 0 18px var(--neon-pink-glow), inset 0 0 0 1px color-mix(in oklab, var(--neon-pink) 50%, transparent)"
                : "0 0 0 transparent",
              textShadow: hover ? "0 0 6px var(--neon-pink-glow)" : "none",
              transition: "all 160ms var(--ease-out)",
            }}>
      <Icon name="x" size={12} color="var(--neon-pink)"
            style={{ filter: hover ? "drop-shadow(0 0 4px var(--neon-pink-glow))" : "none" }}/>
      Xóa bộ lọc
    </button>
  );
}

// FormRow — side-by-side fields
function FormRow({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {children}
    </div>
  );
}

// FormField — label + slot
function FormField({ label, children, colSpan }) {
  return (
    <label style={{
      display: "flex", flexDirection: "column", gap: 6,
      gridColumn: colSpan ? `span ${colSpan}` : "auto",
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      {children}
    </label>
  );
}

// FormText — styled text input
function FormText({ value, onChange, placeholder }) {
  return (
    <input value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
           style={{
             background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
             color: "var(--fg-1)", borderRadius: 10,
             padding: "10px 12px",
             fontFamily: "var(--font-ui)", fontSize: 13, outline: "none",
             transition: "border-color 140ms var(--ease-out), box-shadow 140ms var(--ease-out)",
           }}
           onFocus={e => { e.target.style.borderColor = "var(--neon-cyan)"; e.target.style.boxShadow = "0 0 14px var(--neon-cyan-haze)"; }}
           onBlur={e => { e.target.style.borderColor = "var(--glass-stroke)"; e.target.style.boxShadow = "none"; }}/>
  );
}

// FormSelect — styled native select with custom arrow
function FormSelect({ value, onChange, options }) {
  return (
    <div style={{ position: "relative", display: "flex" }}>
      <select value={value} onChange={e => onChange(e.target.value)}
              style={{
                flex: 1,
                appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
                color: "var(--fg-1)", borderRadius: 10,
                padding: "10px 32px 10px 12px",
                fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500,
                cursor: "pointer", outline: "none",
                transition: "border-color 140ms var(--ease-out)",
              }}>
        {options.map(o => (
          <option key={o.id} value={o.id} style={{ background: "var(--ink-2)" }}>{o.label}</option>
        ))}
      </select>
      <Icon name="arrow-down" size={12} color="var(--fg-3)"
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}/>
    </div>
  );
}

Object.assign(window, {
  ListToolbar, Paginator, useListView, AdvancedFilterModal,
  FormRow, FormField, FormText, FormSelect,
  FloatingFilterPanel, FilterColumn, MultiPillField, DateRangeField, ChipButton,
});

// ====================================================================
// Floating, draggable advanced filter panel.
//   - No backdrop blur (the page stays interactive)
//   - Stays open until user closes it; hot-applies on every change
//   - Top-right has only `XOÁ` (clear-all) + `X` (close); no title/subtitle
// ====================================================================
function FloatingFilterPanel({ open, onClose, onClear, children, defaultPos = { x: 80, y: 200 }, width }) {
  const [pos, setPos] = React.useState(defaultPos);
  // Each time the panel re-opens, snap it back to defaultPos so the user
  // doesn't lose it off-screen between sessions.
  const wasOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpenRef.current) setPos(defaultPos);
    wasOpenRef.current = open;
  }, [open, defaultPos]);

  const panelRef = React.useRef(null);

  const onPointerDown = (e) => {
    // Only initiate drag from primary button on the handle itself.
    if (e.button !== 0) return;
    const rect = panelRef.current.getBoundingClientRect();
    const offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const onMove = (ev) => {
      // Clamp to viewport so the panel never floats off-screen.
      const maxX = window.innerWidth  - rect.width  - 4;
      const maxY = window.innerHeight - rect.height - 4;
      setPos({
        x: Math.max(4, Math.min(maxX, ev.clientX - offset.x)),
        y: Math.max(4, Math.min(maxY, ev.clientY - offset.y)),
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    e.preventDefault();
  };

  if (!open) return null;

  return (
    <div ref={panelRef} style={{
      position: "fixed", left: pos.x, top: pos.y, zIndex: 90,
      width: width || "auto",
      maxWidth: "calc(100vw - 24px)",
      maxHeight: "50vh",
      // Near-transparent shell — heavy blur is the only thing carrying
      // the glass feel; the tint is barely there so the page reads
      // through. The inner `--ink-2` chips/inputs provide the real
      // visible UI on top.
      background: "color-mix(in oklab, var(--ink-1) 8%, transparent)",
      backdropFilter: "var(--glass-blur-soft)",
      WebkitBackdropFilter: "var(--glass-blur-soft)",
      border: "1px solid color-mix(in oklab, var(--glass-stroke-strong) 40%, transparent)",
      borderRadius: 16,
      boxShadow: "0 12px 36px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      animation: "fadeIn 180ms var(--ease-out)",
    }}>
      {/* Drag handle bar — entire row is grabbable except the two buttons */}
      <div onPointerDown={onPointerDown}
           style={{
             display: "flex", alignItems: "center", gap: 8,
             padding: "5px 10px",
             borderBottom: "1px solid color-mix(in oklab, var(--glass-stroke) 60%, transparent)",
             cursor: "grab",
             userSelect: "none",
             touchAction: "none",
           }}>
        <div style={{ flex: 1 }}></div>

        <button onClick={onClear}
                onPointerDown={e => e.stopPropagation()}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  height: 34, padding: "0 28px",
                  borderRadius: 999,
                  background: "color-mix(in oklab, var(--neon-pink) 12%, transparent)",
                  border: "1px solid var(--neon-pink)",
                  color: "var(--neon-pink)",
                  fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                  letterSpacing: "0.18em", textTransform: "uppercase",
                  cursor: "pointer",
                  boxShadow: "0 0 12px color-mix(in oklab, var(--neon-pink) 28%, transparent)",
                  transition: "all 160ms var(--ease-out)",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in oklab, var(--neon-pink) 22%, transparent)"; e.currentTarget.style.boxShadow = "0 0 22px var(--neon-pink-glow)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "color-mix(in oklab, var(--neon-pink) 12%, transparent)"; e.currentTarget.style.boxShadow = "0 0 12px color-mix(in oklab, var(--neon-pink) 28%, transparent)"; }}>
          XÓA
        </button>
        <button onClick={onClose}
                onPointerDown={e => e.stopPropagation()}
                style={{
                  // Oval pill — wider than tall, used for high-alert
                  // close affordance.
                  height: 34, padding: "0 22px", borderRadius: 999,
                  background: "var(--ink-2)",
                  border: "1px solid var(--glass-stroke-strong)",
                  color: "var(--fg-1)",
                  cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  transition: "all 140ms var(--ease-out)",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--neon-cyan)"; e.currentTarget.style.boxShadow = "0 0 14px var(--neon-cyan-haze)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--glass-stroke-strong)"; e.currentTarget.style.boxShadow = "none"; }}>
          <Icon name="x" size={15}/>
        </button>
      </div>

      <div style={{
        padding: 14, display: "flex", flexDirection: "column", gap: 14,
        overflowY: "auto",
        // Body fills the remaining space and scrolls if content exceeds the
        // panel's 50vh max-height.
      }}>
        {children}
      </div>
    </div>
  );
}

// FilterColumn — used inside FloatingFilterPanel for horizontal column
// layout. Pills/options stack vertically inside each column.
function FilterColumn({ label, children, minWidth }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 6, flex: "0 0 auto",
      // Default minWidth: undefined → CSS uses `auto`, so the column
      // sizes naturally to its widest child (label or pill).
      ...(minWidth != null ? { minWidth } : null),
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      {/* alignItems: flex-start so pills hug their content instead of
          stretching to the column's full width. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
        {children}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// ChipButton — small selectable pill used in multi-select rows.
// --------------------------------------------------------------------
function ChipButton({ active, children, onClick, color = "cyan" }) {
  const c = `var(--neon-${color})`;
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 11px", borderRadius: 999,
      background: active ? `color-mix(in oklab, ${c} 14%, transparent)` : "var(--ink-2)",
      border: `1px solid ${active ? c : "var(--glass-stroke)"}`,
      boxShadow: active ? `0 0 12px color-mix(in oklab, ${c} 40%, transparent)` : "none",
      color: active ? "var(--fg-1)" : "var(--fg-2)",
      fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600,
      cursor: "pointer", whiteSpace: "nowrap",
      transition: "all 140ms var(--ease-out)",
    }}>{children}</button>
  );
}

// --------------------------------------------------------------------
// MultiPillField — label + row of multi-select pills. `values` is an
// array of selected ids; toggling a pill mutates the array via onChange.
// --------------------------------------------------------------------
function MultiPillField({ label, values = [], options, onChange, color = "cyan" }) {
  const isOn = (id) => values.includes(id);
  const toggle = (id) => onChange(isOn(id) ? values.filter(v => v !== id) : [...values, id]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map(o => (
          <ChipButton key={o.id} active={isOn(o.id)} color={color} onClick={() => toggle(o.id)}>
            {o.label}
          </ChipButton>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// DateRangeField — start / end pickers using the upgraded calendar
// widget (Monday-start mini-calendar, select-all on focus). Value is
// `{ start: Date|null, end: Date|null } | null`.
// --------------------------------------------------------------------
function DateRangeField({ label, value, onChange }) {
  const start = value?.start || null;
  const end   = value?.end   || null;
  const setSide = (which, d) => {
    let next = { start, end, [which]: d };
    // Auto-swap if user picks an end before the start (or vice versa).
    if (next.start && next.end && next.end < next.start) {
      next = { start: next.end, end: next.start };
    }
    if (!next.start && !next.end) onChange(null);
    else onChange(next);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
        borderRadius: 10, padding: "4px 6px",
      }}>
        <DateFieldNullable value={start} onChange={d => setSide("start", d)} placeholder="Từ ngày"/>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>→</span>
        <DateFieldNullable value={end}   onChange={d => setSide("end",   d)} placeholder="Đến ngày"/>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// DateFieldNullable — same calendar widget used by the dashboard's
// "Chọn khung" custom range, but accepts a null `value` to show a
// placeholder. Edits in-place when text is typed; clicking the field
// opens a Monday-start mini-calendar.
// --------------------------------------------------------------------
function DateFieldNullable({ value, onChange, placeholder = "Chọn ngày" }) {
  const fmt = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  const parse = (str) => {
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const d = +m[1], mo = +m[2], y = +m[3];
    const dt = new Date(y, mo - 1, d);
    if (dt.getDate() !== d || dt.getMonth() !== mo - 1 || dt.getFullYear() !== y) return null;
    return dt;
  };
  const [text, setText] = React.useState(value ? fmt(value) : "");
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { setText(value ? fmt(value) : ""); }, [value && value.getTime()]);   // eslint-disable-line

  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const commit = () => {
    if (text.trim() === "") { onChange(null); return; }
    const dt = parse(text);
    if (dt) onChange(dt);
    else    setText(value ? fmt(value) : "");
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onFocus={(e) => { e.target.select(); setOpen(true); }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") { commit(); e.target.blur(); } }}
        placeholder={placeholder}
        style={{
          width: 112, textAlign: "center",
          background: "transparent", border: "1px solid transparent",
          color: "var(--fg-1)", borderRadius: 8,
          padding: "6px 6px",
          fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
          fontVariantNumeric: "tabular-nums", outline: "none",
          transition: "background 140ms var(--ease-out)",
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = "var(--ink-4)"; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = "transparent"; }}/>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 70 }}>
          <NullableMiniCalendar
            value={value}
            onPick={(d) => { onChange(d); setOpen(false); }}/>
        </div>
      )}
    </div>
  );
}

// MiniCalendar variant (Monday-start) — accepts null `value` so it
// opens on the current month when no date is set.
function NullableMiniCalendar({ value, onPick }) {
  const seed = value || new Date();
  const [view, setView] = React.useState(new Date(seed.getFullYear(), seed.getMonth(), 1));
  const year = view.getFullYear();
  const month = view.getMonth();

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = offset - 1; i >= 0; i--) {
    cells.push({ d: daysInPrev - i, otherMonth: true, dt: new Date(year, month - 1, daysInPrev - i) });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, otherMonth: false, dt: new Date(year, month, d) });
  while (cells.length % 7 !== 0) {
    const d = cells.length - (offset + daysInMonth) + 1;
    cells.push({ d, otherMonth: true, dt: new Date(year, month + 1, d) });
  }

  const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const today = new Date();
  const MONTH_NAMES = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];

  return (
    <div onMouseDown={e => e.preventDefault()} style={{
      width: 252, padding: 12,
      background: "var(--glass-3)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
      border: "1px solid var(--glass-stroke-strong)", borderRadius: 14,
      boxShadow: "var(--shadow-3)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <NullableCalArrow onClick={() => setView(new Date(year, month - 1, 1))} left/>
        <span style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-1)", fontWeight: 600, letterSpacing: "0.06em" }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <NullableCalArrow onClick={() => setView(new Date(year, month + 1, 1))}/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {["T2","T3","T4","T5","T6","T7","CN"].map(d => (
          <span key={d} style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.08em", padding: "4px 0" }}>{d}</span>
        ))}
        {cells.map((c, i) => {
          const isSel = sameDay(c.dt, value);
          const isToday = sameDay(c.dt, today);
          return (
            <button key={i} onClick={() => onPick(c.dt)} style={{
              height: 28, padding: 0, border: "none",
              borderRadius: 6, cursor: "pointer",
              background: isSel ? "var(--neon-cyan)" : "transparent",
              color: isSel ? "var(--ink-0)" : c.otherMonth ? "var(--fg-4)" : "var(--fg-1)",
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: isSel ? 700 : 500,
              fontVariantNumeric: "tabular-nums",
              boxShadow: isSel
                ? "0 0 12px var(--neon-cyan-glow)"
                : isToday
                ? "inset 0 0 0 1px var(--neon-cyan)"
                : "none",
              transition: "background 140ms var(--ease-out), color 140ms var(--ease-out)",
            }}
            onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "var(--ink-3)"; }}
            onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
              {c.d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NullableCalArrow({ onClick, left }) {
  return (
    <button onClick={onClick} style={{
      width: 24, height: 24, padding: 0, borderRadius: 6,
      background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
      color: "var(--fg-2)", cursor: "pointer",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
           style={{ transform: left ? "rotate(180deg)" : "none" }}>
        <path d="M9 5l7 7-7 7"/>
      </svg>
    </button>
  );
}
