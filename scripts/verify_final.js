const fs = require('fs');
const files = fs.readdirSync('.').filter(f => /^cashier.*\.html$/.test(f));
let allOk = true;
files.forEach(f => {
  const html = fs.readFileSync(f, 'utf-8');
  if (html.charCodeAt(0) === 0xFEFF) { allOk=false; console.log(f+': HAS BOM'); }
  if (!html.includes("src.startsWith('data:')?src:'data:image/jpeg;base64,'+src")) { allOk=false; console.log(f+': MISSING data-url fix'); }
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  scripts.forEach((m, i) => {
    try { new Function(m[1]); }
    catch(e) { allOk = false; console.log(f + ' script[' + i + ']: SYNTAX ERROR -> ' + e.message); }
  });
});
console.log(allOk ? 'ALL ' + files.length + ' CASHIER FILES: FIXED + VALID' : 'ISSUES FOUND');
