import fs from 'fs';
import path from 'path';

const target = path.resolve(process.cwd(), 'server', 'uploads');
const hit = (p) => {
  try {
    const rel = path.relative(target, path.resolve(p));
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch { return false; }
};

const wrap = (name) => {
  const orig = fs[name];
  fs[name] = function(...args) {
    const p = args[0];
    if (typeof p === 'string' && hit(p)) {
      console.trace(`[FS] ${name} -> ${p}`);
    }
    return orig.apply(this, args);
  };
};

[
  'writeFile','writeFileSync','createWriteStream','appendFile','appendFileSync',
  'open','openSync','mkdir','mkdirSync','copyFile','copyFileSync','rename','renameSync'
].forEach(wrap);
