// src/utils/parseTimeString.js
export default function parseTimeString(str = "") {
  const parts = str.split(":").map(Number);
  if (parts.some(isNaN)) return null;              // malformed

  let h = 0, m = 0, s = 0;
  if (parts.length === 3)        [h, m, s] = parts;
  else if (parts.length === 2)   [m, s] = parts;
  else if (parts.length === 1)   [s]    = parts;

  /* anchor everything on 1970-01-01 so it’s a valid JS Date */
  return new Date(Date.UTC(1970, 0, 1, h, m, s));
}
