// scripts/run-full-audit.ts
import { spawn } from 'child_process';
import waitOn from 'wait-on';
import path from 'path';
import { execSync } from 'child_process';

async function startDevServer() {
  const proc = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  // Wait for health endpoint instead of parsing stdout
  await waitOn({ resources: ['http-get://localhost:3000/api/health'], timeout: 120000, interval: 3000, log: true });
  return proc.pid!;
}

async function main() {
  console.log('🚀 Starting dev server...');
  const pid = await startDevServer();
  console.log(`✅ Dev server PID: ${pid}`);
  // wait for health endpoint
  await waitOn({ resources: ['http-get://localhost:3000/api/health'], timeout: 120000, interval: 3000, log: true });
  console.log('🟢 Server is healthy, running Playwright tests...');
  try {
    execSync('npx playwright test tests/e2e/full-audit.spec.ts --reporter=list', { stdio: 'inherit' });
    console.log('✅ Playwright tests passed');
  } catch (e) {
    console.error('❌ Playwright tests failed');
    process.exit(1);
  } finally {
    // kill dev server
    process.kill(pid, 'SIGTERM');
    console.log('🛑 Dev server stopped');
  }
}

main();
