import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, TerminalSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AsyncStepsDialog } from '@/components/shared/AsyncStepsDialog';

const COMPLETION_PHRASE = '写入完成';
const ACTION_STEP_ID = 'apply_action';
const RESTART_STEP_ID = 'restart_gateway';
const MOCK_SCENARIOS = new Set(['success', 'sync-error', 'restart-error']);

const ACTION_CONFIG = {
  connect: {
    dialogTitle: '同步至 OpenClaw',
    dialogDescription:
      '通过同步提示词，让 OpenClaw 知道应该如何使用 Agent Task 来管理任务。',
    actionStepTitle: '发送提示词到 OpenClaw',
    actionRunningDescription:
      '将最新 onboarding 提示词写入 OpenClaw，通常需要 1 分钟左右。',
    actionCompletedDescription:
      '已将最新 Onboarding 提示词同步给 OpenClaw。新的接入规则已经准备就绪。',
    actionErrorDescription: '同步步骤执行失败。请查看异常详情后重新发起同步。',
    actionPendingDescription: '准备把最新 onboarding 提示词同步给 OpenClaw。',
    actionRetryLabel: '重试同步',
    restartConfirmDescription:
      '最新接入内容已同步。你可以现在重启一次，让新规则立即生效。',
    restartCompletedDescription:
      'OpenClaw 已完成重启，刚同步的规则已经生效。',
    restartErrorDescription: '重启步骤执行失败。请查看异常详情后重试。',
    restartDeferredDescription:
      '你选择了稍后重启。新的规则会在下次重启 OpenClaw 后生效。',
    restartAvailableDescription:
      '同步完成后，可以按需执行一次重启，让新规则立即生效。',
    completedEyebrow: '下一步',
    completedTitle: '继续开始一个新对话',
    completedBodyAfterRestart: (
      <>
        使用{' '}
        <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-[var(--text-main)]">
          /new
        </code>{' '}
        新开一个对话，然后发送“生成一些任务吧”试试吧。
      </>
    ),
    completedBodyBeforeRestart: (
      <>
        重启 OpenClaw 后，使用{' '}
        <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-[var(--text-main)]">
          /new
        </code>{' '}
        新开一个对话，然后发送“生成一些任务吧”试试吧。
      </>
    ),
    mockActionError: 'Mock: onboarding 写入失败，OpenClaw 未返回完成确认。',
  },
  disconnect: {
    dialogTitle: '取消 OpenClaw 接入',
    dialogDescription:
      '通过移除 AGENTS.md 中与 Agent Task 相关的内容，让 OpenClaw 停止使用 Agent Task。',
    actionStepTitle: '移除 agent-task 内容',
    actionRunningDescription:
      '让 OpenClaw 从 AGENTS.md 中移除所有与 agent-task 相关的内容，通常需要 1 分钟左右。',
    actionCompletedDescription:
      '已要求 OpenClaw 移除 AGENTS.md 中所有与 agent-task 相关的内容。',
    actionErrorDescription: '取消接入步骤执行失败。请查看异常详情后重新发起。',
    actionPendingDescription:
      '准备让 OpenClaw 从 AGENTS.md 中移除所有与 agent-task 相关的内容。',
    actionRetryLabel: '重试取消',
    restartConfirmDescription:
      '取消接入内容已处理完成。你可以现在重启一次，让变更立即生效。',
    restartCompletedDescription:
      'OpenClaw 已完成重启，取消接入已经生效。',
    restartErrorDescription: '重启步骤执行失败。请查看异常详情后重试。',
    restartDeferredDescription:
      '你选择了稍后重启。取消接入会在下次重启 OpenClaw 后生效。',
    restartAvailableDescription:
      '取消接入完成后，可以按需执行一次重启，让变更立即生效。',
    completedEyebrow: '已取消',
    completedTitle: '如需重新接入',
    completedBodyAfterRestart: '如需重新启用 Agent Task，可回到这里再次同步至 OpenClaw。',
    completedBodyBeforeRestart:
      '重启 OpenClaw 后，如需重新启用 Agent Task，可回到这里再次同步至 OpenClaw。',
    mockActionError: 'Mock: AGENTS.md 中的 agent-task 内容移除失败。',
  },
};

