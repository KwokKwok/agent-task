import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  commandMocks,
  listTasksMock,
  initDbMock,
  infoMock,
  successMock,
  errorMock,
  ensureTokenMock,
  getTokenMock,
  resetTokenMock,
  createSessionCookieMock,
  clearPidInfoMock,
  isProcessAliveMock,
  readPidInfoMock,
  writePidInfoMock,
  getBindConfigMock,
  getPublicUrlMock,
  readWebuiConfigMock,
  setWebuiConfigMock,
  getSystemLogPathMock,
  readSystemLogsMock,
  fetchMock,
  spawnMock,
  execFileSyncMock,
} = vi.hoisted(() => ({
  commandMocks: {},
  listTasksMock: vi.fn(),
  initDbMock: vi.fn(),
  infoMock: vi.fn(),
  successMock: vi.fn(),
  errorMock: vi.fn(),
  ensureTokenMock: vi.fn(),
  getTokenMock: vi.fn(),
  resetTokenMock: vi.fn(),
  createSessionCookieMock: vi.fn(),
  clearPidInfoMock: vi.fn(),
  isProcessAliveMock: vi.fn(),
  readPidInfoMock: vi.fn(),
  writePidInfoMock: vi.fn(),
  getBindConfigMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
  readWebuiConfigMock: vi.fn(),
  setWebuiConfigMock: vi.fn(),
  getSystemLogPathMock: vi.fn(),
  readSystemLogsMock: vi.fn(),
  fetchMock: vi.fn(),
  spawnMock: vi.fn(),
  execFileSyncMock: vi.fn(),
}));

vi.stubGlobal('fetch', fetchMock);

vi.mock('../lib/task.js', () => ({
  getTask: vi.fn(),
  listTasks: listTasksMock,
}));

vi.mock('../lib/db.js', () => ({
  initDb: initDbMock,
}));

vi.mock('../lib/format.js', () => ({
  error: errorMock,
  info: infoMock,
  success: successMock,
}));

vi.mock('../lib/webui/token-store.js', () => ({
  ensureToken: ensureTokenMock,
  getToken: getTokenMock,
  resetToken: resetTokenMock,
}));

vi.mock('../lib/webui/auth.js', () => ({
  createSessionCookie: createSessionCookieMock,
}));

vi.mock('../lib/webui/pid-store.js', () => ({
  clearPidInfo: clearPidInfoMock,
  isProcessAlive: isProcessAliveMock,
  readPidInfo: readPidInfoMock,
  writePidInfo: writePidInfoMock,
}));

vi.mock('../lib/webui/config-store.js', () => ({
  getBindConfig: getBindConfigMock,
  getPublicUrl: getPublicUrlMock,
  readWebuiConfig: readWebuiConfigMock,
  setWebuiConfig: setWebuiConfigMock,
}));

vi.mock('../lib/webui/system-log.js', () => ({
  getSystemLogPath: getSystemLogPathMock,
  readSystemLogs: readSystemLogsMock,
}));

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
  execFileSync: execFileSyncMock,
}));

function makeCommandChain(name) {
  return {
    name,
    subcommands: {},
    description() { return this; },
    option() { return this; },
    requiredOption() { return this; },
    action(fn) { this._action = fn; return this; },
    command(subName) {
      const sub = makeCommandChain(subName);
      this.subcommands[subName] = sub;
      return sub;
    },
  };
}

function buildProgram() {
  const root = makeCommandChain('root');
  return {
    command(name) {
      const cmd = makeCommandChain(name);
      commandMocks[name] = cmd;
      return cmd;
    },
    root,
  };
}

