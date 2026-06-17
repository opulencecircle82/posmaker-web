const fs = require('fs');
const c = fs.readFileSync(__dirname + '/../dashboard-sarisari.html', 'utf-8').replace(/\r\n/g, '\n');

// Test individual parts of the regex
const r1 = /  html \+= `<div style=.background:var\(--s2\)/;
const r2 = /el\.innerHTML = html;\n  document\.getElementById\('rptDownload'\)\.style\.display = '';\n}/;

console.log('r1 match:', r1.test(c));
console.log('r2 match:', r2.test(c));

// Find what the end looks like
const endIdx = c.indexOf("el.innerHTML = html;");
if (endIdx !== -1) {
  console.log('end context:', JSON.stringify(c.slice(endIdx, endIdx + 100)));
}
