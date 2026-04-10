import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, TerminalSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AsyncStepsDialog } from '@/components/shared/AsyncStepsDialog';

const ACTION_STEP_ID = 'apply_action';
const RESTART_STEP_ID = 'restart_gateway';
const MOCK_SCENARIOS = new Set(['success', 'sync-error', 'restart-error']);

const ACTION_CONFIG = {
  connect: {
    dialogTitle: '同步至 OpenClaw',
    dialogDescription:
      '将渲染后的 agent-task-intake skill 写入 OpenClaw 的 skills 目录，让 Agent 接入直接基于这个 skill 生效。',
    actionStepTitle: '写入 agent-task-intake SKILL',
    actionRunningDescription:
      '将最新 skill 写入 OpenClaw，通常只需要几秒钟。',
    actionCompletedDescription:
      '已将最新 agent-task-intake skill 写入 OpenClaw。新的接入规则已经准备就绪。',
    actionErrorDescription: '同步步骤执行失败。请查看异常详情后重新发起同步。',
    actionPendingDescription: '准备把最新 skill 写入 OpenClaw。',
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
    mockActionError: 'Mock: agent-task-intake SKILL 写入失败。',
  },
  disconnect: {
    dialogTitle: '取消 OpenClaw 接入',
    dialogDescription:
      '通过移除 OpenClaw skills 目录下的 agent-task-intake skill，让 OpenClaw 停止通过该 skill 接入 Agent Task。',
    actionStepTitle: '移除 agent-task-intake SKILL',
    actionRunningDescription:
      '从 OpenClaw 中移除 agent-task-intake skill，通常只需要几秒钟。',
    actionCompletedDescription:
      '已移除 OpenClaw 中的 agent-task-intake skill。',
    actionErrorDescription: '取消接入步骤执行失败。请查看异常详情后重新发起。',
    actionPendingDescription:
      '准备移除 OpenClaw 中的 agent-task-intake skill。',
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
    mockActionError: 'Mock: agent-task-intake SKILL 移除失败。',
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
        ? ['检查 OpenClaw skills 目录', '移除 agent-task-intake skill'].join('\n')
        : ['检查 OpenClaw skills 目录', '写入 agent-task-intake/SKILL.md'].join('\n'),
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

      const response = await fetchJson('/api/openclaw/skills/agent-task-intake', {
        method: mode === 'disconnect' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      updateStepResult(ACTION_STEP_ID, response);

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
