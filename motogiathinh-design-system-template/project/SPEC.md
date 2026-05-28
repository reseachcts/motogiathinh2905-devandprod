# MOTOGIATHINH — Product Spec

> Locale: **Vietnamese-first only.**
> Last updated per ContentAdmin reviews — locked rules below.

---

## 1. Tổ chức (Organization)

- **3 chi nhánh:** `331A QL1A`, `183 14/9`, `18C Phạm Hùng`
- Each branch has **2 nhân viên (staff)**.
- **1 admin (chủ)** total, overseeing all branches.
- Every học viên and every payment is handled by **any** nhân viên from
  any branch at any time. **Responsible staff is a REQUIRED field** —
  every record always carries the nhân viên who created/last-updated it.
- Admin can manage accounts and view per-account activity log.

### Roles & permissions

| Capability | Admin | Staff |
|---|---|---|
| Create / edit class | ✓ | ✗ |
| Change class status | ✓ | ✗ |
| Create / edit fee plan | ✓ | ✗ |
| Create / edit promotion | ✓ | ✗ |
| Create / edit teachers + vehicles | ✓ | ✗ |
| Create / edit student profile | ✓ | ✓ |
| Create / edit payment record | ✓ | ✓ |
| View dashboard (all branches) | ✓ | own branch only |
| Compare branches | ✓ | ✗ |
| Export dashboard (Excel/PDF) | ✓ | ✓ |
| Manage accounts | ✓ | ✗ |

---

## 2. Auth

- Role-based auth (Admin / Staff)
- Password self-reset via email
- Activity log per account (admin-visible from Tổ chức tab)

---

## 3. LOCKED RULES (per ContentAdmin)

These are decisions that override anything older in this file:

1. **Services / licences:** the company provides **only `A` and `A1`**.
   There is **no A2, no B1, no B2**, ever. Anywhere a licence dropdown
   appears, it must list **only** A and A1.
2. **Both A and A1 students share the same classes.** The class itself
   does not differentiate licences — only the exam does. Classes are
   named like `MÔ TÔ 05/2026` and host a mix of A & A1 students.
3. **No max capacity (sĩ số tối đa).** Classes have no upper limit and
   the UI must not show "30/30" style enrolment caps.
4. **No source-of-lead tracking.** The CRM does NOT identify whether a
   student came from a chatbot or a nhân viên. Drop `source` everywhere.
5. **No re-enroll / "thi lại" classification.** Failed-exam re-takes are
   not tracked as a separate status. Drop the `retake` flag everywhere.
6. **Responsible nhân viên is required.** Every student record always
   has a nhân viên assigned. The "Chưa phụ trách" filter is not needed.
7. **Money format:** `14,200,000đ` (comma thousand separators, lowercase
   `đ`, **no space** before đ).
8. **Mã HV format:** `HV001`, `HV002`, … (zero-padded 3 digits).
9. **Payment status** is **banded** to exactly 3 values: `0%` / `50%` /
   `100%`, colored **red / yellow / green** respectively. There is no
   FULL / OVERDUE / WAIVED label — just the percentage.
10. **Hồ sơ status** displays as **a single right-aligned badge** —
    green tick (✓) when complete, red exclamation when incomplete. No
    "Đủ hồ sơ" / "Thiếu hồ sơ" word label in lists.
11. **Branches are renamed** (see §1).
12. **Giáo viên** and **Phương tiện** are **sub-tabs inside Tổ chức**,
    not top-level nav items.
13. **Class lifecycle has 3 statuses:** `đang mở`, `đang diễn ra`, `đã
    kết thúc`. Admin manually changes status. Closing locks edits.

---

## 4. Tabs (top-level nav)

1. **Tổng quan** — statistics-heavy dashboard
2. **Học viên** — list view
3. **Thanh toán** — list view
4. **Lớp học** — grid card view
5. **Thông báo** — outstanding cases
6. **Tổ chức** — branches, accounts, fees, promotions, **giáo viên**,
   **phương tiện**, activity log

---

## 5. Tab specs

### 5.1 Tổng quan / Dashboard

- **Filters:** by chi nhánh, by time range (today / 7 days / 30 days /
  YTD), by bằng (A / A1 — no other options).
- **KPIs:** Đã thu hôm nay (green), HV mới hôm nay, Đang nợ (red),
  Học viên active.
- **Two line charts:**
  1. **DOANH THU** — 3 lines:
     - **Tổng** = Đã nhận + Còn nợ
     - **Đã nhận**
     - **Còn nợ**
     - Numbers must accurately reflect the mock payments + students.
  2. **HỌC VIÊN** — 3 lines:
     - **Tổng** = A + A1
     - **A**
     - **A1**
     - Reflects true mock student registration data over time.
- **Branch comparison** (admin only).
- **Export:** Excel + PDF.

### 5.2 Học viên / Students (list)

Columns (left → right):
1. **ID**       — short, e.g. `hv-001`
2. **Mã HV**     — formatted, e.g. `HV001`
3. **Học viên** — name + phone
4. **Bằng**      — A or A1
5. **Lớp**       — full name, e.g. `MÔ TÔ 05/2026` (never truncated)
6. **Thanh toán** — small snug 0% / 50% / 100% chip (red / yellow / green)
7. **Nhân viên** — pushed to the right as lowest priority. Value is one
   of `Nhân viên 1` … `Nhân viên 6`.
