// smoke-test.js — simulates what the browser's data-loader.js does, then
// hits the write endpoints and verifies in-memory patching would work.
// Run after `node server.js` is up on PORT.

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:3001';

let cookieJar = '';
async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', cookie: cookieJar, ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookieJar = setCookie.split(';')[0];
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}: ${JSON.stringify(body)}`);
  return body;
}

const assert = (cond, msg) => { if (!cond) { console.error('  ✗', msg); process.exit(1); } else console.log('  ✓', msg); };

(async () => {
  console.log('1. health');
  const h = await api('/api/health');
  assert(h.ok === true, 'health ok');

  console.log('2. login');
  const login = await api('/api/auth/login', { method: 'POST', body: { email: 'thinh@motogiathinh.vn', password: 'changeme' } });
  assert(login.user.role === 'admin', 'logged in as admin');
  assert(typeof login.user.active === 'boolean', 'active coerced to boolean');

  console.log('3. parallel entity dump (browser boot equivalent)');
  const [branches, accounts, feePlans, promos, teachers, vehicles, classes, students, payments, notifs, log, docs] = await Promise.all([
    api('/api/branches'), api('/api/accounts'), api('/api/fee-plans'), api('/api/promotions'),
    api('/api/teachers'), api('/api/vehicles'), api('/api/classes'), api('/api/students'),
    api('/api/payments'), api('/api/notifications'), api('/api/activity-log'),
    api('/api/constants/profile-docs'),
  ]);
  // Use lower-bound thresholds rather than exact counts so the smoke test
  // doesn't flake when prior e2e / write-flow runs add to the seeded DB.
  assert(branches.length >= 3, `branches=${branches.length}`);
  assert(students.length >= 1208, `students=${students.length}`);
  assert(payments.length >= 1332, `payments=${payments.length}`);
  assert(classes.length >= 167, `classes=${classes.length}`);
  assert(docs.length === 4, `profile docs=${docs.length}`);
  assert(typeof students[0].docs_cccd === 'boolean', 'student docs_cccd is bool');
  assert(typeof payments[0].bienLaiPhoto === 'boolean', 'payment bienLaiPhoto is bool');
  assert(promos[0].appliesTo_csv !== undefined, 'promotions have appliesTo_csv (frontend splits)');

  console.log('4. derived fields would match (sample sanity)');
  const s = students[0];
  const sPays = payments.filter(p => p.studentId === s.id);
  const paid = sPays.reduce((a, b) => a + b.amount, 0);
  const expectedStatus = paid <= 0 ? '0%' : paid >= s.totalFee ? '100%' : '50%';
  console.log(`     ${s.maHV} ${s.name}: totalFee=${s.totalFee} paid=${paid} expected=${expectedStatus}`);

  console.log('5. write: create class (admin only)');
  const newClass = await api('/api/classes', { method: 'POST', body: {
    code: 'SMOKE-TEST', branchId: 'br-1', openDate: '01/06/2026', examDate: '15/06/2026',
  }});
  assert(newClass.id && newClass.id.startsWith('cls-'), `new class id=${newClass.id}`);

  console.log('6. write: create student');
  const newStudent = await api('/api/students', { method: 'POST', body: {
    form: {
      name: 'Smoke Test Student', gender: 'Nam', dob: '01/01/2000', idNumber: '999999999999',
      address: '123 Test St', phone: '0900000000', queQuan: 'Test', ngayCapCCCD: '01/01/2020',
      noiCapCCCD: 'Test', classId: newClass.id, licence: 'A', feePlanId: 'fee-a',
      promotionId: 'promo-none', responsibleStaffId: 'u-admin',
    },
    docs: { cccd: true, gksk: false, donDeNghi: false, the3x4: false },
    profileComplete: false,
  }});
  assert(newStudent.maHV.startsWith('HV'), `new student maHV=${newStudent.maHV}`);
  assert(newStudent.branchId === 'br-1', 'student branchId derived from class');

  console.log('7. write: create payment for that student');
  const newPay = await api('/api/payments', { method: 'POST', body: {
    studentId: newStudent.id, amount: 500000, method: 'Tiền mặt', bienLaiPhoto: false,
  }});
  assert(newPay.id.startsWith('PMT-'), `new payment id=${newPay.id}`);
  assert(newPay.bienLaiId.startsWith('BL-'), `bienLaiId auto-generated: ${newPay.bienLaiId}`);
  assert(newPay.branchId === 'br-1', 'payment branchId mirrored from student');

  console.log('8. cleanup: PATCH student (mark profile complete)');
  const patched = await api(`/api/students/${encodeURIComponent(newStudent.id)}`, { method: 'PATCH', body: { profileComplete: true } });
  assert(patched.profileComplete === true, 'profileComplete patched');

  console.log('\n✓ all checks passed');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
