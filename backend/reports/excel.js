// reports/excel.js — render the formal weekly report as an .xlsx workbook
// with six sheets. Uses exceljs (pure JS).

import ExcelJS from 'exceljs';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
const TITLE_FONT  = { bold: true, size: 16, color: { argb: 'FF111827' } };
const SUBTITLE    = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
const MONEY_FMT   = '#,##0"đ"';
const INT_FMT     = '#,##0';

function addBanner(ws, title, subtitle) {
  ws.mergeCells('A1', 'H1');
  ws.getCell('A1').value = title;
  ws.getCell('A1').font  = TITLE_FONT;
  ws.getCell('A1').alignment = { vertical: 'middle' };
  ws.getRow(1).height = 24;
  if (subtitle) {
    ws.mergeCells('A2', 'H2');
    ws.getCell('A2').value = subtitle;
    ws.getCell('A2').font  = SUBTITLE;
    ws.getRow(2).height = 16;
  }
  ws.addRow([]);
}

function addHeaderRow(ws, cols) {
  const row = ws.addRow(cols.map(c => c.header));
  row.eachCell((cell, i) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF6B7280' } } };
  });
  row.height = 22;
}

function setColumnWidths(ws, cols) {
  ws.columns = cols.map((c, i) => ({ width: c.width || 14 }));
}

function applyDataFormats(ws, cols, fromRow) {
  cols.forEach((c, i) => {
    if (!c.numFmt) return;
    ws.getColumn(i + 1).eachCell({ includeEmpty: false }, (cell, r) => {
      if (r >= fromRow) cell.numFmt = c.numFmt;
    });
  });
}

function fillTotalRow(ws, cols, totals) {
  if (!totals) return;
  const r = ws.addRow(cols.map((c, i) => totals[i] === undefined ? '' : totals[i]));
  r.eachCell(cell => {
    cell.font = { bold: true };
    cell.border = { top: { style: 'thin', color: { argb: 'FF111827' } } };
  });
  cols.forEach((c, i) => { if (c.numFmt) r.getCell(i + 1).numFmt = c.numFmt; });
}

// ---------------------------------------------------------------------------
// Per-sheet builders.
// ---------------------------------------------------------------------------