8. **Hồ sơ**     — right-end badge only: green ✓ or red ❗

Top toolbar:
- Single filter chip: `Thiếu hồ sơ` (the rest were removed)
- Search
- `+ Thêm học viên`

### 5.3 Học viên — detail

- Top section: name, big.
- Sub-tab pill switch: **Thông tin** / **Thanh toán**
- Thông tin tab: basic info, 4 doc slots (CCCD, GKSK, Đơn đề nghị,
  Thẻ 3×4). OCR auto-fills from CCCD drop.
- Thanh toán tab: payment history.

### 5.4 Thanh toán / Payments (list)

- 3 hero KPIs: Đã thu hôm nay, Chờ đóng đợt 2, Quá hạn.
- Columns: Học viên · **Lớp (full name)** · Hình thức · Tổng học phí ·
  Đã thu · Còn lại · **Nhân viên (rightmost data col)** · Trạng thái
  (small snug 0/50/100%).
- Click row → Payment detail.

### 5.5 Lớp học / Classes (grid)

- Grid of cards. Each card: class code (full), bằng (A & A1 mixed),
  ngày mở, ngày thi, sĩ số (current count only — **no max**), status.
- 3 status filters: đang mở · đang diễn ra · đã kết thúc.
- Admin: `+ Tạo lớp` and status switcher in detail.

### 5.6 Lớp học — detail

- Class header + status switcher.
- Lightweight student list: Học viên · SĐT · Thanh toán · Hồ sơ-badge.
- Click row → Student detail.

### 5.7 Thông báo

- List of outstanding cases (mostly payment).
- Bulk actions: mark all read, delete selected.

### 5.8 Tổ chức

Sub-tabs (pill-switch inside the tab):
1. **Chi nhánh** — 3 branches
2. **Tài khoản** — 7 accounts (admin + 6 staff)
3. **Học phí** — 2 records: A (1,995,000đ), A1 (565,000đ)
4. **Khuyến mãi** — 3 records: KHÔNG (0đ · A/A1), Liên kết (200,000đ ·
   A/A1), HSSV (500,000đ · A only)
5. **Giáo viên** — Thầy Nguyên, Thầy Huy
6. **Phương tiện** — Wave (A1), CB250 (A), Vespa 300 (A)
7. **Nhật ký** — activity log

---

## 6. Core data model

### Fee plans

| Tên  | Bằng | Số tiền |
|---|---|---|
| A    | A    | 1,995,000đ |
| A1   | A1   | 565,000đ   |

### Promotions

| Tên     | Áp dụng | Giảm |
|---|---|---|
| KHÔNG   | A · A1  | 0đ |
| Liên kết| A · A1  | 200,000đ |
| HSSV    | A       | 500,000đ |

### Student profile creation rule

When creating a student profile, user **MUST** pick:
- **Học phí** from dropdown (A or A1 only)
- **Khuyến mãi** from dropdown filtered to plans matching the chosen
  bằng (no free-typing)
- **Lớp** from dropdown of `đang mở` classes
- **Nhân viên phụ trách** is required

`totalFee = Học phí.amount − Khuyến mãi.discount`
`balance  = totalFee − sum(payments)`

Default state on profile creation (no payment yet):
- `paid = 0`, `balance = totalFee`, `paymentStatus = "0%"`

### Payment record CRUD

- Recording a payment is a separate action from creating the profile.
- Fields: id, studentId, amount, method, bienLaiId, bienLaiPhoto,
  staffId, branchId, createdAt.
- On save, system auto-updates the student's `paid`, `balance`, and
  `paymentStatus`:
  - paid == 0       → `0%`
  - 0 < paid < total → `50%`
  - paid >= total   → `100%`

### Profile completeness badge

- **Green ✓** — all 4 docs filled AND all required text fields populated
- **Red ❗** — anything missing

---

## 7. User flow (the demo)

1. **Admin** → Lớp học → `+ Tạo lớp` → enters `MÔ TÔ 06/2026`. Class
   card appears with status `Đang mở`, sĩ số 0.
2. **Staff** receives a new student and 4 photos.
3. Staff → Học viên → `+ Thêm học viên`.
4. Drag CCCD photo into CCCD slot → OCR auto-fills Họ tên, Giới tính,
   Ngày sinh, Số CCCD, Địa chỉ.
5. Drag GKSK / Đơn / 3×4 into their slots. Save → ❗ red badge if any
   field still missing.
6. Pick Học phí (A or A1) + Khuyến mãi from dropdowns. Save → ✓ green
   badge.
7. Staff prints biên lai from a separate app, hands to student.
8. Staff → Thanh toán → `+ Ghi nhận thanh toán` → student ID, amount,
   biên lai ID. Save.
9. Student profile auto-updates `paymentStatus` (0% → 50% or 100%).
10. **Partial branch:** student brings 200,000đ vs 565,000đ fee →
    record 200,000đ → balance becomes 365,000đ → status 0% → 50% →
    notification fires before exam → staff calls → second record →
    status flips to 100%.

---

## 8. Open questions

- Class status transitions: admin-only manual (current) or auto by date?
- Should partial payments display the exact percentage (e.g. 33.7%) or
  remain banded (0 / 50 / 100)? **Currently banded per lock §3.9.**
