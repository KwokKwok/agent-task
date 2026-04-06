import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

const OPENCLAW_SERVICE_FILES = [
  'openclaw-gateway.service',
  'openclaw.service',
];

function splitPathEntries(value) {
  return String(value || '')
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasOpenClawExecutable(pathValue) {
  return splitPathEntries(pathValue)
    .some((dir) => existsSync(join(dir, 'openclaw')));
}

function extractPathFromServiceFile(filePath) {
  if (!existsSync(filePath)) return null;
  const lines = readFileSync(filePath, 'utf-8').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('Environment=')) continue;
    const body = trimmed.slice('Environment='.length);
    const match = body.match(/^"?PATH=(.+?)"?$/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function resolveOpenClawPathFallback() {
  const serviceDir = join(homedir(), '.config/systemd/user');
  for (const fileName of OPENCLAW_SERVICE_FILES) {
    const servicePath = join(serviceDir, fileName);
    const servicePathValue = extractPathFromServiceFile(servicePath);
    if (servicePathValue && hasOpenClawExecutable(servicePathValue)) {
      return servicePathValue;
    }
  }
  return null;
}

export function resolveOpenClawSpawnEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  if (hasOpenClawExecutable(env.PATH)) {
    return env;
  }

  const servicePath = resolveOpenClawPathFallback();
  if (!servicePath) {
    return env;
  }

  const merged = [
    ...splitPathEntries(servicePath),
    ...splitPathEntries(env.PATH),
  ];

  env.PATH = [...new Set(merged)].join(delimiter);
  return env;
}

export async function runOpenClawCommand(args, options = {}) {
  const env = resolveOpenClawSpawnEnv(options.env);

  return new Promise((resolve, reject) => {
    const child = spawn('openclaw', args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', reject);
    child.once('close', (code, signal) => {
      resolve({
        ok: code === 0,
        code: typeof code === 'number' ? code : null,
        signal: signal || null,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

export function sendAgentMessage({
  sessionId,
  agentId = 'main',
  message,
  thinking = 'off',
  timeoutSeconds = 1800,
}) {
  const args = [
    'agent',
    '--message',
    message,
    '--thinking',
    thinking || 'off',
    '--timeout',
    String(timeoutSeconds),
  ];

  if (String(sessionId || '').trim()) {
    args.splice(1, 0, '--session-id', String(sessionId).trim());
  } else if (String(agentId || '').trim()) {
    args.splice(1, 0, '--agent', String(agentId).trim());
  }

  return runOpenClawCommand(args);
}

export function restartGateway() {
  return runOpenClawCommand(['gateway', 'restart']);
}
