// Lean in-memory store. Mirrors the slice of window.MGT_DATA that the
// ported screen-guest.jsx consumed:
//   D.currentUser, D.students, D.classes, D.TODAY, D._NOW
//   D.getClass(id), D.getStudent(id)
//   D.api.{createStudent,updateStudent,uploadStudentDoc,cccdQr,refreshMe,logout}
//
// Subscribers are bumped via a window event so components only re-render
// when data changes. This matches the original pattern so App.jsx's
// existing useReducer/useEffect bump pattern works unchanged.

import { api } from './api';
import { parseDT } from './formatters';

const accountsById = new Map();
const classesById  = new Map();
const studentsById = new Map();

const state = {
  currentUser: null,
  students: [],
  classes: [],
  TODAY: '',
  _NOW: new Date(),
};

function setToday(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  state.TODAY = `${dd}/${mm}/${d.getFullYear()}`;
  state._NOW = d;
}

function indexStudent(s) {
  s.createdAtMs = parseDT(s.createdAt);
  studentsById.set(s.id, s);
}

function bump() {
  try { window.dispatchEvent(new Event('mgt:datachanged')); } catch {}
}

// Boot: pull /me, /accounts, /classes, /students in parallel and seat
// them in the in-memory maps. Throws on 401 so LoginGate can catch and
// route to the login form.
export async function initStore() {
  const meRes = await api.me();
  const [accs, cls, students] = await Promise.all([
    api.listAccounts(),
    api.listClasses(),
    api.listStudents(),
  ]);

  for (const a of accs) accountsById.set(a.id, a);
  state.currentUser = accountsById.get(meRes.user.id) || meRes.user;

  state.classes = Array.isArray(cls) ? cls : [];
  classesById.clear();
  for (const c of state.classes) classesById.set(c.id, c);

  state.students = Array.isArray(students) ? students : [];
  studentsById.clear();
  for (const s of state.students) indexStudent(s);

  setToday(new Date());
}

// Re-pull /accounts + /classes — used when admin changes assignedClassId
// while the kiosk is open (Phase 1 wired this to the add-modal open).
async function refreshMe() {
  const [accs, cls] = await Promise.all([api.listAccounts(), api.listClasses()]);
  if (!Array.isArray(accs) || !Array.isArray(cls)) return;
  for (const a of accs) accountsById.set(a.id, a);
  if (state.currentUser) {
    state.currentUser = accountsById.get(state.currentUser.id) || state.currentUser;
  }
  state.classes = cls;
  classesById.clear();
  for (const c of cls) classesById.set(c.id, c);
  bump();
}

// Re-pull /students and re-seat the index. Used after create/update so
// the list view picks up the new row (including server-derived fields
// like maHV, createdAt, docs.*).
async function reloadStudents() {
  const fresh = await api.listStudents();
  state.students = Array.isArray(fresh) ? fresh : [];
  studentsById.clear();
  for (const s of state.students) indexStudent(s);
  bump();
}

export const D = {
  get currentUser() { return state.currentUser; },
  get students()    { return state.students; },
  get classes()     { return state.classes; },
  get TODAY()       { return state.TODAY; },
  get _NOW()        { return state._NOW; },

  getClass:   (id) => classesById.get(id),
  getStudent: (id) => studentsById.get(id),

  api: {
    // Match the create/update contracts the ported App.jsx expects:
    // createStudent({ form, docs }) — multipart docs uploaded after create.
    async createStudent(payload) {
      const form = payload?.form || payload;
      const docs = payload?.docs || {};
      const created = await api.createStudent(form);
      for (const [key, file] of Object.entries(docs)) {
        if (file) {
          try { await api.uploadStudentDoc(created.id, key, file); } catch (e) {
            // Surface upload failure to the caller; the student row is
            // already in the DB though, so partial failures need user attention.
            throw new Error(`upload_failed:${key}:${e.message}`);
          }
        }
      }
      await reloadStudents();
      return created;
    },
    async updateStudent(id, patch) {
      const updated = await api.updateStudent(id, patch);
      const idx = state.students.findIndex(s => s.id === id);
      if (idx >= 0) { state.students[idx] = updated; indexStudent(updated); }
      bump();
      return updated;
    },
    uploadStudentDoc: api.uploadStudentDoc,
    cccdQr:           api.cccdQr,
    refreshMe,
    logout: api.logout,
  },
};