async function fetchJson(path, options) {
  const res = await fetch(path, { credentials: 'include', ...options });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const error = new Error(data.error || `HTTP ${res.status}`);
    error.details = data.details;
    throw error;
  }
  return data;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function resolveMockScenario() {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get(
    'agentSyncMock',
  );
  if (!value) return null;
  if (value === '1' || value === 'true') return 'success';
  return MOCK_SCENARIOS.has(value) ? value : null;
}

function buildMockActionResponse(mode) {
  return {
    stdout:
      mode === 'disconnect'
        ? ['检查 AGENTS.md', '移除所有 agent-task 相关段落', COMPLETION_PHRASE].join('\n')
        : ['检查 AGENTS.md', '定位 agent-task onboarding 区段', COMPLETION_PHRASE].join('\n'),
    stderr: '',
  };
}

function buildMockRestartResponse() {
  return {
    stdout: [
      'Restart request accepted',
      'OpenClaw gateway restarted successfully',
    ].join('\n'),
    stderr: '',
  };
}

function buildAgentInstallMessage(onboardingPrompt) {
  const normalizedPrompt = String(onboardingPrompt || '').trim();
  return [
    '你现在需要为自己完成一次 `agent-task` 接入。',
    '',
    '请检查你当前的 `AGENTS.md`，并确保其中完整保存下面这段 `agent-task` onboarding 内容。',
    '',
    '执行要求：',
    '- 如果 `AGENTS.md` 中还没有这段 onboarding，就将它完整追加进去。',
    '- 如果已经存在旧版本或不一致版本，请把那一段完整更新为下面这段最新内容。',
    '- 不要摘要、不要改写、不要省略，必须完整保留下面的原文。',
    '- 不要改动 `AGENTS.md` 中与 `agent-task` 无关的其他内容。',
    `- 完成写入后，请只回复：${COMPLETION_PHRASE}`,
    '',
    '下面是必须完整写入的原文。不要把标记行本身写入 `AGENTS.md`，只写入标记之间的内容：',
    '',
    '<<<AGENT_TASK_ONBOARDING_START>>>',
    normalizedPrompt,
    '<<<AGENT_TASK_ONBOARDING_END>>>',
  ].join('\n');
}

function buildAgentDisconnectMessage() {
  return [
    '你现在需要为自己取消一次 `agent-task` 接入。',
    '',
    '请检查你当前的 `AGENTS.md`，并移除其中所有与 `agent-task` 相关的内容。',
    '',
    '执行要求：',
    '- 删除所有与 `agent-task` 有关的 onboarding、说明、约束、引用和示例。',
    '- 如果相关内容分散在多处，请全部移除。',
    '- 不要改动 `AGENTS.md` 中与 `agent-task` 无关的其他内容。',
    '- 如果已经没有任何相关内容，不要新增任何内容。',
    `- 完成写入后，请只回复：${COMPLETION_PHRASE}`,
  ].join('\n');
}

function hasCompletionAck(result) {
  const haystack = `${result?.stdout || ''}\n${result?.stderr || ''}`;
  return haystack.includes(COMPLETION_PHRASE);
}

async function buildActionMessage(mode) {
  if (mode === 'disconnect') {
    return buildAgentDisconnectMessage();
  }

  const promptData = await fetchJson('/api/prompts/chat');
  return buildAgentInstallMessage(promptData.content);
}

function buildActionSteps({
  actionConfig,
  phase,
  stepStatuses,
  stepResults,
  actionError,
  restartError,
  actionCompleted,
  restartCompleted,
}) {
  const actionStatus = stepStatuses[ACTION_STEP_ID] || 'pending';
  const restartStatus = stepStatuses[RESTART_STEP_ID] || 'pending';

  const actionDescription = (() => {
    if (actionStatus === 'running') return actionConfig.actionRunningDescription;
    if (actionStatus === 'completed') return actionConfig.actionCompletedDescription;
    if (actionStatus === 'error') return actionConfig.actionErrorDescription;
    return actionConfig.actionPendingDescription;
  })();

  const restartDescription = (() => {
    if (restartStatus === 'running') {
      return '重启 OpenClaw 让刚同步的规则立即生效，通常需要 1 分钟左右。';
    }
    if (restartStatus === 'completed') {
      return actionConfig.restartCompletedDescription;
    }
    if (restartStatus === 'error') {
      return actionConfig.restartErrorDescription;
    }
    if (phase === 'restart-confirm') {
      return actionConfig.restartConfirmDescription;
    }
    if (phase === 'completed' && !restartCompleted) {
      return actionConfig.restartDeferredDescription;
    }
    if (actionCompleted) {
      return actionConfig.restartAvailableDescription;
    }
    return '等待上一步完成后再继续。';
  })();

  return [
    {
      id: ACTION_STEP_ID,
      title: actionConfig.actionStepTitle,
      status: actionStatus,
      description: actionDescription,
      detail: actionStatus === 'error' ? actionError : stepResults[ACTION_STEP_ID],
      waitingForAction: false,
    },
    {
      id: RESTART_STEP_ID,
      title: '重启 OpenClaw',
      status: restartStatus,
      description: restartDescription,
      detail: restartStatus === 'error' ? restartError : stepResults[RESTART_STEP_ID],
      waitingForAction: restartStatus === 'pending' && phase === 'restart-confirm',
    },
  ];
}

