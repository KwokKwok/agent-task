import { useEffect, useRef, useState } from 'react';
import { PencilLine, RefreshCw, RotateCcw, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { OpenClawAgentActionDialog } from './OpenClawAgentActionDialog';

async function fetchJson(path, options) {
  const res = await fetch(path, { credentials: 'include', ...options });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const btnSecondary = 'h-7 rounded-full border-none bg-[var(--surface-soft)] px-2.5 text-[11px] font-medium tracking-[0.014em] text-[var(--text-soft)] hover:bg-[color-mix(in_srgb,var(--surface-soft)_70%,transparent)] hover:text-[var(--text-main)]';
const btnPrimary = 'h-7 rounded-full bg-[var(--text-main)] px-2.5 text-[11px] font-medium tracking-[0.014em] text-[var(--panel-bg-strong)] hover:opacity-90';

export function AgentOnboardingPane({ config, onSave, saving }) {
  const [preview, setPreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [openclawActionMode, setOpenclawActionMode] = useState(null);
  const textareaRef = useRef(null);
  const template = config.chatGuidance?.template || '';

  useEffect(() => {
    if (!editing) {
      setDraft(template);
    }
  }, [template, editing]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      requestAnimationFrame(() => textareaRef.current.focus());
    }
  }, [editing]);

  useEffect(() => {
    async function loadPreview() {
      setPreviewLoading(true);
      try {
        const data = await fetchJson('/api/prompts/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'chat',
            mode: 'dispatch',
            hasFeedback: false,
            useMockTask: true,
            config,
          }),
        });
        setPreview(data.content || '');
      } catch {
        setPreview('');
      } finally {
        setPreviewLoading(false);
      }
    }
    void loadPreview();
  }, [config]);

  function handleCancelEdit() {
    setDraft(template);
    setEditing(false);
  }

  async function handleReset() {
    try {
      const data = await fetchJson('/api/prompts/defaults?type=chat');
      setDraft(data.content || '');
    } catch {
      setDraft(preview);
    }
  }

  async function handleSave() {
    const saved = await onSave(
      { chatGuidance: { template: draft } },
      {
        successMessage: '已保存',
        successDescription: 'Intake SKILL 已更新',
      },
    );
    if (saved) {
      setEditing(false);
    }
  }

  return (
    <>
      <OpenClawAgentActionDialog
        open={Boolean(openclawActionMode)}
        mode={openclawActionMode || 'connect'}
        config={config}
        onClose={() => setOpenclawActionMode(null)}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[15px] font-medium tracking-[0.016em] text-[var(--text-main)]">
                agent-task-intake SKILL
              </div>
              <div className="inline-flex rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[10px] font-medium tracking-[0.014em] text-[var(--text-soft)]">
                {editing ? '编辑中' : '预览'}
              </div>
            </div>
            {!editing ? (
              <div className="mt-2 text-[12px] leading-[1.6] tracking-[0.014em] text-[var(--text-soft)]">
                维护{' '}
                <code className="rounded bg-[var(--surface-soft)] px-1.5 py-0.5 text-[11px] text-[var(--text-main)]">
                  agent-task-intake/SKILL.md
                </code>{' '}
                模板。
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleReset()}
                  disabled={saving}
                  className={btnSecondary}
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  重置为默认
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className={btnSecondary}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  取消
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className={btnPrimary}
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
                  onClick={() => setOpenclawActionMode('disconnect')}
                  className={btnSecondary}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  取消 OpenClaw 接入
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenclawActionMode('connect')}
                  className={btnSecondary}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  同步至 OpenClaw
                </Button>
                <Button
                  type="button"
                  onClick={() => setEditing(true)}
                  className={btnPrimary}
                >
                  <PencilLine className="mr-1 h-3.5 w-3.5" />
                  编辑
                </Button>
              </>
            )}
          </div>
        </div>

        {editing ? (
          <div className="mb-3 rounded-[12px] bg-[var(--surface-soft)] px-3 py-2 text-[12px] tracking-[0.014em] text-[var(--text-soft)]">
            <span>可用变量：</span>
            <code className="mx-1 rounded bg-[var(--panel-bg-strong)] px-1.5 py-0.5 text-[11px] text-[var(--text-main)]">
              {'{{types}}'}
            </code>
            <span>任务类型详情，</span>
            <code className="mx-1 rounded bg-[var(--panel-bg-strong)] px-1.5 py-0.5 text-[11px] text-[var(--text-main)]">
              {'{{types_trigger}}'}
            </code>
            <span>仅保留 trigger 的单行版本。</span>
          </div>
        ) : null}

        {previewLoading ? (
          <div className="min-h-[320px] flex-1 overflow-auto rounded-[14px] bg-[var(--surface-soft)] px-4 py-4 font-mono text-[12px] leading-6 tracking-[0.014em] text-[var(--text-main)]">
            加载中...
          </div>
        ) : editing ? (
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="h-full min-h-[320px] flex-1 overflow-auto rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] font-mono text-[12px] leading-6 tracking-[0.014em] text-[var(--text-main)] resize-none focus:ring-1 focus:ring-[rgba(147,197,253,0.5)] focus:border-transparent"
            disabled={saving}
          />
        ) : (
          <pre className="min-h-[320px] flex-1 overflow-auto whitespace-pre-wrap rounded-[14px] bg-[var(--surface-soft)] px-4 py-4 font-mono text-[12px] leading-6 tracking-[0.014em] text-[var(--text-main)]">
            {preview || '暂无内容'}
          </pre>
        )}
      </div>
    </>
  );
}
