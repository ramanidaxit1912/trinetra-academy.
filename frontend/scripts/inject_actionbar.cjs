const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'StudentDashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldBody = `    \`<!DOCTYPE html>`;

// Find exact old `<body>` open line (line 361 content)
const bodyOpen = `    <body>\n      <div class="head">`;
const actionBar = `    <body>\n      <!-- Sticky action toolbar – hidden on actual print -->\n      <div class="action-bar">\n        <span>📋 ત્રિનેત્ર એકેડેમી — Solution: \${sub.testName || ''}</span>\n        <button class="btn-dl btn-print" onclick="window.print()">🖨️ પ્રિન્ટ કરો</button>\n        <a class="btn-dl btn-download" id="dl-btn" href="#" download="Trinetra_Solution_\${(sub.student?.name || user?.name || 'Student').replace(/\\\\s+/g,'_')}_\${(sub.testName||'Test').replace(/\\\\s+/g,'_')}.html">📥 Download Solution</a>\n      </div>\n\n      <div class="head">`;

if (content.includes(bodyOpen)) {
  content = content.replace(bodyOpen, actionBar);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Action bar injected successfully!');
} else {
  // Print lines around where body should be so we can debug
  const lines = content.split('\n');
  const bodyLineIdx = lines.findIndex(l => l.includes('<body>'));
  console.log('body line idx:', bodyLineIdx);
  console.log('Lines around body:');
  lines.slice(bodyLineIdx - 1, bodyLineIdx + 5).forEach((l, i) => console.log(bodyLineIdx - 1 + i, JSON.stringify(l)));
}
