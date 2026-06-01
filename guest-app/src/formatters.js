// Display formatters — moved out of the data-loader's window.* injections
// and into a real module. Behaviour matches the original verbatim.

export const digitsOnly = (s) => String(s || '').replace(/\D+/g, '');

// VN mobile phone — canonical 10 digits, rendered `xxx xxx xxxx`.
// Partial-build formatting so the mask appears WHILE the user is typing.
export const fmtPhone = (s) => {
  const d = digitsOnly(s).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + ' ' + d.slice(3);
  return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
};

// VN CCCD — canonical 12 digits, rendered `xxx xxx xxx xxx`.
export const fmtCCCD = (s) => {
  const d = digitsOnly(s).slice(0, 12);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + ' ' + d.slice(3);
  if (d.length <= 9) return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
  return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6, 9) + ' ' + d.slice(9);
};

// Date — `dd/mm/yyyy` built from raw digits.
export const fmtDateInput = (s) => {
  const d = digitsOnly(s).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
  return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
};

// dd/mm/yyyy [HH:MM:SS] → ms-epoch. Used by the store to derive createdAtMs.
export function parseDT(s) {
  if (!s) return 0;
  const [d, m, y, hh = 0, mm = 0, ss = 0] = s.trim().split(/[\/\s:]/).map(n => parseInt(n, 10));
  return new Date(y, m - 1, d, hh, mm, ss).getTime();
}
