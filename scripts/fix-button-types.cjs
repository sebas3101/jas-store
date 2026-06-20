const fs = require('fs');
const path = require('path');

function addButtonTypes(content) {
  let result = '';
  let i = 0;
  while (i < content.length) {
    if (content.startsWith('<button', i)) {
      const nextCh = content[i + 7];
      if (nextCh === ' ' || nextCh === '\n' || nextCh === '\r' || nextCh === '\t') {
        let j = i + 7;
        let depth = 0;
        let inString = false;
        let stringChar = '';
        let closingGt = -1;

        while (j < content.length) {
          const ch = content[j];
          const prev = content[j - 1];
          if (inString) {
            if (ch === stringChar && prev !== '\\') inString = false;
          } else if (ch === '"' || ch === "'" || ch === '`') {
            inString = true;
            stringChar = ch;
          } else if (ch === '{') {
            depth++;
          } else if (ch === '}') {
            depth--;
          } else if (ch === '>' && depth === 0 && prev !== '=') {
            closingGt = j;
            break;
          }
          j++;
        }

        if (closingGt !== -1) {
          const attrs = content.slice(i + 7, closingGt);
          if (/\bonClick\b/.test(attrs) && !/\btype\s*=/.test(attrs)) {
            result += '<button' + attrs + ' type="button">';
          } else {
            result += content.slice(i, closingGt + 1);
          }
          i = closingGt + 1;
          continue;
        }
      }
    }
    result += content[i];
    i++;
  }
  return result;
}

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
    else if (f.endsWith('.tsx')) files.push(full);
  }
  return files;
}

const files = walk('src/pages').concat(walk('src/components'));
let totalChanged = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const fixed = addButtonTypes(original);
  if (fixed !== original) {
    fs.writeFileSync(file, fixed, 'utf8');
    const before = (original.match(/type="button"/g) || []).length;
    const after  = (fixed.match(/type="button"/g) || []).length;
    const added  = after - before;
    if (added > 0) {
      console.log(path.relative('src', file) + ': +' + added);
      totalChanged += added;
    }
  }
}
console.log('\nTotal: ' + totalChanged + ' type="button" agregados');
