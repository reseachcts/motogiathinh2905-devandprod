// ====================================================================
// App — routing between screens + modals + detail views
// ====================================================================

function App() {
  // ThemeProvider wraps the whole app so theme toggles instantly
  // propagate to any component reading `useTheme()` / `useBranchTones()`.
  return (
    <ThemeProvider>
      <AppRoot/>
    </ThemeProvider>
  );
}

function AppRoot() {
  const D = window.MGT_DATA;
  const isAdmin = D.currentUser.role === "admin";

  // Re-render whenever data-loader fires 'mgt:datachanged' (after any
  // successful create/update/delete). The frozen screens read D.<arrays>
  // directly with no React state binding, so without this they'd only
  // refresh on tab-bounce.
  const [, _bump] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const fn = () => _bump();
    window.addEventListener("mgt:datachanged", fn);
    return () => window.removeEventListener("mgt:datachanged", fn);
  }, []);

  // route: { tab: "students"|"payments"|..., detail: null | { type, id } }
  const [tab, setTab]       = React.useState("dashboard");
  const [detail, setDetail] = React.useState(null);
  const [navCollapsed, setNavCollapsed] = React.useState(false);

  // modals
  const [addStudent, setAddStudent] = React.useState(false);
  const [addPayment, setAddPayment] = React.useState({ open: false, studentId: null, amount: null });
  const [addClass, setAddClass]     = React.useState(false);

  const unread = D.notifications.filter(n => !n.read).length;

  // Navigation helpers
  const goTab = (id) => { setTab(id); setDetail(null); };
  const openStudent = (id, opts) => setDetail({ type: "student", id, ...(opts || {}) });
  const openPayment = (id) => setDetail({ type: "payment", id });
  const openClass   = (id) => { setTab("classes"); setDetail({ type: "class", id }); };

  const TITLES = {
    dashboard:    { title: "Tổng quan"            },
    students:     { title: "Danh sách học viên"   },
    payments:     { title: "Thanh toán"           },
    classes:      { title: "Lớp học"               },
    notifications:{ title: "Thông báo"             },
    organization: { title: "Tổ chức"               },
  };
  const meta = TITLES[tab];

  // Detail-view titles
  let detailTitle = null;
  if (detail?.type === "student") detailTitle = { title: D.getStudent(detail.id)?.name || "" };
  if (detail?.type === "payment") detailTitle = { title: detail.id };
  if (detail?.type === "class")   detailTitle = { title: D.getClass(detail.id)?.code || "" };

  return (
    <div className="mgt-canvas" style={{
      minHeight: "100vh", padding: 20,
      paddingLeft: navCollapsed ? 30 : 14,
      display: "flex", gap: navCollapsed ? 0 : 14, alignItems: "flex-start",
      transition: "padding-left 320ms var(--ease-out), gap 320ms var(--ease-out)",
    }}>
      <SidebarEdgeToggle collapsed={navCollapsed} onToggle={() => setNavCollapsed(v => !v)}/>
      <Sidebar active={tab} onNav={goTab}
               onQuickAdd={() => setAddStudent(true)}
               unreadCount={unread}
               collapsed={navCollapsed}/>

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Detail back link sits ABOVE the title row */}
        {detail && (
          <button onClick={() => detail.from ? setDetail(detail.from) : setDetail(null)} style={{
            background: "transparent", border: "none", color: "var(--fg-3)",
            fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6, padding: 0, alignSelf: "flex-start",
            marginBottom: 8,
          }}>
            <Icon name="arrow-up" size={14} style={{ transform: "rotate(-90deg)" }}/>
            {detail.from?.type === "class"     ? `Quay lại lớp ${D.getClass(detail.from.id)?.code || ""}` :
             detail.from?.type === "student"   ? `Quay lại học viên ${D.getStudent(detail.from.id)?.name || ""}` :
             detail.from?.type === "payment"   ? "Quay lại thanh toán" :
             /* Fall back to the current tab — label the list the user came from. */
             `Quay lại bảng ${meta.title.replace(/^Danh sách /, "")}`}
          </button>
        )}

        <TopBar
          title={detail ? detailTitle.title : meta.title}
          right={
            !detail && tab === "dashboard"
              ? <Button variant="ghost" size="sm" icon="download">Báo cáo</Button>
              : !detail && tab === "students"
              ? <Button variant="primary" icon="plus" onClick={() => setAddStudent(true)}>Thêm học viên</Button>
              : !detail && tab === "payments"
              ? <Button variant="primary" icon="plus" onClick={() => setAddPayment({ open: true, studentId: null, amount: null })}>Ghi nhận thanh toán</Button>
              : !detail && tab === "classes" && isAdmin
              ? <Button variant="primary" icon="plus" onClick={() => setAddClass(true)}>Tạo lớp</Button>
              : null
          }
        />

        <div style={{ position: "relative", flex: 1 }}>
          {/* Detail views (when set) */}
          {detail?.type === "student" && (
            <StudentDetail studentId={detail.id}
                           initialTab={detail.tab}
                           initialPaymentId={detail.paymentId}
                           onBack={() => setDetail(null)}
                           onAddPayment={(studentId, amount) => setAddPayment({ open: true, studentId, amount })}
                           onOpenPayment={openPayment}/>
          )}
          {detail?.type === "payment" && (
            <PaymentDetail paymentId={detail.id} onBack={() => setDetail(null)}
                           onOpenStudent={openStudent}/>
          )}
          {detail?.type === "class" && (
            <ClassDetail classId={detail.id} onBack={() => setDetail(null)}
                         onOpenStudent={openStudent} isAdmin={isAdmin}/>
          )}

          {/* List/screen views */}
          {!detail && tab === "dashboard"     && <DashboardScreen onOpenStudent={openStudent}/>}
          {!detail && tab === "students"      && <StudentsScreen onOpenStudent={openStudent}
                                                                 onAddStudent={() => setAddStudent(true)}/>}
          {!detail && tab === "payments"      && <PaymentsScreen onOpenStudent={openStudent}
                                                                 onAddPayment={() => setAddPayment({ open: true, studentId: null })}/>}
          {!detail && tab === "classes"       && <ClassesScreen onOpenClass={openClass}
                                                                onAddClass={() => setAddClass(true)}
                                                                isAdmin={isAdmin}/>}
          {!detail && tab === "notifications" && <NotificationsScreen onOpenStudent={openStudent}/>}
          {!detail && tab === "organization"  && <OrganizationScreen onOpenClass={openClass}/>}
        </div>
      </main>

      <AddStudentModal open={addStudent} onClose={() => setAddStudent(false)}
                       onSave={async (payload) => {
                         try {
                           const { docFiles, ...rest } = payload;
                           const created = await D.api.createStudent(rest);
                           // Then upload any captured files. Independent so a
                           // failed upload doesn't block the rest.
                           await Promise.all(Object.entries(docFiles || {}).map(
                             ([key, file]) => file ? D.api.uploadStudentDoc(created.id, key, file).catch(e => console.warn('upload failed', key, e)) : null
                           ));
                         } catch (e) { alert("Lỗi: " + e.message); }
                       }}/>
      <AddPaymentModal open={addPayment.open} defaultStudentId={addPayment.studentId}
                       defaultAmount={addPayment.amount}
                       onClose={() => setAddPayment({ open: false, studentId: null, amount: null })}
                       onSave={async (payload) => {
                         // Let errors propagate so AddPaymentModal can render
                         // them inline (busy/err pattern). The previous
                         // try/catch+alert+swallowed-upload-warn made create
                         // and upload failures invisible to the user.
                         const { bienLaiFile, ...rest } = payload;
                         const created = await D.api.createPayment(rest);
                         if (bienLaiFile) {
                           try { await D.api.uploadBienLai(created.id, bienLaiFile); }
                           catch (e) { throw new Error('Đã lưu thanh toán nhưng tải ảnh biên lai thất bại: ' + e.message); }
                         }
                       }}/>
      <AddClassModal   open={addClass} onClose={() => setAddClass(false)}
                       onSave={(payload) => D.api.createClass(payload)}/>
    </div>
  );
}

// --------------------------------------------------------------------
// Boot — wait for window.MGT_DATA_READY (the data-loader.js fetch
// promise) to resolve, then render <App/>. While loading, show a
// minimal eyebrow-style "Đang tải dữ liệu…". On error, show the
// message so devs can debug a missing/malformed CSV.
// --------------------------------------------------------------------
function Boot() {
  const [ready, setReady] = React.useState(!!window.MGT_DATA);
  const [error, setError] = React.useState(null);
  React.useEffect(() => {
    if (ready) return;
    if (!window.MGT_DATA_READY) { setError(new Error("MGT_DATA_READY not found — data-loader.js failed to register")); return; }
    window.MGT_DATA_READY.then(() => setReady(true)).catch(setError);
  }, []);   // eslint-disable-line
  if (error) {
    return (
      <div className="mgt-canvas" style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 12, padding: 60,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--neon-pink)" }}>Lỗi tải dữ liệu</span>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-2)" }}>{String(error.message || error)}</span>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="mgt-canvas" style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 60,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Đang tải dữ liệu…</span>
      </div>
    );
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<Boot />);
