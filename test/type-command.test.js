import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  commandMocks,
  infoMock,
  errorMock,
  successMock,
  listTaskTypesMock,
  createTaskTypeMock,
  updateTaskTypeMock,
} = vi.hoisted(() => ({
  commandMocks: {},
  infoMock: vi.fn(),
  errorMock: vi.fn(),
  successMock: vi.fn(),
  listTaskTypesMock: vi.fn(),
  createTaskTypeMock: vi.fn(),
  updateTaskTypeMock: vi.fn(),
}));

vi.mock('../lib/format.js', () => ({
  info: infoMock,
  error: errorMock,
  success: successMock,
}));

vi.mock('../lib/task-type.js', async () => {
  const actual = await vi.importActual('../lib/task-type.js');
  return {
    ...actual,
    listTaskTypes: listTaskTypesMock,
    createTaskType: createTaskTypeMock,
    updateTaskType: updateTaskTypeMock,
  };
});

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
  return {
    command(name) {
      const cmd = makeCommandChain(name);
      commandMocks[name] = cmd;
      return cmd;
    },
  };
}

function getSubcommand(command, name) {
  return Object.entries(command.subcommands).find(([key]) => key === name || key.startsWith(`${name} `))?.[1];
}

describe('type command registration', () => {
  beforeEach(() => {
    Object.keys(commandMocks).forEach((key) => delete commandMocks[key]);
    infoMock.mockReset();
    errorMock.mockReset();
    successMock.mockReset();
    listTaskTypesMock.mockReset();
    createTaskTypeMock.mockReset();
    updateTaskTypeMock.mockReset();
    listTaskTypesMock.mockReturnValue([
      {
        id: 'article_research',
        name: '文章研究',
        triggerCondition: '研究文章',
        beforeCreate: '创建文章研究任务',
        executionStepsReference: '提炼观点',
        openclaw: { timeoutSeconds: 1800 },
      },
    ]);
    createTaskTypeMock.mockReturnValue({
      id: 'article_research',
      name: '文章研究',
      triggerCondition: '研究文章',
      beforeCreate: '创建文章研究任务',
      executionStepsReference: '提炼观点',
      openclaw: { timeoutSeconds: 1800 },
    });
    updateTaskTypeMock.mockReturnValue({
      id: 'article_research',
      name: '文章研究 v2',
      triggerCondition: '研究文章',
      beforeCreate: '创建文章研究任务',
      executionStepsReference: '提炼观点',
      openclaw: { timeoutSeconds: 2400 },
    });
  });

  it('registers type list and export subcommands', async () => {
    const program = buildProgram();
    const mod = await import('../lib/commands/type.js');
    mod.default(program);

    expect(commandMocks.type).toBeTruthy();
    expect(getSubcommand(commandMocks.type, 'list')).toBeTruthy();
    expect(getSubcommand(commandMocks.type, 'export')).toBeTruthy();
    expect(getSubcommand(commandMocks.type, 'create')).toBeTruthy();
    expect(getSubcommand(commandMocks.type, 'update')).toBeTruthy();
  });

  it('prints task type markdown for export', async () => {
    const printed = [];
    const originalLog = console.log;
    console.log = (...args) => printed.push(args.join(' '));

    try {
      const program = buildProgram();
      const mod = await import('../lib/commands/type.js');
      mod.default(program);

      getSubcommand(commandMocks.type, 'export')._action();

      expect(printed.join('\n')).toContain('# 任务类型');
      expect(printed.join('\n')).toContain('type_id: article_research');
    } finally {
      console.log = originalLog;
    }
  });

  it('creates a task type through the CLI command', async () => {
    const program = buildProgram();
    const mod = await import('../lib/commands/type.js');
    mod.default(program);

    getSubcommand(commandMocks.type, 'create')._action({
      id: 'article_research',
      name: '文章研究',
      triggerCondition: '研究文章',
      beforeCreate: '创建文章研究任务',
      executionReference: '提炼观点',
      timeout: '1800',
    });

    expect(createTaskTypeMock).toHaveBeenCalledWith({
      id: 'article_research',
      name: '文章研究',
      triggerCondition: '研究文章',
      beforeCreate: '创建文章研究任务',
      executionStepsReference: '提炼观点',
      timeoutSeconds: '1800',
    });
    expect(successMock).toHaveBeenCalledWith('Task type created: article_research');
  });

  it('updates a task type through the CLI command', async () => {
    const program = buildProgram();
    const mod = await import('../lib/commands/type.js');
    mod.default(program);

    getSubcommand(commandMocks.type, 'update')._action('article_research', {
      name: '文章研究 v2',
      executionReference: '重新提炼观点',
      timeout: '2400',
    });

    expect(updateTaskTypeMock).toHaveBeenCalledWith('article_research', {
      name: '文章研究 v2',
      triggerCondition: undefined,
      beforeCreate: undefined,
      executionStepsReference: '重新提炼观点',
      timeoutSeconds: '2400',
    });
    expect(successMock).toHaveBeenCalledWith('Task type updated: article_research');
  });
});
