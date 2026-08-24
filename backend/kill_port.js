const { execSync } = require('child_process');
try {
  const out = execSync('netstat -ano | findstr :8085', { encoding: 'utf8' });
  const lines = out.trim().split('\n');
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && !isNaN(pid) && pid !== '0') {
      try { execSync(`taskkill /F /PID ${pid}`); console.log('Killed PID', pid); } catch(e) {}
    }
  }
} catch (e) {
  console.log('No existing process on 8085');
}
