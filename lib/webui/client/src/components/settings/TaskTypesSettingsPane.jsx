import { useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertDialogHeading,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  PencilLine,
  Plus,
  Power,
  PowerOff,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AgentSyncDialog } from './AgentSyncDialog';

function buildDraft(taskType = {}, fallbackTimeoutMinutes = 30) {
  return {
    id: taskType.id || '',
    name: taskType.name || '',
    enabled: taskType.enabled !== false,
    triggerCondition: taskType.triggerCondition || '',
    beforeCreate: taskType.beforeCreate || '',
    executionStepsReference: taskType.executionStepsReference || '',
    timeoutSeconds: String(taskType.openclaw?.timeoutSeconds ?? fallbackTimeoutMinutes * 60),
  };
}

function buildConfigWithTaskTypes(config, taskTypes) {
  return {
    ...config,
    executionGuidance: {
      ...config.executionGuidance,
      strategies: taskTypes,
    },
  };
}

function TaskTypeStatusBadge({ enabled }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-medium ${
      enabled
        ? 'settings-success-badge'
        : 'settings-neutral-badge'
    }`}
    >
      {enabled ? '已启用' : '已停用'}
    </span>
  );
}

function TaskTypeEditorDialog({
  open,
  mode,
  draft,
  error,
  saving,
  onClose,
  onChange,
  onSave,
}) {
  const editing = mode === 'edit';
  const [draftTimeoutMinutes, setDraftTimeoutMinutes] = useState(
    Math.round(Number(draft.timeoutSeconds) / 60)
  );

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="settings-dialog w-[min(calc(100vw-3rem),760px)] max-h-[min(88vh,760px)] rounded-[16px] p-0">
        <DialogTitle className="sr-only">
          {editing ? '编辑任务类型' : '新建任务类型'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          配置任务类型的名称、触发条件、创建前说明和执行参考。
        </DialogDescription>
        <div className="settings-pane flex min-h-0 flex-col overflow-hidden rounded-[16px]">
          <div className="settings-divider flex items-center justify-between border-b px-5 py-4">
            <div>
              <h3 className="settings-title text-[1rem] font-normal">
                {editing ? '编辑任务类型' : '新建任务类型'}
              </h3>
              <p className="settings-muted mt-1 text-[13px] leading-6">
                任务类型决定聊天阶段如何创建任务，以及执行阶段如何拼接提示词。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="settings-icon-button inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4">
            <div className="space-y-3.5">
              <label className="block">
                <div className="settings-title mb-2 text-sm font-medium">类型 ID</div>
                <Input
                  value={draft.id}
                  disabled={editing || saving}
                  onChange={(event) => onChange({ id: event.target.value })}
                  placeholder="例如 article_research"
                  className="settings-input h-10 rounded-[12px] px-3.5 text-sm"
                />
                <div className="settings-muted mt-2 text-[12px] leading-5">
                  {editing ? '类型 ID 创建后不可修改。' : '建议使用稳定的 snake_case，创建后不可修改。'}
                </div>
              </label>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_120px]">
                <label className="block">
                  <div className="settings-title mb-2 text-sm font-medium">类型名称</div>
                  <Input
                    value={draft.name}
                    disabled={saving}
                    onChange={(event) => onChange({ name: event.target.value })}
                    placeholder="例如 文章研究"
                    className="settings-input h-10 rounded-[12px] px-3.5 text-sm"
                  />
                </label>

                <label className="block">
                  <div className="settings-title mb-2 text-sm font-medium">超时(分钟)</div>
                  <Input
                    type="number"
                    value={draftTimeoutMinutes}
                    onChange={(event) => {
                      const mins = Number(event.target.value);
                      setDraftTimeoutMinutes(mins);
                      onChange({ timeoutSeconds: String(mins * 60) });
                    }}
                    className="settings-input h-10 rounded-[12px] px-3.5 text-sm"
                  />
                </label>
              </div>

              <label className="block">
                <div className="settings-title mb-2 text-sm font-medium">触发条件</div>
                <Input
                  value={draft.triggerCondition}
                  disabled={saving}
                  onChange={(event) => onChange({ triggerCondition: event.target.value })}
                  placeholder="例如：收到文章链接"
                  className="settings-input h-10 rounded-[12px] px-3.5 text-sm"
                />
              </label>

              <label className="block">
                <div className="settings-title mb-2 text-sm font-medium">创建任务前先做什么</div>
                <Textarea
                  value={draft.beforeCreate}
                  disabled={saving}
                  onChange={(event) => onChange({ beforeCreate: event.target.value })}
                  placeholder="例如：先读取链接内容"
                  className="settings-input min-h-[60px] resize-y"
                />
              </label>

              <label className="block">
                <div className="settings-title mb-2 text-sm font-medium">执行参考</div>
                <Textarea
                  value={draft.executionStepsReference}
                  disabled={saving}
                  onChange={(event) => onChange({ executionStepsReference: event.target.value })}
                  placeholder="支持 markdown"
                  className="settings-input min-h-[100px] resize-y"
                />
              </label>

              {error ? (
                <div className="settings-error rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <div className="settings-divider flex items-center justify-end gap-2 border-t px-5 py-3.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="settings-button-secondary h-9 rounded-full px-3.5"
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="settings-button-primary h-9 rounded-full px-3.5 text-sm font-medium"
            >
              {saving ? '保存中...' : editing ? '保存修改' : '创建类型'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TaskTypesSettingsPane({ config, onSave, saving }) {
  const taskTypes = config.executionGuidance?.strategies || [];
  const defaultTimeoutMinutes = Math.round((config.general?.openclawDefaults?.timeoutSeconds || 1800) / 60);
  const [editor, setEditor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [draft, setDraft] = useState(buildDraft({}, defaultTimeoutMinutes));
  const [draftError, setDraftError] = useState('');
  const [syncOpen, setSyncOpen] = useState(false);

  const enabledCount = useMemo(
    () => taskTypes.filter((item) => item.enabled !== false).length,
    [taskTypes],
  );

  function openCreateDialog() {
    setDraft(buildDraft({}, defaultTimeoutMinutes));
    setDraftError('');
    setEditor({ mode: 'create', index: -1 });
  }

  function openEditDialog(index) {
    setDraft(buildDraft(taskTypes[index], defaultTimeoutMinutes));
    setDraftError('');
    setEditor({ mode: 'edit', index });
  }

  function closeEditor() {
    if (saving) return;
    setEditor(null);
    setDraftError('');
  }

  async function saveDraftIntoList() {
    const id = draft.id.trim();
    const name = draft.name.trim();
    const timeoutSeconds = Number(draft.timeoutSeconds);
    const isCreating = editor.mode === 'create';

    if (!id) {
      setDraftError('创建任务类型时必须填写 ID。');
      return;
    }
    if (!name) {
      setDraftError('创建任务类型时必须填写名称。');
      return;
    }
    if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0) {
      setDraftError('默认 Timeout 必须是大于 0 的整数。');
      return;
    }

    const duplicated = taskTypes.some((item, index) => item.id === id && index !== editor.index);
    if (duplicated) {
      setDraftError(`任务类型 ID 已存在：${id}`);
      return;
    }

    const nextItem = {
      id,
      name,
      enabled: draft.enabled !== false,
      triggerCondition: draft.triggerCondition.trim(),
      beforeCreate: draft.beforeCreate.trim(),
      executionStepsReference: draft.executionStepsReference.trim(),
      openclaw: {
        timeoutSeconds,
      },
    };

    const nextTaskTypes = editor.mode === 'create'
      ? [...taskTypes, nextItem]
      : taskTypes.map((item, index) => (index === editor.index ? nextItem : item));

    const saved = await onSave(buildConfigWithTaskTypes(config, nextTaskTypes), {
      successMessage: isCreating ? '任务类型已创建' : '任务类型已更新',
      successDescription: `${name}（${id}）已写入当前配置。`,
      errorMessage: isCreating ? '任务类型创建失败' : '任务类型更新失败',
    });
    if (saved) {
      closeEditor();
    }
  }

  async function toggleTaskType(index) {
    const item = taskTypes[index];
    const nextTaskTypes = taskTypes.map((item, currentIndex) => (
      currentIndex === index ? { ...item, enabled: item.enabled === false } : item
    ));
    const saved = await onSave(buildConfigWithTaskTypes(config, nextTaskTypes), {
      successMessage: item.enabled === false ? '任务类型已启用' : '任务类型已停用',
      successDescription: `${item.name}（${item.id}）状态已更新。`,
      errorMessage: '任务类型状态更新失败',
    });
    return saved;
  }

  async function removeTaskType(index) {
    const item = taskTypes[index];
    const nextTaskTypes = taskTypes.filter((_, currentIndex) => currentIndex !== index);
    const saved = await onSave(buildConfigWithTaskTypes(config, nextTaskTypes), {
      successMessage: '任务类型已删除',
      successDescription: `${item.name}（${item.id}）已从当前配置中移除。`,
      errorMessage: '任务类型删除失败',
    });
    if (saved) {
      setDeleteTarget(null);
    }
    return saved;
  }

  return (
    <div className="space-y-3">
      <AgentSyncDialog
        open={syncOpen}
        config={config}
        onClose={() => setSyncOpen(false)}
      />

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          onClick={() => setSyncOpen(true)}
          disabled={saving}
          className="settings-button-secondary h-8 rounded-full px-3 text-xs font-medium"
        >
          <Upload className="h-3.5 w-3.5" />
          同步至 OpenClaw
        </Button>
        <Button
          type="button"
          onClick={openCreateDialog}
          disabled={saving}
          className="settings-button-primary h-8 rounded-full px-3 text-xs font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          新建
        </Button>
      </div>

      {!taskTypes.length ? (
        <div className="settings-card rounded-[14px] border-dashed px-4 py-5 text-sm leading-6">
          当前还没有任务类型。创建后，Agent 可以在创建任务时显式填写 `type_id`，执行提示词也会按类型收窄。
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {taskTypes.map((taskType, index) => (
            <article
              key={taskType.id}
              className="settings-card rounded-[16px] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="settings-title text-[15px] font-medium">{taskType.name}</h3>
                    <TaskTypeStatusBadge enabled={taskType.enabled !== false} />
                  </div>
                  <div className="settings-muted mt-1 font-mono text-xs">{taskType.id}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => void toggleTaskType(index)}
                        disabled={saving}
                        className="settings-button-secondary inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        title={taskType.enabled === false ? '启用' : '停用'}
                      >
                        {taskType.enabled === false ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {taskType.enabled === false ? '启用' : '停用'}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => openEditDialog(index)}
                        disabled={saving}
                        className="settings-button-secondary inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        title="编辑"
                      >
                        <PencilLine className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      编辑
                    </TooltipContent>
                  </Tooltip>
                  <AlertDialog open={deleteTarget === taskType.id} onOpenChange={(open) => setDeleteTarget(open ? taskType.id : null)}>
                    <AlertDialogTrigger asChild>
                      <div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(taskType.id)}
                              disabled={saving}
                              className="settings-danger-button inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            删除
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogHeading>删除任务类型？</AlertDialogHeading>
                        <AlertDialogBody>
                          {taskType.name}（{taskType.id}）会从当前配置里移除。已创建任务的历史记录不会被改动。
                        </AlertDialogBody>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void removeTaskType(index)}>
                          确认删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <dl className="mt-3 space-y-2 text-sm leading-6">
                <div>
                  <dt className="settings-dim text-xs font-semibold uppercase tracking-wide">触发条件</dt>
                  <dd className="settings-copy mt-1">{taskType.triggerCondition || '未填写'}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}

      {editor ? (
        <TaskTypeEditorDialog
          open={Boolean(editor)}
          mode={editor.mode}
          draft={draft}
          error={draftError}
          saving={saving}
          onClose={closeEditor}
          onChange={(patch) => {
            setDraft((current) => ({ ...current, ...patch }));
            setDraftError('');
          }}
          onSave={() => void saveDraftIntoList()}
        />
      ) : null}
    </div>
  );
}