function buildCompletedContent(actionConfig, restartCompleted) {
  return (
    <div className="rounded-[18px] bg-[color-mix(in_srgb,var(--surface-subtle)_52%,var(--panel-bg-strong))] px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.03)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--panel-bg-strong)_96%,transparent)] text-[var(--text-main)]">
          <TerminalSquare className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <div className="font-['Space_Grotesk',sans-serif] text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {actionConfig.completedEyebrow}
          </div>
          <div className="text-sm font-medium text-[var(--text-main)]">
            {actionConfig.completedTitle}
          </div>
          <div className="mt-2 rounded-[12px] bg-[color-mix(in_srgb,var(--panel-bg-strong)_84%,transparent)] px-3.5 py-3 text-[13px] leading-6 text-[var(--text-soft)]">
            {restartCompleted
              ? actionConfig.completedBodyAfterRestart
              : actionConfig.completedBodyBeforeRestart}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OpenClawAgentActionDialog({
  open,
  config,
  onClose,
  mode = 'connect',
}) {
  const actionConfig = ACTION_CONFIG[mode] || ACTION_CONFIG.connect;
  const [phase, setPhase] = useState('idle');
  const [stepStatuses, setStepStatuses] = useState({});
  const [stepResults, setStepResults] = useState({});
  const [actionError, setActionError] = useState(null);
  const [restartError, setRestartError] = useState(null);
  const mockScenario = useMemo(() => resolveMockScenario(), []);
  const runTokenRef = useRef(0);

  const canClose = phase !== 'syncing' && phase !== 'restarting';
  const actionCompleted = stepStatuses[ACTION_STEP_ID] === 'completed';
  const restartCompleted = stepStatuses[RESTART_STEP_ID] === 'completed';

  const steps = useMemo(
    () =>
      buildActionSteps({
        actionConfig,
        phase,
        stepStatuses,
        stepResults,
        actionError,
        restartError,
        actionCompleted,
        restartCompleted,
      }),
    [
      actionCompleted,
      actionConfig,
      actionError,
      phase,
      restartCompleted,
      restartError,
      stepResults,
      stepStatuses,
    ],
  );

  function resetState() {
    runTokenRef.current += 1;
    setPhase('idle');
    setStepStatuses({});
    setStepResults({});
    setActionError(null);
    setRestartError(null);
  }

  function updateStepStatus(stepId, status) {
    setStepStatuses(prev => ({ ...prev, [stepId]: status }));
  }

  function updateStepResult(stepId, result) {
    setStepResults(prev => ({ ...prev, [stepId]: result }));
  }

  async function executeAction() {
    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    setPhase('syncing');
    setStepStatuses({
      [ACTION_STEP_ID]: 'running',
      [RESTART_STEP_ID]: 'pending',
    });
    setStepResults({});
    setActionError(null);
    setRestartError(null);

    try {
      if (mockScenario) {
        await sleep(1200);
        if (runTokenRef.current !== runToken) return;

        if (mockScenario === 'sync-error') {
          throw new Error(actionConfig.mockActionError);
        }

        const response = buildMockActionResponse(mode);
        updateStepResult(ACTION_STEP_ID, response);
        updateStepStatus(ACTION_STEP_ID, 'completed');
        setPhase('restart-confirm');
        return;
      }

      const message = await buildActionMessage(mode);
      const response = await fetchJson('/api/openclaw/agent/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          thinking: config.general?.openclawDefaults?.thinking || 'off',
          timeoutSeconds:
            config.general?.openclawDefaults?.timeoutSeconds || 1800,
        }),
      });

      updateStepResult(ACTION_STEP_ID, response);

      if (!hasCompletionAck(response)) {
        throw new Error(`Agent 没有明确回复“${COMPLETION_PHRASE}”`);
      }

      if (runTokenRef.current !== runToken) return;
      updateStepStatus(ACTION_STEP_ID, 'completed');
      setPhase('restart-confirm');
    } catch (error) {
      if (runTokenRef.current !== runToken) return;
      updateStepStatus(ACTION_STEP_ID, 'error');
      setActionError(error);
      setPhase('error');
    }
  }

  async function handleRestart() {
    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    setRestartError(null);
    updateStepStatus(RESTART_STEP_ID, 'running');
    setPhase('restarting');

    try {
      if (mockScenario) {
        await sleep(1400);
        if (runTokenRef.current !== runToken) return;

        if (mockScenario === 'restart-error') {
          throw new Error(
            'Mock: OpenClaw 重启命令已发出，但网关未在预期时间内恢复。',
          );
        }

        const response = buildMockRestartResponse();
        updateStepResult(RESTART_STEP_ID, response);
        updateStepStatus(RESTART_STEP_ID, 'completed');
        setPhase('completed');
        return;
      }

      const response = await fetchJson('/api/openclaw/gateway/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (runTokenRef.current !== runToken) return;
      updateStepResult(RESTART_STEP_ID, response);
      updateStepStatus(RESTART_STEP_ID, 'completed');
      setPhase('completed');
    } catch (error) {
      if (runTokenRef.current !== runToken) return;
      updateStepStatus(RESTART_STEP_ID, 'error');
      setRestartError(error);
      setPhase('error');
    }
  }

  function handleRestartLater() {
    updateStepStatus(RESTART_STEP_ID, 'pending');
    setPhase('completed');
  }

  useEffect(() => {
    if (open) {
      resetState();
      void executeAction();
    } else {
      resetState();
    }
  }, [mode, open]);

  const footerLeft =
    phase === 'restart-confirm' ? (
      <Button
        type="button"
        variant="ghost"
        onClick={handleRestartLater}
        className="h-auto rounded-none px-0 py-0 text-xs font-medium text-[var(--text-soft)] hover:bg-transparent hover:text-[var(--text-main)]"
      >
        稍后重启
      </Button>
    ) : phase === 'error' ? (
      <Button
        type="button"
        variant="ghost"
        onClick={onClose}
        className="h-auto rounded-none px-0 py-0 text-xs font-medium text-[var(--text-soft)] hover:bg-transparent hover:text-[var(--text-main)]"
      >
        关闭
      </Button>
    ) : (
      <div />
    );

  const footerRight =
    phase === 'restart-confirm' ? (
      <Button
        type="button"
        onClick={() => void handleRestart()}
        className="settings-button-primary h-8 rounded-full px-3 text-xs font-medium"
      >
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        立即重启
      </Button>
    ) : phase === 'error' ? (
      !actionCompleted ? (
        <Button
          type="button"
          onClick={() => void executeAction()}
          className="settings-button-primary h-8 rounded-full px-3 text-xs font-medium"
        >
          {actionConfig.actionRetryLabel}
        </Button>
      ) : !restartCompleted ? (
        <Button
          type="button"
          onClick={() => void handleRestart()}
          className="settings-button-primary h-8 rounded-full px-3 text-xs font-medium"
        >
          重试重启
        </Button>
      ) : null
    ) : phase === 'completed' ? (
      <Button
        type="button"
        onClick={onClose}
        className="settings-button-primary h-8 rounded-full px-3 text-xs font-medium"
      >
        完成
      </Button>
    ) : (
      <Button
        type="button"
        variant="outline"
        disabled
        className="settings-button-secondary h-8 rounded-full px-3 text-xs font-medium"
      >
        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        处理中...
      </Button>
    );

  return (
    <AsyncStepsDialog
      open={open}
      canClose={canClose}
      onClose={onClose}
      title={actionConfig.dialogTitle}
      description={actionConfig.dialogDescription}
      steps={steps}
      completedContent={
        phase === 'completed'
          ? buildCompletedContent(actionConfig, restartCompleted)
          : null
      }
      footerLeft={footerLeft}
      footerRight={footerRight}
    />
  );
}
