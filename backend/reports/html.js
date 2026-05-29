// reports/html.js — render the formal weekly report as a printable HTML
// document. Used by routes/reports.js with page.setContent() + page.pdf().

import { fmtVND } from './data.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function fmtInt(n) { return (n || 0).toLocaleString('en-US'); }

// -------- per-section table builders --------

function tableBranchSummary(data) {
  const rows = data.branchSummary;
  const t = rows.reduce((a, b) => ({
    students: a.students + b.students, newStudents: a.newStudents + b.newStudents,
    revP: a.revP + b.revenuePeriod, revA: a.revA + b.revenueAll,
    comm: a.comm + b.committed, out: a.out + b.outstanding,
    paidFull: a.paidFull + b.paidFull, partial: a.partial + b.partial, unpaid: a.unpaid + b.unpaid,
  }), { students: 0, newStudents: 0, revP: 0, revA: 0, comm: 0, out: 0, paidFull: 0, partial: 0, unpaid: 0 });
  return section('1. Tổng kết theo chi nhánh', `${rows.length} chi nhánh`, `
    <table>
      <thead><tr>
        <th>Chi nhánh</th><th class="num">HV tổng</th><th class="num">HV mới</th>
        <th class="num">DT kỳ</th><th class="num">DT tổng</th>
        <th class="num">Cam kết</th><th class="num">Còn nợ</th>
        <th class="num">Đủ / 50% / 0%</th>
      </tr></thead>
      <tbody>
        ${rows.map(b => `<tr>
          <td>${esc(b.branchName)}</td>
          <td class="num">${fmtInt(b.students)}</td>
          <td class="num">${fmtInt(b.newStudents)}</td>
          <td class="num">${fmtVND(b.revenuePeriod)}</td>
          <td class="num">${fmtVND(b.revenueAll)}</td>
          <td class="num">${fmtVND(b.committed)}</td>
          <td class="num neg">${fmtVND(b.outstanding)}</td>
          <td class="num small">${b.paidFull} / ${b.partial} / ${b.unpaid}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td>Tổng cộng</td>
        <td class="num">${fmtInt(t.students)}</td>
        <td class="num">${fmtInt(t.newStudents)}</td>
        <td class="num">${fmtVND(t.revP)}</td>
        <td class="num">${fmtVND(t.revA)}</td>
        <td class="num">${fmtVND(t.comm)}</td>
        <td class="num neg">${fmtVND(t.out)}</td>
        <td class="num small">${t.paidFull} / ${t.partial} / ${t.unpaid}</td>
      </tr></tfoot>
    </table>
  `);
}

function tablePayments(data) {
  const rows = data.paymentsInPeriod;
  const total = rows.reduce((a, p) => a + p.amount, 0);
  return section('2. Thanh toán trong kỳ', `${rows.length} giao dịch · Tổng thu: ${fmtVND(total)}`, `
    <table class="dense">
      <thead><tr>
        <th>Thời điểm</th><th>Mã BL</th><th>Học viên</th><th>Mã HV</th>
        <th>Lớp</th><th>Chi nhánh</th><th class="num">Số tiền</th>
        <th>Hình thức</th><th>Nhân viên</th><th>BL</th>
      </tr></thead>
      <tbody>
        ${rows.length === 0 ? '<tr><td colspan="10" class="empty">Không có giao dịch trong kỳ.</td></tr>' :
          rows.map(p => `<tr>
            <td class="small">${esc(p.createdAt)}</td>
            <td class="mono small">${esc(p.bienLaiId || '')}</td>
            <td>${esc(p.studentName || '')}</td>
            <td class="mono small">${esc(p.studentMaHV || '')}</td>
            <td class="small">${esc(p.classCode || '')}</td>
            <td class="small">${esc(p.branchName || '')}</td>
            <td class="num">${fmtVND(p.amount)}</td>
            <td class="small">${esc(p.method)}</td>
            <td class="small">${esc(p.staffName || '')}</td>
            <td class="num small">${p.bienLaiPhoto ? '✓' : '—'}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="6">Tổng cộng</td><td class="num">${fmtVND(total)}</td><td colspan="3"></td></tr></tfoot>
    </table>
  `);
}

function tableNewStudents(data) {
  const rows = data.newStudentsInPeriod;
  return section('3. Học viên đăng ký mới trong kỳ', `${rows.length} học viên`, `
    <table class="dense">
      <thead><tr>
        <th>Thời điểm</th><th>Mã HV</th><th>Họ tên</th><th>SĐT</th><th>CCCD</th>
        <th>Bằng</th><th>Lớp</th><th>Chi nhánh</th>
        <th class="num">Tổng phí</th><th class="num">Đã thu</th><th class="num">Còn nợ</th>
      </tr></thead>
      <tbody>
        ${rows.length === 0 ? '<tr><td colspan="11" class="empty">Không có học viên mới trong kỳ.</td></tr>' :
          rows.map(s => `<tr>
            <td class="small">${esc(s.createdAt)}</td>
            <td class="mono small">${esc(s.maHV)}</td>
            <td>${esc(s.name)}</td>
            <td class="mono small">${esc(s.phone)}</td>
            <td class="mono small">${esc(s.idNumber)}</td>
            <td class="small">${esc(s.licence)}</td>
            <td class="small">${esc(s.classCode)}</td>
            <td class="small">${esc(s.branchName)}</td>
            <td class="num">${fmtVND(s.totalFee)}</td>
            <td class="num pos">${fmtVND(s.paid)}</td>
            <td class="num neg">${fmtVND(s.balance)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  `);
}

function tableActiveClasses(data) {
  const rows = data.activeClasses;
  return section('4. Lớp đang hoạt động', `${rows.length} lớp đang trong giai đoạn “đang diễn ra”`, `
    <table>
      <thead><tr><th>Mã lớp</th><th>Chi nhánh</th><th>Ngày mở</th><th>Ngày thi</th><th class="num">Sĩ số</th></tr></thead>
      <tbody>
        ${rows.length === 0 ? '<tr><td colspan="5" class="empty">Không có lớp đang chạy.</td></tr>' :
          rows.map(c => `<tr>
            <td class="mono small">${esc(c.code)}</td>
            <td>${esc(c.branchName)}</td>
            <td class="small">${esc(c.openDate)}</td>
            <td class="small">${esc(c.examDate)}</td>
            <td class="num">${fmtInt(c.enrolled)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  `);
}

function tableOutstanding(data) {
  const rows = data.outstandingStudents;
  const total = rows.reduce((a, s) => a + s.balance, 0);
  return section('5. Học viên còn nợ', `${rows.length} học viên · Tổng nợ: ${fmtVND(total)}`, `
    <table class="dense">
      <thead><tr>
        <th>Mã HV</th><th>Họ tên</th><th>SĐT</th><th>Lớp</th><th>Chi nhánh</th>
        <th class="num">Tổng phí</th><th class="num">Đã thu</th><th class="num">Còn nợ</th><th>Trạng thái</th>
      </tr></thead>
      <tbody>
        ${rows.length === 0 ? '<tr><td colspan="9" class="empty">Không có học viên còn nợ.</td></tr>' :
          rows.map(s => `<tr>
            <td class="mono small">${esc(s.maHV)}</td>
            <td>${esc(s.name)}</td>
            <td class="mono small">${esc(s.phone)}</td>
            <td class="small">${esc(s.classCode)}</td>
            <td class="small">${esc(s.branchName)}</td>
            <td class="num">${fmtVND(s.totalFee)}</td>
            <td class="num pos">${fmtVND(s.paid)}</td>
            <td class="num neg">${fmtVND(s.balance)}</td>
            <td class="small">${esc(s.paymentStatus)}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="5">Tổng nợ</td><td colspan="2"></td><td class="num neg">${fmtVND(total)}</td><td></td></tr></tfoot>
    </table>
  `);
}

function tableRentals(data) {
  const rows = data.rentalsInPeriod;
  const total = rows.reduce((a, p) => a + p.amount, 0);
  return section('6. Cho thuê xe trong kỳ',
    `${rows.length} lượt thuê · Tổng thu: ${fmtVND(total)} · Không tính vào doanh thu chính`, `
    <table class="dense">
      <thead><tr>
        <th>Thời điểm</th><th>Xe</th><th>Xe số</th><th>Bằng</th>
        <th>Học viên</th><th>Mã HV</th>
        <th class="num">Số lượt</th><th class="num">Số tiền</th>
        <th>Hình thức</th><th>Nhân viên</th>
      </tr></thead>
      <tbody>
        ${rows.length === 0 ? '<tr><td colspan="10" class="empty">Không có lượt thuê xe trong kỳ.</td></tr>' :
          rows.map(p => `<tr>
            <td class="small">${esc(p.createdAt)}</td>
            <td>${esc(p.vehicleName || '')}</td>
            <td class="mono small">${esc(p.vehiclePlate || '')}</td>
            <td class="small">${esc(p.vehicleLicence || '')}</td>
            <td>${esc(p.studentName || '')}</td>
            <td class="mono small">${esc(p.studentMaHV || '')}</td>
            <td class="num">${fmtInt(p.rentalRounds)}</td>
            <td class="num">${fmtVND(p.amount)}</td>
            <td class="small">${esc(p.method)}</td>
            <td class="small">${esc(p.staffName || '')}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="6">Tổng</td><td></td><td class="num">${fmtVND(total)}</td><td colspan="2"></td></tr></tfoot>
    </table>
  `);
}

function tableAudit(data) {
  const rows = data.auditLog;
  return section('7. Nhật ký Sửa / Xóa / Thanh toán', `${rows.length} mục — không bao gồm thao tác tạo mới`, `
    <table class="dense">
      <thead><tr><th>Thời điểm</th><th>Người dùng</th><th>Vai trò</th><th>Hành động</th><th>Đối tượng</th></tr></thead>
      <tbody>
        ${rows.length === 0 ? '<tr><td colspan="5" class="empty">Không có nhật ký trong kỳ.</td></tr>' :
          rows.map(l => `<tr>
            <td class="small">${esc(l.at)}</td>
            <td class="small">${esc(l.userName || '(Hệ thống)')}</td>
            <td class="small">${esc(l.userRole || 'system')}</td>
            <td class="mono small">${esc(l.action)}</td>
            <td class="small wrap">${esc(l.target || '')}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  `);
}

function section(title, subtitle, body) {
  return `<section class="page">
    <h2>${esc(title)}</h2>
    <p class="sub">${esc(subtitle)}</p>
    ${body}
  </section>`;
}

// ---------------------------------------------------------------------------

export function buildFormalHtml(data) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"/>
<title>Báo cáo tuần — ${esc(data.period.label)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
         color: #111827; font-size: 11px; line-height: 1.4; margin: 0; padding: 0; }
  header.cover { padding: 0 0 12px; border-bottom: 2px solid #111827; margin-bottom: 14px; }
  header.cover h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 0.5px; }
  header.cover .meta { color: #4b5563; font-size: 11px; }
  header.cover .meta b { color: #111827; }
  section.page { break-inside: avoid; page-break-inside: avoid; margin-bottom: 18px; }
  section.page + section.page { break-before: page; page-break-before: always; }
  h2 { font-size: 14px; margin: 0 0 4px; padding: 0 0 4px; border-bottom: 1px solid #d1d5db; }
  p.sub { color: #6b7280; margin: 0 0 8px; font-size: 10.5px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  table.dense { font-size: 9.5px; }
  thead th { background: #1f2937; color: #fff; text-align: left; padding: 6px 8px; font-weight: 600; font-size: 10px; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f9fafb; }
  tfoot td { padding: 6px 8px; border-top: 2px solid #111827; font-weight: 700; background: #f3f4f6; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .small { font-size: 9.5px; }
  .mono { font-family: "Consolas", "Courier New", monospace; }
  .pos  { color: #047857; }
  .neg  { color: #b91c1c; }
  .empty { text-align: center; color: #9ca3af; font-style: italic; padding: 14px !important; }
  .wrap { white-space: normal; word-break: break-word; }
  footer.signoff { margin-top: 24px; padding-top: 12px; border-top: 1px solid #d1d5db;
                   display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  footer.signoff .box { min-height: 70px; }
  footer.signoff .box .label { font-weight: 700; }
  footer.signoff .box .name { color: #6b7280; font-style: italic; margin-top: 4px; }
</style></head><body>

<header class="cover">
  <h1>BÁO CÁO TUẦN — ${esc(data.company)}</h1>
  <div class="meta">
    Kỳ báo cáo: <b>${esc(data.period.label)}</b>  ·
    Lập lúc: <b>${esc(data.generatedAt)}</b>  ·
    Phạm vi: <b>Toàn bộ chi nhánh</b>
  </div>
</header>

${tableBranchSummary(data)}
${tablePayments(data)}
${tableNewStudents(data)}
${tableActiveClasses(data)}
${tableOutstanding(data)}
${tableRentals(data)}
${tableAudit(data)}

<footer class="signoff">
  <div class="box">
    <div class="label">Người lập báo cáo</div>
    <div class="name">(Ký và ghi rõ họ tên)</div>
  </div>
  <div class="box">
    <div class="label">Chủ doanh nghiệp xác nhận</div>
    <div class="name">(Ký và ghi rõ họ tên)</div>
  </div>
</footer>

</body></html>`;
}
