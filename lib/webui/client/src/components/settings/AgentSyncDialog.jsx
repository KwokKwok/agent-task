import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Circle,
  LoaderCircle,
  RefreshCw,
  TerminalSquare,
  XCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogIconClose,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const COMPLETION_PHRASE = '写入完成';

const STEP_META = {
  write_prompt: {
    id: 'write_prompt',
    label: '同步至 OpenClaw',
    successLabel: '同步成功',
    pendingLabel: '等待开始',
    runningLabel: '正在同步',
    errorLabel: '同步失败',
    icon: Bot,
  },
  restart_gateway: {
    id: 'restart_gateway',
    label: '重启 OpenClaw',
    successLabel: '重启成功',
    pendingLabel: '未重启',
    runningLabel: '正在重启',
    errorLabel: '重启失败',
    icon: RefreshCw,
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

function hasCompletionAck(result) {
  const haystack = `${result?.stdout || ''}\n${result?.stderr || ''}`;
  return haystack.includes(COMPLETION_PHRASE);
}

function getStepAppearance(status) {
  if (status === 'completed') {
    return {
      icon: <CheckCircle2 className="h-4.5 w-4.5 text-[var(--status-done-text)]" />,
      badgeClass: 'bg-[var(--status-done-bg)] text-[var(--status-done-text)]',
      borderClass: 'border-[color-mix(in_srgb,var(--status-done-text)_18%,var(--border-subtle))]',
      surfaceClass: 'bg-[color-mix(in_srgb,var(--status-done-bg)_72%,transparent)]',
    };
  }

  if (status === 'running') {
    return {
      icon: <LoaderCircle className="h-4.5 w-4.5 animate-spin text-[var(--accent)]" />,
      badgeClass: 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]',
      borderClass: 'border-[color-mix(in_srgb,var(--accent)_18%,var(--border-subtle))]',
      surfaceClass: 'bg-[color-mix(in_srgb,var(--accent)_4%,transparent)]',
    };
  }

  if (status === 'error') {
    return {
      icon: <XCircle className="h-4.5 w-4.5 text-[var(--danger-strong)]" />,
      badgeClass: 'bg-[color-mix(in_srgb,var(--danger-strong)_10%,transparent)] text-[var(--danger-strong)]',
      borderClass: 'border-[color-mix(in_srgb,var(--danger-strong)_18%,var(--border-subtle))]',
      surfaceClass: 'bg-[color-mix(in_srgb,var(--danger-strong)_4%,transparent)]',
    };
  }

  return {
    icon: <Circle className="h-4.5 w-4.5 text-[var(--text-muted)]" />,
    badgeClass: 'bg-[var(--surface-soft)] text-[var(--text-muted)]',
    borderClass: 'border-[var(--border-subtle)]',
    surfaceClass: 'bg-[color-mix(in_srgb,var(--panel-bg-strong)_92%,transparent)]',
  };
}

function getStepStatusLabel(stepId, status) {
  const meta = STEP_META[stepId];
  if (status === 'completed') return meta.successLabel;
  if (status === 'running') return meta.runningLabel;
  if (status === 'error') return meta.errorLabel;
  return meta.pendingLabel;
}

function formatRawResponse(response) {
  if (!response) return '';
  return String(response.stdout || '').trim();
}

function OutputTooltip({ children, response }) {
  const content = formatRawResponse(response);
  if (!content) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={10}
        className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-['IBM_Plex_Mono',monospace] text-[11px] leading-5"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

function OperationStepCard({ stepId, status, response, message }) {
  const meta = STEP_META[stepId];
  const Icon = meta.icon;
  const appearance = getStepAppearance(status);

  return (
    <div className={`rounded-[14px] border p-3.5 ${appearance.borderClass} ${appearance.surfaceClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--panel-bg-strong)_94%,transparent)] text-[var(--text-main)]">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--text-main)]">{meta.label}</div>
            <div className="mt-1 text-[13px] leading-6 text-[var(--text-soft)]">
              {message || getStepStatusLabel(stepId, status)}
            </div>
          </div>
        </div>
        <OutputTooltip response={status === 'completed' ? response : null}>
          <div className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${appearance.badgeClass}`}>
            {appearance.icon}
            {getStepStatusLabel(stepId, status)}
          </div>
        </OutputTooltip>
      </div>
    </div>
  );
}

function buildErrorStateMessage(error) {
  if (!error) return '操作失败';
  return error.message || '操作失败';
}

export function AgentSyncDialog({ open, config, onClose }) {
  const [phase, setPhase] = useState('idle');
  const [stepStatuses, setStepStatuses] = useState({});
  const [stepResults, setStepResults] = useState({});
  const [syncError, setSyncError] = useState(null);
  const [restartError, setRestartError] = useState(null);

  const canClose = phase !== 'syncing' && phase !== 'restarting';
  const syncCompleted = stepStatuses.write_prompt === 'completed';
  const restartCompleted = stepStatuses.restart_gateway === 'completed';

  const dialogCopy = useMemo(() => {
    if (phase === 'syncing') {
      return {
        title: '同步至 OpenClaw',
        description: '这一步会把最新 onboarding 提示词同步给 OpenClaw，让它在新对话里按当前接入规则工作。',
      };
    }

    if (phase === 'restart-confirm') {
      return {
        title: '同步完成',
        description: 'OpenClaw 已收到最新接入内容。如果希望规则立即生效，现在可以重启一次。',
      };
    }

    if (phase === 'restarting') {
      return {
        title: '正在重启 OpenClaw',
        description: '重启完成后，刚同步的规则会立刻生效。',
      };
    }

    if (phase === 'completed') {
      return restartCompleted
        ? {
            title: '同步与重启已完成',
            description: '现在可以重新开始一个对话，让 OpenClaw 用最新规则继续工作。',
          }
        : {
            title: '同步已完成',
            description: '你可以稍后手动重启 OpenClaw，之后再开始新对话。',
          };
    }

    if (phase === 'error') {
      return {
        title: syncCompleted ? '重启失败' : '同步失败',
        description: '可以先查看原始响应，再决定是否重试。',
      };
    }

    return {
      title: '同步至 OpenClaw',
      description: '准备开始。',
    };
  }, [phase, restartCompleted, syncCompleted]);

  function resetState() {
    setPhase('idle');
    setStepStatuses({});
    setStepResults({});
    setSyncError(null);
    setRestartError(null);
  }

  function updateStepStatus(stepId, status) {
    setStepStatuses((prev) => ({ ...prev, [stepId]: status }));
  }

  function updateStepResult(stepId, result) {
    setStepResults((prev) => ({ ...prev, [stepId]: result }));
  }

  async function executeSync() {
    setPhase('syncing');
    setStepStatuses({
      write_prompt: 'running',
      restart_gateway: 'pending',
    });
    setStepResults({});
    setSyncError(null);
    setRestartError(null);

    try {
      const promptData = await fetchJson('/api/prompts/chat');
      const installMessage = buildAgentInstallMessage(promptData.content);
      const response = await fetchJson('/api/openclaw/agent/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: installMessage,
          thinking: config.general?.openclawDefaults?.thinking || 'off',
          timeoutSeconds: config.general?.openclawDefaults?.timeoutSeconds || 1800,
        }),
      });

      updateStepResult('write_prompt', response);

      if (!hasCompletionAck(response)) {
        throw new Error(`Agent 没有明确回复“${COMPLETION_PHRASE}”`);
      }

      updateStepStatus('write_prompt', 'completed');
      setPhase('restart-confirm');
    } catch (error) {
      updateStepStatus('write_prompt', 'error');
      setSyncError(error);
      setPhase('error');
    }
  }

  async function handleRestart() {
    setRestartError(null);
    updateStepStatus('restart_gateway', 'running');
    setPhase('restarting');

    try {
      const response = await fetchJson('/api/openclaw/gateway/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      updateStepResult('restart_gateway', response);
      updateStepStatus('restart_gateway', 'completed');
      setPhase('completed');
    } catch (error) {
      updateStepStatus('restart_gateway', 'error');
      setRestartError(error);
      setPhase('error');
    }
  }

  function handleRestartLater() {
    updateStepStatus('restart_gateway', 'pending');
    setPhase('completed');
  }

  useEffect(() => {
    if (open) {
      resetState();
      void executeSync();
    } else {
      resetState();
    }
  }, [open]);

  const activeError = restartError || syncError;

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && canClose) onClose();
        }}
      >
        <DialogContent
          className="w-[min(calc(100vw-2rem),560px)] p-0"
          onInteractOutside={(event) => {
            if (!canClose) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (!canClose) event.preventDefault();
          }}
        >
          <DialogHeader className="border-b border-[var(--border-subtle)] pr-14">
            <DialogTitle className="text-[1rem] font-medium">{dialogCopy.title}</DialogTitle>
            <DialogDescription className="text-[13px] leading-6">
              {dialogCopy.description}
            </DialogDescription>
          </DialogHeader>

          {canClose ? <DialogIconClose className="absolute right-4 top-4" /> : null}

          <div className="space-y-3 px-5 py-4">
            <OperationStepCard
              stepId="write_prompt"
              status={stepStatuses.write_prompt || 'pending'}
              response={stepResults.write_prompt}
              message={stepStatuses.write_prompt === 'completed'
                ? '已将最新 onboarding 提示词同步给 OpenClaw。'
                : null}
            />

            {syncCompleted ? (
              <OperationStepCard
                stepId="restart_gateway"
                status={stepStatuses.restart_gateway || 'pending'}
                response={stepResults.restart_gateway}
                message={restartCompleted
                  ? 'OpenClaw 已完成重启，新的规则已经生效。'
                  : phase === 'restart-confirm'
                    ? '是否现在重启一次，让刚同步的规则立即生效？'
                    : phase === 'completed'
                      ? '你选择了稍后重启，新的规则会在下次重启后生效。'
                      : null}
              />
            ) : null}

            {phase === 'error' && activeError ? (
              <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--danger-strong)_20%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--danger-strong)_4%,transparent)] px-4 py-3">
              <div className="text-sm font-medium text-[var(--danger-strong)]">
                {buildErrorStateMessage(activeError)}
              </div>
            </div>
          ) : null}

            {phase === 'completed' ? (
              <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--panel-bg-strong)_94%,transparent)] text-[var(--text-main)]">
                    <TerminalSquare className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--text-main)]">下一步</div>
                    <div className="mt-1 text-[13px] leading-6 text-[var(--text-soft)]">
                      {restartCompleted ? (
                        <>
                          使用 <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-[var(--text-main)]">/new</code> 新开一个对话，然后发送“生成一些任务吧”。
                        </>
                      ) : (
                        <>
                          重启 OpenClaw 后，使用 <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-[var(--text-main)]">/new</code> 新开一个对话，然后发送“生成一些任务吧”。
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
            {phase === 'restart-confirm' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRestartLater}
                  className="settings-button-secondary h-9 rounded-full px-3.5"
                >
                  稍后重启
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleRestart()}
                  className="settings-button-primary h-9 rounded-full px-3.5"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  立即重启
                </Button>
              </>
            ) : phase === 'error' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="settings-button-secondary h-9 rounded-full px-3.5"
                >
                  关闭
                </Button>
                {!syncCompleted ? (
                  <Button
                    type="button"
                    onClick={() => void executeSync()}
                    className="settings-button-primary h-9 rounded-full px-3.5"
                  >
                    重试同步
                  </Button>
                ) : null}
                {syncCompleted && !restartCompleted ? (
                  <Button
                    type="button"
                    onClick={() => void handleRestart()}
                    className="settings-button-primary h-9 rounded-full px-3.5"
                  >
                    重试重启
                  </Button>
                ) : null}
              </>
            ) : phase === 'completed' ? (
              <Button
                type="button"
                onClick={onClose}
                className="settings-button-primary h-9 rounded-full px-3.5"
              >
                完成
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled
                className="settings-button-secondary h-9 rounded-full px-3.5"
              >
                处理中...
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