describe('webui command registration', () => {
  beforeEach(() => {
    Object.keys(commandMocks).forEach((key) => delete commandMocks[key]);
    listTasksMock.mockReset();
    initDbMock.mockReset();
    infoMock.mockReset();
    successMock.mockReset();
    errorMock.mockReset();
    ensureTokenMock.mockReset();
    getTokenMock.mockReset();
    resetTokenMock.mockReset();
    createSessionCookieMock.mockReset();
    clearPidInfoMock.mockReset();
    isProcessAliveMock.mockReset();
    readPidInfoMock.mockReset();
    writePidInfoMock.mockReset();
    getBindConfigMock.mockReset();
    getPublicUrlMock.mockReset();
    readWebuiConfigMock.mockReset();
    setWebuiConfigMock.mockReset();
    getSystemLogPathMock.mockReset();
    readSystemLogsMock.mockReset();
    fetchMock.mockReset();
    spawnMock.mockReset();
    execFileSyncMock.mockReset();

    listTasksMock.mockReturnValue([]);
    ensureTokenMock.mockReturnValue('token-123');
    getTokenMock.mockReturnValue('token-123');
    resetTokenMock.mockReturnValue('token-456');
    createSessionCookieMock.mockReturnValue('session=cookie');
    getBindConfigMock.mockReturnValue({ host: '127.0.0.1', port: 3333 });
    getPublicUrlMock.mockReturnValue('');
    readWebuiConfigMock.mockReturnValue({});
    readSystemLogsMock.mockReturnValue({ items: [] });
    getSystemLogPathMock.mockReturnValue('/tmp/system.log');
    execFileSyncMock.mockReturnValue('');
  });

  it('registers webui command tree', async () => {
    const program = buildProgram();
    const mod = await import('../lib/commands/webui.js');
    mod.default(program);

    expect(commandMocks.webui).toBeTruthy();
    expect(commandMocks.webui.subcommands.start).toBeTruthy();
    expect(commandMocks.webui.subcommands.status).toBeTruthy();
    expect(commandMocks.webui.subcommands.logs).toBeTruthy();
  });

  it('status recovers runtime when pid file is missing but server responds', async () => {
    const printed = [];
    const originalLog = console.log;
    console.log = (...args) => printed.push(args.join(' '));

    try {
      readPidInfoMock.mockReturnValue(null);
      isProcessAliveMock.mockImplementation((pid) => Number(pid) === 4321);
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          pid: 4321,
          host: '127.0.0.1',
          port: 3333,
          startedAt: '2026-04-03T16:00:00.000Z',
        }),
      });

      const program = buildProgram();
      const mod = await import('../lib/commands/webui.js');
      mod.default(program);

      await commandMocks.webui.subcommands.status._action();

      expect(successMock).toHaveBeenCalledWith('WebUI status: running');
      expect(writePidInfoMock).toHaveBeenCalledWith({
        pid: 4321,
        host: '127.0.0.1',
        port: 3333,
        startedAt: '2026-04-03T16:00:00.000Z',
        url: 'http://127.0.0.1:3333',
      });
      expect(printed.some((line) => line.includes('Bind Port:  3333'))).toBe(true);
    } finally {
      console.log = originalLog;
    }
  });

  it('status reports stopped when runtime probe fails', async () => {
    readPidInfoMock.mockReturnValue(null);
    fetchMock.mockResolvedValue({ ok: false });

    const program = buildProgram();
    const mod = await import('../lib/commands/webui.js');
    mod.default(program);

    await commandMocks.webui.subcommands.status._action();

    expect(infoMock).toHaveBeenCalledWith('WebUI status: stopped');
    expect(successMock).not.toHaveBeenCalled();
  });

  it('start accepts --url and persists runtime config before launch', async () => {
    const child = {
      pid: 9876,
      unref: vi.fn(),
    };

    readPidInfoMock.mockReturnValue(null);
    isProcessAliveMock.mockImplementation((pid) => Number(pid) === 9876);
    setWebuiConfigMock.mockImplementation((input) => ({
      host: input.host,
      port: input.port,
      publicUrl: input.publicUrl,
    }));
    getPublicUrlMock.mockReturnValue('https://task.example.com');
    fetchMock
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pid: 9876,
          host: '0.0.0.0',
          port: 4444,
          startedAt: '2026-04-06T10:00:00.000Z',
        }),
      });
    spawnMock.mockReturnValue(child);

    const program = buildProgram();
    const mod = await import('../lib/commands/webui.js');
    mod.default(program);

    await commandMocks.webui.subcommands.start._action({
      host: '0.0.0.0',
      port: '4444',
      url: 'https://task.example.com',
      resetToken: false,
    });

    expect(initDbMock).toHaveBeenCalled();
    expect(setWebuiConfigMock).toHaveBeenCalledWith({
      host: '0.0.0.0',
      port: 4444,
      publicUrl: 'https://task.example.com',
    });
    expect(spawnMock).toHaveBeenCalled();
    expect(child.unref).toHaveBeenCalled();
  });

});
