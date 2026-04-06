import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createTaskMock,
  getTaskMock,
  getTokenMock,
  readPidInfoMock,
  formatTaskMock,
  successMock,
  errorMock,
} = vi.hoisted(() => ({
  createTaskMock: vi.fn(),
  getTaskMock: vi.fn(),
  getTokenMock: vi.fn(),
  readPidInfoMock: vi.fn(),
  formatTaskMock: vi.fn(),
  successMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock('../lib/task.js', () => ({
  createTask: createTaskMock,
  getTask: getTaskMock,
}));

vi.mock('../lib/webui/token-store.js', () => ({
  getToken: getTokenMock,
}));

vi.mock('../lib/webui/pid-store.js', () => ({
  readPidInfo: readPidInfoMock,
}));

vi.mock('../lib/format.js', () => ({
  formatTask: formatTaskMock,
  success: successMock,
  error: errorMock,
}));

describe('create command', () => {
  beforeEach(() => {
    createTaskMock.mockReset();
    getTaskMock.mockReset();
    getTokenMock.mockReset();
    readPidInfoMock.mockReset();
    formatTaskMock.mockReset();
    successMock.mockReset();
    errorMock.mockReset();
    getTokenMock.mockReturnValue(null);
    readPidInfoMock.mockReturnValue(null);
  });

  it('prints the latest task snapshot after wake-up attempt', async () => {
    const printed = [];
    const originalLog = console.log;
    console.log = (...args) => printed.push(args.join(' '));

    try {
      const createdTask = {
        id: 'abc12345',
        title: 'demo',
        status: 'todo',
      };
      const latestTask = {
        ...createdTask,
        status: 'in_progress',
      };

      createTaskMock.mockReturnValue(createdTask);
      getTaskMock.mockReturnValue(latestTask);
      formatTaskMock.mockImplementation((task) => `formatted:${task.status}`);

      let action;
      const chain = {
        description() { return this; },
        requiredOption() { return this; },
        option() { return this; },
        action(fn) { action = fn; return this; },
      };
      const program = {
        command(name) {
          expect(name).toBe('create');
          return chain;
        },
      };

      const mod = await import('../lib/commands/create.js');
      mod.default(program);

      await action({
        title: 'demo',
        description: undefined,
        priority: 'medium',
        status: undefined,
        timeout: '1800',
      });

      expect(createTaskMock).toHaveBeenCalled();
      expect(getTaskMock).toHaveBeenCalledWith('abc12345');
      expect(successMock).toHaveBeenCalledWith('Task created: abc12345');
      expect(printed.some((line) => line.includes('formatted:in_progress'))).toBe(true);
    } finally {
      console.log = originalLog;
    }
  });
});
