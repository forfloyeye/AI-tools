import { execSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const normalizedRoot = normalizePath(rootDir);
const projectMarker = normalizePath(path.join('frontend', 'ai-tools'));

const targets = [
  { port: 3000, label: '前端 Vite', markers: ['vite', projectMarker] },
  { port: 3001, label: '后端 Express', markers: ['server/index.ts', projectMarker] },
];

function normalizePath(value) {
  return value.replace(/\\/g, '/').toLowerCase();
}

function run(command) {
  try {
    return execSync(command, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (error) {
    const stdout = error && typeof error === 'object' && 'stdout' in error ? error.stdout : '';
    return typeof stdout === 'string' ? stdout.trim() : '';
  }
}

function getListeningPids(port) {
  if (process.platform === 'win32') {
    const output = run(`netstat -ano -p tcp | findstr LISTENING | findstr :${port}`);
    if (!output) return [];
    const pids = output
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts.length >= 5)
      .map((parts) => Number(parts[parts.length - 1]))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
    return [...new Set(pids)];
  }

  const output = run(`lsof -ti tcp:${port} -sTCP:LISTEN`);
  if (!output) return [];
  return [...new Set(output.split(/\r?\n/).map((item) => Number(item)).filter((pid) => Number.isInteger(pid) && pid > 0))];
}

function getCommandLine(pid) {
  if (process.platform === 'win32') {
    return run(`powershell -NoProfile -Command "$p = Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if ($p) { $p.CommandLine }"`);
  }

  return run(`ps -p ${pid} -o command=`);
}

function getProcessName(pid) {
  if (process.platform === 'win32') {
    const output = run(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
    if (!output || output.startsWith('INFO:')) return '';
    const firstField = output.split(',')[0] ?? '';
    return firstField.replace(/^"|"$/g, '').trim().toLowerCase();
  }

  return run(`ps -p ${pid} -o comm=`).toLowerCase();
}

function killPid(pid) {
  if (process.platform === 'win32') {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    return;
  }

  process.kill(pid, 'SIGTERM');
}

function ensurePortFree(target) {
  const pids = getListeningPids(target.port);
  if (pids.length === 0) return;

  for (const pid of pids) {
    const commandLine = normalizePath(getCommandLine(pid));
    const processName = getProcessName(pid);
    const isProjectProcess = target.markers.every((marker) => commandLine.includes(marker));
    const isNodeFallback = !commandLine && (processName === 'node.exe' || processName === 'node');

    if (!isProjectProcess && !isNodeFallback) {
      console.error(`端口 ${target.port} 已被其他进程占用，未自动处理。`);
      console.error(`进程 PID: ${pid}`);
      console.error(`命令: ${commandLine || '(无法读取命令行)'}`);
      process.exit(1);
    }

    console.log(`清理残留 ${target.label} 进程 PID=${pid}（端口 ${target.port}）`);
    killPid(pid);
  }
}

for (const target of targets) {
  ensurePortFree(target);
}
