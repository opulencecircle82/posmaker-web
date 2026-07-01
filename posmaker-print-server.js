/**
 * POSMaker Local Print Server
 * Run once on the cashier PC: node posmaker-print-server.js
 * Sends raw ESC/POS commands directly to the thermal printer.
 * Cashier page auto-detects it at http://localhost:7788
 */

const http = require('http');
const { execSync } = require('child_process');
const os   = require('os');
const fs   = require('fs');
const path = require('path');

const PORT         = 7788;
const PRINTER_NAME = 'POS-58 11.2.0.0';
const LINE_WIDTH   = 32;

// ── ESC/POS receipt builder ────────────────────────────────────────────────────
function buildEscPos(r) {
  const W = LINE_WIDTH;
  const chunks = [];

  function safe(s) {
    return String(s || '').replace(/₱/g, 'P').replace(/[^\x20-\x7E]/g, '?');
  }
  function enc(s)  { return Buffer.from(safe(s), 'latin1'); }
  function line(s) { return Buffer.concat([enc(s), Buffer.from([0x0A])]); }
  function div()   { return line('-'.repeat(W)); }
  function pad(l, r) {
    const g = W - l.length - r.length;
    return l + ' '.repeat(Math.max(1, g)) + r;
  }

  const store  = safe(r.store  || 'POSMaker').substring(0, W);
  const footer = safe(r.footer || 'Thank you!').substring(0, W);
  const time   = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
  const date   = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  chunks.push(Buffer.from([0x1B, 0x40]));            // Init
  chunks.push(Buffer.from([0x1B, 0x61, 0x01]));      // Center
  chunks.push(Buffer.from([0x1B, 0x21, 0x10]));      // Double height
  chunks.push(line(store));
  chunks.push(Buffer.from([0x1B, 0x21, 0x00]));      // Normal
  chunks.push(Buffer.from([0x1B, 0x61, 0x00]));      // Left
  chunks.push(div());
  chunks.push(line(date + '  ' + time));
  chunks.push(line('Order #' + safe(r.order_id)));
  chunks.push(line('Cashier: ' + safe(r.cashier)));
  if (r.orderType) chunks.push(line('Type: ' + safe(r.orderType) + (r.tableNo ? ' | ' + safe(r.tableNo) : '')));
  chunks.push(div());

  for (var i = 0; i < (r.items || []).length; i++) {
    var item  = r.items[i];
    var qty   = parseFloat(item.qty   || 1);
    var price = parseFloat(item.price || 0);
    chunks.push(line(safe(item.name).substring(0, W)));
    chunks.push(line('  ' + qty + ' x P' + price.toFixed(2) + ' = P' + (qty * price).toFixed(2)));
  }

  chunks.push(div());
  chunks.push(line(pad('Subtotal:', 'P' + parseFloat(r.sub  || 0).toFixed(2))));
  if (parseFloat(r.disc || 0) > 0)
    chunks.push(line(pad('Discount:', '-P' + parseFloat(r.disc).toFixed(2))));
  chunks.push(line(pad('VAT (12%):', 'P' + parseFloat(r.tax  || 0).toFixed(2))));
  chunks.push(Buffer.from([0x1B, 0x45, 0x01]));      // Bold ON
  chunks.push(line(pad('TOTAL:', 'P' + parseFloat(r.total || 0).toFixed(2))));
  chunks.push(Buffer.from([0x1B, 0x45, 0x00]));      // Bold OFF

  if (r.method === 'Cash') {
    chunks.push(line(pad('Cash:',   'P' + parseFloat(r.tender || 0).toFixed(2))));
    chunks.push(line(pad('Change:', 'P' + parseFloat(r.change || 0).toFixed(2))));
  } else {
    chunks.push(line(pad('Paid via:', safe(r.method || 'GCash'))));
  }

  chunks.push(div());
  chunks.push(Buffer.from([0x1B, 0x61, 0x01]));      // Center
  chunks.push(line(footer));
  chunks.push(Buffer.from([0x1B, 0x61, 0x00]));      // Left
  chunks.push(Buffer.from([0x0A, 0x0A, 0x0A]));      // Feed 3 lines
  chunks.push(Buffer.from([0x1D, 0x56, 0x41, 0x03]));// Full cut

  return Buffer.concat(chunks);
}

