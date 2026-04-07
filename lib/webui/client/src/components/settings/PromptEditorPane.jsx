import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Clipboard,
  PencilLine,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

async function fetchJson(path, options) {
  const res = await fetch(path, { credentials: 'include', ...options });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const PROMPT_META = {
  execution: {
    id: 'execution',
    label: 'Agent 执行',
    shortLabel: '执行提示词',
    icon: Bot,
    description: '给执行 Agent 的运行时提示词。它会根据任务、反馈、repair 模式和任务类型动态拼接。',
    copyLabel: '复制',
    previewSubtitle: '这里看到的是当前场景下真正会发送给执行 Agent 的内容。',
  },
};

const VARIABLE_GROUPS = {
  execution: [
    {
      title: '任务信息',
      items: [
        {
          token: '{{task.id}}',
          label: '任务 ID',
          description: '插入任务记录的唯一 ID。',
        },
        {
          token: '{{task.title}}',
          label: '任务标题',
          description: '插入当前任务的标题。',
        },
        {
          token: '{{task.description}}',
          label: '任务描述',
          description: '插入当前任务的完整描述。',
        },
        {
          token: '{{task.type_id}}',
          label: '任务类型 ID',
          description: '插入当前任务绑定的 type_id。',
        },
        {
          token: '{{task.workspace_path}}',
          label: '任务工作目录',
          description: '告诉执行 Agent 这次任务的 workspace 在哪里。',
        },
      ],
    },
    {
      title: '任务类型',
      items: [
        {
          token: '{{types}}',
          label: '执行类型参考',
          description: '插入当前任务类型的执行参考；未命中 type_id 时会给出全部类型参考。',
        },
      ],
    },
    {
      title: '运行时上下文',
      items: [
        {
          token: '{{runtime.mode}}',
          label: '运行模式',
          description: '本次执行是 dispatch 还是 repair。',
        },
        {
          token: '{{runtime.sessionKey}}',
          label: '执行会话标识',
          description: '插入这次执行对应的 session key。',
        },
        {
          token: '{{runtime.timeoutSeconds}}',
          label: '本次超时时间',
          description: '插入本次调度真正生效的 timeout。',
        },
        {
          token: '{{feedback.latestHuman.message}}',
          label: '最近一条用户反馈',
          description: '把最近的人类反馈正文插进来。',
        },
      ],
    },
    {
      title: '条件块',
      items: [
        {
          token: '{{#if repair}}\n...\n{{/if}}',
          label: '仅 repair 时出现',
          description: '只在 repair 模式下插入一段内容。',
        },
        {
          token: '{{#if hasFeedback}}\n...\n{{/if}}',
          label: '有反馈时出现',
          description: '只有当前任务有用户反馈时才插入。',
        },
        {
          token: '{{#if task.type_id}}\n...\n{{/if}}',
          label: '已有任务类型时出现',
          description: '只有任务已经匹配到 type_id 时才插入。',
        },
        {
          token: '{{#if hasTaskType}}\n...\n{{/if}}',
          label: '已匹配类型时出现',
          description: '只有任务已经匹配到有效 type_id 时才插入。',
        },
        {
          token: '{{#if missingTaskType}}\n...\n{{/if}}',
          label: '未匹配类型时出现',
          description: '只有任务没有匹配到有效 type_id 时才插入。',
        },
      ],
    },
  ],
};

function detectAutocompleteContext(value, cursor) {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/{{([^}\n]*)$/);
  if (!match) return null;

  return {
    start: cursor - match[0].length,
    end: cursor,
    query: match[1].trim(),
  };
}

function ScenarioToggle({ label, checked, onChange, disabled = false }) {
  return (
    <label className={`settings-muted inline-flex items-center gap-2 text-[12px] ${disabled ? 'opacity-50' : ''}`}>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function VariablePicker({
  query,
  onQueryChange,
  items,
  activeIndex,
  autoFocus = false,
  onKeyDown,
  onSelect,
  onClose,
}) {
  return (
    <div className="settings-card rounded-[14px]">
      <div className="settings-divider flex items-center gap-2 border-b px-3 py-2.5">
        <Sparkles className="settings-muted h-3.5 w-3.5" />
        <div className="min-w-0 flex-1">
          <input
            value={query}
            autoFocus={autoFocus}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索变量，例如 任务标题 / 反馈 / repair"
            className="settings-title h-8 w-full border-0 bg-transparent px-0 text-sm outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="settings-icon-button inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!items.length ? (
        <div className="settings-muted px-3 py-3 text-sm">
          没有匹配项。可以继续输入搜索词，或直接关闭。
        </div>
      ) : (
        <div className="max-h-[240px] overflow-y-auto px-2 py-2">
          <div className="space-y-1">
            {items.map((item, index) => (
              <button
                key={`${item.group}-${item.token}`}
                type="button"
                onClick={() => onSelect(item.token)}
                className={`flex w-full flex-col items-start rounded-[10px] px-3 py-2.5 text-left transition-colors ${
                  activeIndex === index ? 'bg-[color-mix(in_srgb,var(--surface-soft)_92%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--surface-soft)_72%,transparent)]'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="settings-title text-sm font-medium">{item.label}</span>
                  <span className="settings-dim text-[11px] uppercase tracking-wide">{item.group}</span>
                </div>
                <div className="settings-muted mt-0.5 text-xs leading-5">{item.description}</div>
                <code className="settings-code-chip mt-1.5 rounded px-1.5 py-0.5 font-mono text-[11px]">
                  {item.token}
                </code>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PromptEditorPane({ config, onSave, saving }) {
  const [tasks, setTasks] = useState([]);
  const [useMockTask, setUseMockTask] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [mode, setMode] = useState('dispatch');
  const [hasFeedback, setHasFeedback] = useState(false);
  const [preview, setPreview] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerRange, setPickerRange] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef(null);

  const template = config.executionGuidance?.template || '';
  const meta = PROMPT_META.execution;

  const variableItems = useMemo(
    () => VARIABLE_GROUPS.execution.flatMap((group) => (
      group.items.map((item) => ({ ...item, group: group.title }))
    )),
    [],
  );

  const filteredVariableItems = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase();
    if (!query) return variableItems;

    return variableItems.filter((item) => (
      item.label.toLowerCase().includes(query)
      || item.description.toLowerCase().includes(query)
      || item.token.toLowerCase().includes(query)
      || item.group.toLowerCase().includes(query)
    ));
  }, [pickerQuery, variableItems]);

  useEffect(() => {
    fetchJson('/api/tasks?status=all&sortBy=updated_at&order=desc')
      .then((data) => setTasks(data.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editing) {
      setDraft(template);
    }
  }, [template, editing]);

  useEffect(() => {
    setActiveIndex(0);
  }, [pickerQuery, pickerOpen]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const data = await fetchJson('/api/prompts/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'execution',
            mode,
            hasFeedback,
            useMockTask,
            taskId: useMockTask ? null : selectedTaskId || null,
            config,
          }),
          signal: controller.signal,
        });
        setPreview(data.content || '');
      } catch (error) {
        if (error.name === 'AbortError') return;
        setPreview('');
        setPreviewError(error.message || '预览生成失败');
      } finally {
        setPreviewLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [config, hasFeedback, mode, selectedTaskId, useMockTask]);

  function buildConfigWithTemplate(value) {
    return {
      ...config,
      executionGuidance: {
        ...config.executionGuidance,
        template: value,
      },
    };
  }

  function closePicker() {
    setPickerOpen(false);
    setPickerMode(null);
    setPickerQuery('');
    setPickerRange(null);
  }

  function openManualPicker() {
    setPickerOpen(true);
    setPickerMode('manual');
    setPickerQuery('');
    setPickerRange(null);
  }

  async function handleResetTemplate() {
    const data = await fetchJson(`/api/prompts/defaults?type=execution`);
    setDraft(data.content || '');
    closePicker();
    toast.success('已恢复默认模板', {
      description: `当前${meta.shortLabel}已恢复为默认版本。`,
    });
  }

  async function handleSaveTemplate() {
    const nextConfig = buildConfigWithTemplate(draft);
    const saved = await onSave(nextConfig, {
      successMessage: `${meta.shortLabel}已保存`,
      errorMessage: `${meta.shortLabel}保存失败`,
    });
    if (saved) {
      closePicker();
      setEditing(false);
    }
  }

  async function handleCopyPreview() {
    try {
      await navigator.clipboard.writeText(preview);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败', {
        description: '当前环境无法写入剪贴板，请手动复制。',
      });
    }
  }

  function insertToken(token) {
    const textarea = textareaRef.current;
    const currentValue = draft;

    if (!textarea) {
      setDraft((value) => `${value}${value ? '\n' : ''}${token}`);
      closePicker();
      return;
    }

    const selectionStart = textarea.selectionStart ?? currentValue.length;
    const selectionEnd = textarea.selectionEnd ?? currentValue.length;
    const start = pickerMode === 'inline' && pickerRange ? pickerRange.start : selectionStart;
    const end = pickerMode === 'inline' && pickerRange ? pickerRange.end : selectionEnd;
    const next = `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`;

    setDraft(next);
    closePicker();

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + token.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function startEditing() {
    setDraft(template);
    closePicker();
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(template);
    closePicker();
    setEditing(false);
  }

  function handleDraftChange(event) {
    const next = event.target.value;
    const cursor = event.target.selectionStart ?? next.length;
    setDraft(next);

    const context = detectAutocompleteContext(next, cursor);
    if (context) {
      setPickerOpen(true);
      setPickerMode('inline');
      setPickerQuery(context.query);
      setPickerRange({ start: context.start, end: context.end });
      return;
    }

    if (pickerMode === 'inline') {
      closePicker();
    }
  }

  function handlePickerNavigation(event) {
    if (!pickerOpen || !filteredVariableItems.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % filteredVariableItems.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + filteredVariableItems.length) % filteredVariableItems.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      insertToken(filteredVariableItems[activeIndex].token);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col rounded-[18px]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="settings-title text-[15px] font-medium">{meta.shortLabel}</div>
              <div className="settings-card-soft inline-flex rounded-full px-2.5 py-1 text-[10px] leading-none">
                {editing ? '编辑中' : '预览'}
              </div>
            </div>
            {!editing ? (
              <div className="settings-muted mt-2 text-[13px] leading-6">
                给执行 Agent 的运行时提示词，会根据任务、反馈、repair 模式和任务类型动态拼接。
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openManualPicker}
                  className="settings-button-secondary h-7 rounded-full px-2.5 text-[11px]"
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  插入变量
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEditing}
                  className="settings-button-secondary h-7 rounded-full px-2.5 text-[11px]"
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  取消
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleResetTemplate()}
                  className="settings-button-secondary h-7 rounded-full px-2.5 text-[11px]"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  重置为默认
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSaveTemplate()}
                  disabled={saving}
                  className="settings-button-primary h-7 rounded-full px-2.5 text-[11px]"
                >
                  <Save className="mr-1 h-3.5 w-3.5" />
                  {saving ? '保存中...' : '保存'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleCopyPreview()}
                  className="settings-button-secondary h-7 rounded-full px-2.5 text-[11px]"
                >
                  <Clipboard className="mr-1 h-3.5 w-3.5" />
                  {meta.copyLabel}
                </Button>
                <Button
                  type="button"
                  onClick={startEditing}
                  className="settings-button-primary h-7 rounded-full px-2.5 text-[11px]"
                >
                  <PencilLine className="mr-1 h-3.5 w-3.5" />
                  编辑
                </Button>
              </>
            )}
          </div>
        </div>

        {!editing ? (
          <div className="settings-card-soft mb-4 rounded-[14px] px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <ScenarioToggle label="使用模拟任务" checked={useMockTask} onChange={setUseMockTask} />
              <ScenarioToggle label="包含用户反馈" checked={hasFeedback} onChange={setHasFeedback} />
              <ScenarioToggle
                label="修订模式"
                checked={mode === 'repair'}
                onChange={(checked) => setMode(checked ? 'repair' : 'dispatch')}
              />
            </div>

            {!useMockTask ? (
              <div className="mt-3">
                <Select value={selectedTaskId || undefined} onValueChange={setSelectedTaskId}>
                  <SelectTrigger className="settings-input h-9 rounded-[12px] px-3 text-[12px]">
                    <SelectValue placeholder="选择真实任务" />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.slice(0, 50).map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.id.slice(0, 8)} - {task.title || '(untitled)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="settings-card-soft mb-3 rounded-[12px] px-3 py-2 text-[12px]">
            输入 <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-[11px] text-[var(--text-main)]">{'{{'}</code> 可快速搜索变量。
          </div>
        )}

        {previewError && !editing ? (
          <div className="settings-error mb-3 rounded-xl px-4 py-3 text-sm">
            {previewError}
          </div>
        ) : null}

        {editing ? (
          <>
            {pickerOpen ? (
              <div className="mb-3">
                <VariablePicker
                  query={pickerQuery}
                  onQueryChange={setPickerQuery}
                  items={filteredVariableItems}
                  activeIndex={activeIndex}
                  autoFocus={pickerMode === 'manual'}
                  onKeyDown={handlePickerNavigation}
                  onSelect={insertToken}
                  onClose={closePicker}
                />
              </div>
            ) : null}

            <Textarea
              ref={textareaRef}
              value={draft}
              onChange={handleDraftChange}
              onKeyDown={handlePickerNavigation}
              className="settings-input min-h-0 flex-1 overflow-auto resize-none rounded-[14px] font-mono text-[12px] leading-6"
            />
          </>
        ) : (
          <pre className="settings-preview min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-[14px] px-4 py-4 font-mono text-[12px] leading-6">
            {previewLoading ? '生成中...' : preview}
          </pre>
        )}
      </div>
    </div>
  );
}