function sheetBranchSummary(wb, data) {
  const ws = wb.addWorksheet('Tổng kết chi nhánh');
  addBanner(ws, 'Tổng kết theo chi nhánh', `Kỳ báo cáo: ${data.period.label}  ·  Lập lúc: ${data.generatedAt}`);
  const cols = [
    { header: 'Chi nhánh',                   key: 'name',   width: 22 },
    { header: 'Học viên (tổng)',             key: 'st',     width: 14, numFmt: INT_FMT },
    { header: 'Học viên mới (kỳ)',           key: 'newSt',  width: 14, numFmt: INT_FMT },
    { header: 'Doanh thu (kỳ)',              key: 'revP',   width: 18, numFmt: MONEY_FMT },
    { header: 'Doanh thu (tổng)',            key: 'revA',   width: 18, numFmt: MONEY_FMT },
    { header: 'Cam kết (totalFee)',          key: 'comm',   width: 18, numFmt: MONEY_FMT },
    { header: 'Còn nợ',                      key: 'out',    width: 18, numFmt: MONEY_FMT },
    { header: 'Trạng thái: đủ / 50% / 0%',   key: 'states', width: 22 },
  ];
  setColumnWidths(ws, cols);
  addHeaderRow(ws, cols);
  for (const b of data.branchSummary) {
    ws.addRow([b.branchName, b.students, b.newStudents, b.revenuePeriod, b.revenueAll,
               b.committed, b.outstanding, `${b.paidFull} / ${b.partial} / ${b.unpaid}`]);
  }
  applyDataFormats(ws, cols, 5);
  const t = data.branchSummary.reduce((acc, b) => ({
    students: acc.students + b.students, newStudents: acc.newStudents + b.newStudents,
    revP: acc.revP + b.revenuePeriod, revA: acc.revA + b.revenueAll,
    comm: acc.comm + b.committed, out: acc.out + b.outstanding,
  }), { students: 0, newStudents: 0, revP: 0, revA: 0, comm: 0, out: 0 });
  fillTotalRow(ws, cols, ['Tổng cộng', t.students, t.newStudents, t.revP, t.revA, t.comm, t.out, '']);
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

function sheetPayments(wb, data) {
  const ws = wb.addWorksheet('Thanh toán');
  addBanner(ws, 'Danh sách thanh toán trong kỳ', `Kỳ: ${data.period.label}  ·  ${data.paymentsInPeriod.length} giao dịch`);
  const cols = [
    { header: 'Thời điểm',  width: 18 },
    { header: 'Mã TT',      width: 24 },
    { header: 'Mã BL',      width: 22 },
    { header: 'Học viên',   width: 22 },
    { header: 'Mã HV',      width: 10 },
    { header: 'Lớp',        width: 18 },
    { header: 'Chi nhánh',  width: 16 },
    { header: 'Số tiền',    width: 16, numFmt: MONEY_FMT },
    { header: 'Hình thức',  width: 14 },
    { header: 'Nhân viên',  width: 18 },
    { header: 'Biên lai',   width: 10 },
  ];
  setColumnWidths(ws, cols);
  addHeaderRow(ws, cols);
  for (const p of data.paymentsInPeriod) {
    ws.addRow([p.createdAt, p.id, p.bienLaiId, p.studentName || '', p.studentMaHV || '',
               p.classCode || '', p.branchName || '', p.amount, p.method,
               p.staffName || '', p.bienLaiPhoto ? '✓' : '—']);
  }
  applyDataFormats(ws, cols, 5);
  const total = data.paymentsInPeriod.reduce((s, p) => s + p.amount, 0);
  fillTotalRow(ws, cols, ['', '', '', '', '', '', 'Tổng cộng', total, '', '', '']);
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

function sheetNewStudents(wb, data) {
  const ws = wb.addWorksheet('Học viên mới');
  addBanner(ws, 'Học viên đăng ký mới trong kỳ', `${data.newStudentsInPeriod.length} học viên`);
  const cols = [
    { header: 'Thời điểm',  width: 18 },
    { header: 'Mã HV',      width: 10 },
    { header: 'Họ tên',     width: 22 },
    { header: 'SĐT',        width: 14 },
    { header: 'CCCD',       width: 16 },
    { header: 'Bằng',       width: 8 },
    { header: 'Lớp',        width: 18 },
    { header: 'Chi nhánh',  width: 16 },
    { header: 'Gói học phí', width: 14 },
    { header: 'Tổng phí',   width: 14, numFmt: MONEY_FMT },
    { header: 'Đã thu',     width: 14, numFmt: MONEY_FMT },
    { header: 'Còn nợ',     width: 14, numFmt: MONEY_FMT },
  ];
  setColumnWidths(ws, cols);
  addHeaderRow(ws, cols);
  for (const s of data.newStudentsInPeriod) {
    ws.addRow([s.createdAt, s.maHV, s.name, s.phone, s.idNumber, s.licence,
               s.classCode, s.branchName, s.feePlanName, s.totalFee, s.paid, s.balance]);
  }
  applyDataFormats(ws, cols, 5);
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

function sheetActiveClasses(wb, data) {
  const ws = wb.addWorksheet('Lớp đang chạy');
  addBanner(ws, 'Lớp đang hoạt động', `${data.activeClasses.length} lớp đang trong giai đoạn đang diễn ra`);
  const cols = [
    { header: 'Mã lớp',     width: 22 },
    { header: 'Chi nhánh',  width: 16 },
    { header: 'Ngày mở',    width: 14 },
    { header: 'Ngày thi',   width: 14 },
    { header: 'Sĩ số',      width: 10, numFmt: INT_FMT },
  ];
  setColumnWidths(ws, cols);
  addHeaderRow(ws, cols);
  for (const c of data.activeClasses) {
    ws.addRow([c.code, c.branchName, c.openDate, c.examDate, c.enrolled]);
  }
  applyDataFormats(ws, cols, 5);
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

function sheetOutstanding(wb, data) {
  const ws = wb.addWorksheet('Công nợ');
  const total = data.outstandingStudents.reduce((a, s) => a + s.balance, 0);
  addBanner(ws, 'Học viên còn nợ', `${data.outstandingStudents.length} học viên · Tổng nợ: ${total.toLocaleString('en-US')}đ`);
  const cols = [
    { header: 'Mã HV',      width: 10 },
    { header: 'Họ tên',     width: 22 },
    { header: 'SĐT',        width: 14 },
    { header: 'Lớp',        width: 18 },
    { header: 'Chi nhánh',  width: 16 },
    { header: 'Tổng phí',   width: 14, numFmt: MONEY_FMT },
    { header: 'Đã thu',     width: 14, numFmt: MONEY_FMT },
    { header: 'Còn nợ',     width: 14, numFmt: MONEY_FMT },
    { header: 'Trạng thái', width: 12 },
  ];
  setColumnWidths(ws, cols);
  addHeaderRow(ws, cols);
  for (const s of data.outstandingStudents) {
    ws.addRow([s.maHV, s.name, s.phone, s.classCode, s.branchName,
               s.totalFee, s.paid, s.balance, s.paymentStatus]);
  }
  applyDataFormats(ws, cols, 5);
  fillTotalRow(ws, cols, ['', '', '', '', 'Tổng nợ', '', '', total, '']);
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

function sheetRentals(wb, data) {
  const ws = wb.addWorksheet('Cho thuê xe');
  const total = data.rentalsInPeriod.reduce((a, p) => a + p.amount, 0);
  addBanner(ws, 'Cho thuê xe trong kỳ',
    `${data.rentalsInPeriod.length} lượt thuê · Tổng thu: ${total.toLocaleString('en-US')}đ · Không tính vào doanh thu chính`);
  const cols = [
    { header: 'Thời điểm',  width: 18 },
    { header: 'Xe',         width: 22 },
    { header: 'Số xe',      width: 16 },
    { header: 'Bằng',       width: 8  },
    { header: 'Học viên',   width: 22 },
    { header: 'Mã HV',      width: 10 },
    { header: 'Số lượt',    width: 10, numFmt: INT_FMT },
    { header: 'Số tiền',    width: 16, numFmt: MONEY_FMT },
    { header: 'Hình thức',  width: 14 },
    { header: 'Nhân viên',  width: 18 },
    { header: 'Chi nhánh',  width: 16 },
  ];
  setColumnWidths(ws, cols);
  addHeaderRow(ws, cols);
  for (const p of data.rentalsInPeriod) {
    ws.addRow([p.createdAt, p.vehicleName || '', p.vehiclePlate || '', p.vehicleLicence || '',
               p.studentName || '', p.studentMaHV || '', p.rentalRounds || 0, p.amount,
               p.method, p.staffName || '', p.branchName || '']);
  }
  applyDataFormats(ws, cols, 5);
  fillTotalRow(ws, cols, ['', '', '', '', '', '', 'Tổng', total, '', '', '']);
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

function sheetAudit(wb, data) {
  const ws = wb.addWorksheet('Nhật ký');
  addBanner(ws, 'Nhật ký Sửa / Xóa / Thanh toán trong kỳ', `${data.auditLog.length} mục — chỉ ghi nhận thay đổi & giao dịch tài chính`);
  const cols = [
    { header: 'Thời điểm',  width: 18 },
    { header: 'Người dùng', width: 22 },
    { header: 'Vai trò',    width: 10 },
    { header: 'Hành động',  width: 26 },
    { header: 'Đối tượng',  width: 60 },
  ];
  setColumnWidths(ws, cols);
  addHeaderRow(ws, cols);
  for (const l of data.auditLog) {
    ws.addRow([l.at, l.userName || '(Hệ thống)', l.userRole || 'system', l.action, l.target || '']);
  }
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

// ---------------------------------------------------------------------------
export async function buildExcel(data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.company;
  wb.created = new Date();
  sheetBranchSummary(wb, data);
  sheetPayments(wb, data);
  sheetNewStudents(wb, data);
  sheetActiveClasses(wb, data);
  sheetOutstanding(wb, data);
  sheetRentals(wb, data);
  sheetAudit(wb, data);
  return wb.xlsx.writeBuffer();
}