// ── Send raw bytes via Windows Print API (writes PS1 to temp file) ─────────────
function sendToPrinter(printerName, data) {
  var ts     = Date.now();
  var tmpPrn = path.join(os.tmpdir(), 'pm_' + ts + '.prn');
  var tmpPs1 = path.join(os.tmpdir(), 'pm_' + ts + '.ps1');

  fs.writeFileSync(tmpPrn, data);

  // Write PS1 to file to avoid here-string / quoting issues
  // DOC_INFO_1 for StartDocPrinter level=1 has NO cbSize — just 3 LPWSTR pointers (24 bytes on 64-bit)
  // pDatatype must be NULL (the driver rejects "RAW", "TEXT", etc.)
  var prnPath = tmpPrn.replace(/\\/g, '/');
  var ps1 = [
    "$bytes = [System.IO.File]::ReadAllBytes('" + prnPath + "')",
    "Add-Type -TypeDefinition @'",
    "using System;using System.Runtime.InteropServices;",
    "public class PMPrint {",
    "  [DllImport(\"winspool.drv\",CharSet=CharSet.Unicode,SetLastError=true)]",
    "  public static extern bool OpenPrinter(string n,out IntPtr h,IntPtr d);",
    "  [DllImport(\"winspool.drv\",SetLastError=true)]",
    "  public static extern int StartDocPrinter(IntPtr h,int level,IntPtr pDocInfo);",
    "  [DllImport(\"winspool.drv\",SetLastError=true)]",
    "  public static extern bool StartPagePrinter(IntPtr h);",
    "  [DllImport(\"winspool.drv\",SetLastError=true)]",
    "  public static extern bool WritePrinter(IntPtr h,byte[] buf,int len,out int written);",
    "  [DllImport(\"winspool.drv\",SetLastError=true)]",
    "  public static extern bool EndPagePrinter(IntPtr h);",
    "  [DllImport(\"winspool.drv\",SetLastError=true)]",
    "  public static extern bool EndDocPrinter(IntPtr h);",
    "  [DllImport(\"winspool.drv\",SetLastError=true)]",
    "  public static extern bool ClosePrinter(IntPtr h);",
    "}",
    "'@",
    "$h = [IntPtr]::Zero",
    "[PMPrint]::OpenPrinter(\"" + printerName + "\", [ref]$h, [IntPtr]::Zero) | Out-Null",
    "if ($h -eq [IntPtr]::Zero) { Write-Host 'ERR:OpenPrinter'; exit 1 }",
    "$pDoc  = [System.Runtime.InteropServices.Marshal]::AllocHGlobal(24)",
    "$pName = [System.Runtime.InteropServices.Marshal]::StringToHGlobalUni('Receipt')",
    "[System.Runtime.InteropServices.Marshal]::WriteIntPtr($pDoc,  0, $pName)",
    "[System.Runtime.InteropServices.Marshal]::WriteIntPtr($pDoc,  8, [IntPtr]::Zero)",
    "[System.Runtime.InteropServices.Marshal]::WriteIntPtr($pDoc, 16, [IntPtr]::Zero)",
    "$jobId   = [PMPrint]::StartDocPrinter($h, 1, $pDoc)",
    "$e1      = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()",
    "[PMPrint]::StartPagePrinter($h) | Out-Null",
    "$written = 0",
    "[PMPrint]::WritePrinter($h, $bytes, $bytes.Length, [ref]$written) | Out-Null",
    "[PMPrint]::EndPagePrinter($h)  | Out-Null",
    "[PMPrint]::EndDocPrinter($h)   | Out-Null",
    "[PMPrint]::ClosePrinter($h)    | Out-Null",
    "[System.Runtime.InteropServices.Marshal]::FreeHGlobal($pDoc)",
    "[System.Runtime.InteropServices.Marshal]::FreeHGlobal($pName)",
    "Write-Host \"job:$jobId e1:$e1 written:$written\""
  ].join('\r\n');

  fs.writeFileSync(tmpPs1, ps1, 'utf8');

  try {
    var result = execSync(
      'powershell -NonInteractive -NoProfile -File "' + tmpPs1 + '"',
      { timeout: 15000, encoding: 'utf8' }
    );
    try { fs.unlinkSync(tmpPrn); fs.unlinkSync(tmpPs1); } catch(_) {}
    return result.trim();
  } catch (e) {
    try { fs.unlinkSync(tmpPrn); fs.unlinkSync(tmpPs1); } catch(_) {}
    throw new Error(e.stderr || e.stdout || e.message);
  }
}

// ── HTTP Server ────────────────────────────────────────────────────────────────
var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, printer: PRINTER_NAME }));
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try {
        var receipt = JSON.parse(body);
        var escData = buildEscPos(receipt);
        var result  = sendToPrinter(PRINTER_NAME, escData);
        console.log('[PRINT] ' + new Date().toLocaleTimeString() + ' — ' + result);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, result: result }));
      } catch (e) {
        console.error('[ERROR] ' + e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', function() {
  console.log('');
  console.log('  POSMaker ESC/POS Print Server');
  console.log('  ─────────────────────────────────────');
  console.log('  Running:  http://localhost:' + PORT);
  console.log('  Printer:  ' + PRINTER_NAME);
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
