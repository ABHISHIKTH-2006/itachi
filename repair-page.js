const fs = require("fs");

const file = "app/page.tsx";

let source = fs.readFileSync(file, "utf8");

// Repair Markdown escaping that corrupted the TSX source.
source = source
  .replace(/\\([*])/g, "$1")
  .replace(/\\([<>`_])/g, "$1");

// Repair escaped JSX/template syntax if any double escaping remains.
source = source
  .replace(/\\\\</g, "<")
  .replace(/\\\\>/g, ">")
  .replace(/\\\\`/g, "`");

// Remove accidental escaped block-comment markers.
source = source
  .replace(/\/\\\*/g, "/*")
  .replace(/\\\*\//g, "*/");

// Normalize excessive blank lines created by the pasted markdown.
source = source.replace(/\n{4,}/g, "\n\n");

fs.writeFileSync(file, source, "utf8");

console.log("✅ ITACHI page.tsx repaired.");
console.log("📁 Backup: app/page-backup.tsx");
console.log("🚀 Restart your Next.js server now.");