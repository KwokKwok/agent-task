import { useEffect, useState } from 'react';
import { PencilLine, RefreshCw, RotateCcw, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { OpenClawAgentActionDialog } from './OpenClawAgentActionDialog';

export function AgentOnboardingPane({ config, onSave, saving }) {
  const [preview, setPreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [openclawActionMode, setOpenclawActionMode] = useState(null);
  const template = config.chatGuidance?.template || '';

  useEffect(() => {
    if (!editing) {
      setDraft(template);
    }
  }, [template, editing]);

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
      { successMessage: '已保存', successDescription: 'Onboarding 提示词已更新' }
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
        <div className="flex min-h-0 flex-1 flex-col rounded-[18px]">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="settings-title text-[15px] font-medium">Onboarding 提示词</div>
                <div className="settings-card-soft inline-flex rounded-full px-2.5 py-1 text-[10px] leading-none">
                  {editing ? '编辑中' : '预览'}
                </div>
              </div>
              <div className="settings-muted mt-2 text-[13px] leading-6">
                维护写入
                {' '}
                <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-[var(--text-main)]">AGENTS.md</code>
                {' '}
                的接入模板。
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {editing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleReset()}
                    disabled={saving}
                    className="settings-button-secondary h-7 rounded-full px-2.5 text-[11px]"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    重置为默认
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="settings-button-secondary h-7 rounded-full px-2.5 text-[11px]"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    取消
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="settings-button-primary h-7 rounded-full px-2.5 text-[11px]"
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {saving ? '保存中...' : '保存'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    onClick={() => setOpenclawActionMode('connect')}
                    className="settings-button-primary h-7 rounded-full px-2.5 text-[11px]"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    同步至 OpenClaw
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenclawActionMode('disconnect')}
                    className="settings-button-secondary h-7 rounded-full px-2.5 text-[11px]"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    取消 OpenClaw 接入
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(true)}
                    className="settings-button-secondary h-7 rounded-full px-2.5 text-[11px]"
                  >
                    <PencilLine className="h-3.5 w-3.5 mr-1" />
                    编辑
                  </Button>
                </>
              )}
            </div>
          </div>

          {editing ? (
            <div className="settings-card-soft mb-3 rounded-[12px] px-3 py-2 text-[12px]">
              <span className="settings-muted">可用变量：</span>
              <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-[11px] text-[var(--text-main)]">{'{{types}}'}</code>
              <span className="settings-muted">任务类型列表。</span>
            </div>
          ) : null}

          {previewLoading ? (
            <div className="settings-preview min-h-[320px] flex-1 overflow-auto rounded-[14px] px-4 py-4 font-mono text-[12px] leading-6">
              加载中...
            </div>
          ) : editing ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="settings-input h-full min-h-[320px] flex-1 overflow-auto rounded-[14px] font-mono text-[12px] leading-6 resize-none"
              disabled={saving}
            />
          ) : (
            <pre className="settings-preview min-h-[320px] flex-1 overflow-auto whitespace-pre-wrap rounded-[14px] px-4 py-4 font-mono text-[12px] leading-6">
              {preview || '暂无内容'}
            </pre>
          )}
        </div>
      </div>
    </>
  );
}

async function fetchJson(path, options) {
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
