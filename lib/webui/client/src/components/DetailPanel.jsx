import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ExternalLink, Undo2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge.jsx';
import { Separator } from './ui/separator.jsx';
import { Skeleton } from './ui/skeleton.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.jsx';
import { TimeStamp } from './TimeStamp.jsx';
import { AudioPlayer } from './AudioPlayer.jsx';
import { cn } from '../lib/utils';
import {
  FloatingPanelRoot,
  FloatingPanelTrigger,
  FloatingPanelContent,
  FloatingPanelForm,
  FloatingPanelBody,
  FloatingPanelFooter,
  FloatingPanelCloseButton,
  FloatingPanelSubmitButton,
  FloatingPanelTextarea,
} from './ui/floating-panel.jsx';
import {
  mapEventType,
  mapStatusText,
  markdownToHtml,
  readableFileSize,
} from '../lib/helpers.js';
import { STATUS_META, STATUS_VALUES } from '../constants';

const FEEDBACK_KIND_LABEL = { reject: '驳回', comment: '评论', update: '更新' };
const FEEDBACK_ACTOR_LABEL = { human: '用户', ai: 'AI' };
const RUN_KIND_LABEL = { dispatch: '派发', repair: '续作' };
const RUN_STATUS_LABEL = {
  running: '运行中',
  completed: '已完成',
  dispatch_failed: '派发失败',
  timed_out: '已超时',
};

const STATUS_DOT_TONE = {
  todo: 'default',
  in_progress: 'active',
  done: 'done',
  archived: 'default',
};

function DetailHeaderSkeleton() {
  return (
    <div className="min-w-0 flex-1">
      <Skeleton className="mb-3 h-8 w-[62%] rounded-xl" />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-[4.5rem] rounded-full" />
        <Skeleton className="h-4 w-28 rounded-full" />
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <section className="space-y-5">
      <div className="rounded-xl bg-[var(--surface-subtle)] p-4">
        <Skeleton className="mb-3 h-3 w-24 rounded-full" />
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[94%]" />
          <Skeleton className="h-4 w-[82%]" />
          <Skeleton className="h-4 w-[88%]" />
        </div>
      </div>
      <section className="space-y-2">
        <Skeleton className="h-3 w-20 rounded-full" />
        {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-lg bg-[var(--surface-subtle)] p-3">
              <div className="mb-2 flex items-center gap-2">
                <Skeleton className="h-5 w-[4.5rem] rounded-full" />
                <Skeleton className="h-3.5 w-24 rounded-full" />
              </div>
            <Skeleton className="h-4 w-[92%]" />
          </div>
        ))}
      </section>
    </section>
  );
}

function FeedbackSkeleton() {
  return (
    <section className="space-y-2">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-lg bg-[var(--surface-subtle)] p-3">
          <div className="mb-2 flex items-center gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-3.5 w-24 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-[95%]" />
            <Skeleton className="h-4 w-[76%]" />
          </div>
        </div>
      ))}
    </section>
  );
}

function ReportSkeleton() {
  return (
    <div className="rounded-lg bg-[var(--surface-subtle)] px-5 pb-5 pt-3">
      <div className="space-y-3">
        <Skeleton className="h-6 w-[46%] rounded-xl" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[95%]" />
        <Skeleton className="h-4 w-[82%]" />
        <Skeleton className="mt-5 h-5 w-[34%] rounded-xl" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[87%]" />
      </div>
    </div>
  );
}

function FilesListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="flex items-center justify-between rounded-lg px-3 py-2">
          <Skeleton className="h-4 w-[56%]" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

function FilePreviewSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-36 rounded-xl" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[96%]" />
      <Skeleton className="h-4 w-[92%]" />
      <Skeleton className="h-4 w-[68%]" />
    </div>
  );
}

function DebugSkeleton() {
  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-[var(--surface-subtle)] p-4">
        <Skeleton className="mb-3 h-3 w-28 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[60%]" />
          <Skeleton className="h-4 w-[52%]" />
          <Skeleton className="h-4 w-[70%]" />
        </div>
      </div>
      {[0, 1].map((item) => (
        <div key={item} className="rounded-lg bg-[var(--surface-subtle)] p-3">
          <div className="mb-2 flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3.5 w-28 rounded-full" />
          </div>
          <Skeleton className="h-4 w-[90%]" />
        </div>
      ))}
    </section>
  );
}

function renderLogMeta(meta) {
  if (!meta || typeof meta !== 'object') return '';
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
}

/* ── Status badge + dropdown ──────────────────────────── */

function StatusDropdown({ task, onUpdateStatus }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = task?.status;

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const meta = current ? STATUS_META[current] : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="status-badge-trigger"
        onClick={() => setOpen(v => !v)}
      >
        {meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : null}
        <ChevronDown
          className={cn('status-badge-chevron h-3 w-3', open && 'is-open')}
        />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: 'spring', bounce: 0.12, duration: 0.28 }}
            className="status-dropdown"
          >
            {STATUS_VALUES.map(value => {
              const m = STATUS_META[value];
              const isActive = value === current;
              return (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    'status-dropdown-item',
                    isActive && 'is-active',
                  )}
                  onClick={() => {
                    void onUpdateStatus(value);
                    setOpen(false);
                  }}
                  disabled={!task || isActive}
                >
                  <span
                    className={cn(
                      'status-dropdown-dot',
                      `status-dropdown-dot-${STATUS_DOT_TONE[value]}`,
                    )}
                  />
                  {m.label}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ── DetailPanel ──────────────────────────────────────── */

export function DetailPanel({
  task,
  events,
  activeTab,
  onTabChange,
  onClose,
  feedbackItems,
  feedbackState,
  feedbackError,
  debugData,
  debugState,
  debugError,
  onRejectTask,
  onUpdateStatus,
  reportState,
  reportHtml,
  reportError,
  htmlReportUrl,
  htmlReportOriginalUrl,
  htmlReportState,
  filesState,
  filesPath,
  filesItems,
  filePreview,
  filePreviewState,
  fileAudioData,
  selectedFilePath,
  onLoadFiles,
  onLoadFilePreview,
  detailLoading,
  now,
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [htmlLoaded, setHtmlLoaded] = useState(false);
  const showHeaderSkeleton = detailLoading && !task;

  // Reset iframe loaded state when switching tabs
  useEffect(() => {
    if (activeTab === 'html') {
      setHtmlLoaded(false);
    }
  }, [activeTab]);

  const showPreview = Boolean(selectedFilePath);
  const canReject = task?.status === 'done';
  const executionSummary = debugData?.summary || task;
  const reversedEvents = [...events].reverse();
  const reversedFeedbackItems = [...feedbackItems].reverse();

  async function handleRejectSubmit(note) {
    await onRejectTask(note);
    setRejectOpen(false);
  }

  return (
    <>
      <div className="theme-panel flex h-full flex-col overflow-hidden rounded-none backdrop-blur-sm lg:rounded-[13px]">
        <header className="px-5 pb-4 pt-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            {showHeaderSkeleton ? (
              <DetailHeaderSkeleton />
            ) : (
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 line-clamp-2 overflow-visible font-['Manrope',sans-serif] text-2xl font-bold text-[var(--text-main)]">
                  {task?.title || '未选择记录'}
                  {task?.hasReportAudio ? (
                    <span className="shrink-0">
                      <AudioPlayer
                        src={`/api/tasks/${task.id}/file?path=report.mp3`}
                      />
                    </span>
                  ) : null}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-soft)]">
                  <StatusDropdown task={task} onUpdateStatus={onUpdateStatus} />
                  {canReject && (
                    <FloatingPanelRoot
                      open={rejectOpen}
                      onOpenChange={setRejectOpen}
                    >
                      <FloatingPanelTrigger
                        className="status-reject-btn"
                        title="驳回任务"
                      >
                        <Undo2 className="h-3 w-3" />
                        驳回
                      </FloatingPanelTrigger>
                      <FloatingPanelContent className="w-80">
                        <FloatingPanelForm onSubmit={handleRejectSubmit}>
                          <FloatingPanelBody>
                            <FloatingPanelTextarea
                              id="reject-note"
                              className="min-h-[100px]"
                              placeholder="填写驳回原因、修改建议或需要补充的内容。"
                            />
                          </FloatingPanelBody>
                          <FloatingPanelFooter>
                            <FloatingPanelCloseButton />
                            <FloatingPanelSubmitButton />
                          </FloatingPanelFooter>
                        </FloatingPanelForm>
                      </FloatingPanelContent>
                    </FloatingPanelRoot>
                  )}
                  {task?.id ? (
                    <span className="font-['Space_Grotesk',sans-serif]">
                      {task.id}
                    </span>
                  ) : null}
                  {task?.updated_at ? (
                    <span>
                      更新于 <TimeStamp value={task.updated_at} now={now} />
                    </span>
                  ) : null}
                </div>
              </div>
            )}
            <div className="flex items-center gap-1">
              {!showHeaderSkeleton && task?.hasReportHtml ? (
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  title="在新标签页打开 HTML 报告"
                >
                  <a
                    href={`/api/tasks/${task.id}/open-report?mode=interactive`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="关闭详情面板"
              >
                <X className="h-4 w-4 transition-transform duration-200 hover:rotate-90" />
              </Button>
            </div>
          </div>
          <Separator />
        </header>

        <div className="min-h-0 flex-1 px-5 pb-5">
          <Tabs
            value={activeTab}
            onValueChange={onTabChange}
            className="flex h-full min-h-0 flex-col"
          >
            <TabsList className="w-fit">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="report">Report</TabsTrigger>
              {task?.hasReportHtml ? (
                <TabsTrigger value="html">HTML</TabsTrigger>
              ) : null}
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
              <TabsTrigger value="debug">Debug</TabsTrigger>
            </TabsList>

            <TabsContent
              value="overview"
              className="min-h-0 flex-1 overflow-auto pr-1"
            >
              {detailLoading ? (
                <OverviewSkeleton />
              ) : (
                <section className="space-y-5">
                  <div className="rounded-xl bg-[var(--surface-subtle)] p-4">
                    <h3 className="mb-2 font-['Space_Grotesk',sans-serif] text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Description
                    </h3>
                    <div
                      className="markdown-body text-sm leading-7 text-[var(--text-main)]"
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(task?.description),
                      }}
                    />
                  </div>
                  <section className="space-y-2">
                    <h3 className="font-['Space_Grotesk',sans-serif] text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Timeline
                    </h3>
                    {reversedEvents.length ? (
                      reversedEvents.map((event, i) => (
                        <motion.div
                          key={`${event.id}-${event.created_at}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: i * 0.04,
                            duration: 0.2,
                            ease: 'easeOut',
                          }}
                          className="rounded-lg bg-[var(--surface-subtle)] p-3"
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="theme-accent-pill rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em]">
                              {mapEventType(event.event_type)}
                            </span>
                            <TimeStamp
                              value={event.created_at}
                              now={now}
                              className="text-[11px] text-[var(--text-muted)]"
                            />
                          </div>
                          <p className="text-sm text-[var(--text-main)]">
                            {mapStatusText(event.message) || '(无消息)'}
                          </p>
                        </motion.div>
                      ))
                    ) : (
                      <div className="rounded-lg bg-[var(--surface-subtle)] p-4 text-center text-sm text-[var(--text-muted)]">
                        暂无事件
                      </div>
                    )}
                  </section>
                </section>
              )}
            </TabsContent>

            <TabsContent
              value="feedback"
              className="min-h-0 flex-1 overflow-auto pr-1"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-[var(--surface-subtle)] px-4 py-3">
                  <h3 className="font-['Space_Grotesk',sans-serif] text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Feedback History
                  </h3>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {reversedFeedbackItems?.length
                      ? `${reversedFeedbackItems.length} 条反馈`
                      : '暂无反馈'}
                  </span>
                </div>

                <AnimatePresence mode="popLayout">
                  {feedbackState === 'loading' ? (
                    <motion.div
                      key="fb-loading"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="rounded-lg"
                    >
                      <FeedbackSkeleton />
                    </motion.div>
                  ) : null}
                  {feedbackError ? (
                    <motion.div
                      key="fb-error"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="theme-danger rounded-lg p-4 text-sm"
                    >
                      {feedbackError}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                {!feedbackError &&
                feedbackState === 'ready' &&
                reversedFeedbackItems.length ? (
                  <section className="space-y-2">
                    {reversedFeedbackItems.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: i * 0.04,
                          duration: 0.2,
                          ease: 'easeOut',
                        }}
                        className="rounded-lg bg-[var(--surface-subtle)] p-3"
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="theme-accent-pill rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em]">
                            {FEEDBACK_KIND_LABEL[item.kind] || item.kind}
                          </span>
                          <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                            {FEEDBACK_ACTOR_LABEL[item.actor] || item.actor}
                          </span>
                          <TimeStamp
                            value={item.created_at}
                            now={now}
                            className="text-[11px] text-[var(--text-muted)]"
                          />
                        </div>
                        <p className="text-sm text-[var(--text-main)]">
                          {item.message}
                        </p>
                      </motion.div>
                    ))}
                  </section>
                ) : null}
                {!feedbackError &&
                feedbackState === 'ready' &&
                !reversedFeedbackItems.length ? (
                  <div className="rounded-lg bg-[var(--surface-subtle)] p-4 text-center text-sm text-[var(--text-muted)]">
                    暂无反馈
                  </div>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent
              value="debug"
              className="min-h-0 flex-1 overflow-auto pr-1"
            >
              <div className="space-y-4">
                {debugState === 'loading' ? <DebugSkeleton /> : null}
                {debugError ? (
                  <div className="theme-danger rounded-lg p-4 text-sm">
                    {debugError}
                  </div>
                ) : null}

                {!debugError && debugState === 'ready' ? (
                  <>
                    <section className="rounded-xl bg-[var(--surface-subtle)] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="font-['Space_Grotesk',sans-serif] text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          Execution Summary
                        </h3>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {debugData?.runs?.length ? `${debugData.runs.length} 次运行` : '暂无运行记录'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-sm text-[var(--text-main)]">
                        <div>
                          <span className="text-[var(--text-muted)]">Dispatch:</span>{' '}
                          {executionSummary?.dispatch_status || 'idle'}
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">Timeout:</span>{' '}
                          {executionSummary?.timeout_seconds ? `${executionSummary.timeout_seconds}s` : '-'}
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">Repair Count:</span>{' '}
                          {executionSummary?.repair_count ?? 0}
                        </div>
                        <div className="break-all">
                          <span className="text-[var(--text-muted)]">Session Key:</span>{' '}
                          {executionSummary?.session_key || '-'}
                        </div>
                        {executionSummary?.dispatch_started_at ? (
                          <div>
                            <span className="text-[var(--text-muted)]">Started:</span>{' '}
                            <TimeStamp value={executionSummary.dispatch_started_at} now={now} />
                          </div>
                        ) : null}
                        {executionSummary?.last_dispatch_error ? (
                          <div className="text-[var(--danger-strong)]">
                            <span className="text-[var(--text-muted)]">Error:</span>{' '}
                            {executionSummary.last_dispatch_error}
                          </div>
                        ) : null}
                      </div>
                    </section>

                    <section className="space-y-2">
                      <div className="flex items-center justify-between rounded-xl bg-[var(--surface-subtle)] px-4 py-3">
                        <h3 className="font-['Space_Grotesk',sans-serif] text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          Run History
                        </h3>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {debugData?.runs?.length ? `${debugData.runs.length} 条` : '暂无'}
                        </span>
                      </div>
                      {debugData?.runs?.length ? (
                        debugData.runs.map((run, index) => (
                          <motion.div
                            key={run.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03, duration: 0.2, ease: 'easeOut' }}
                            className="rounded-lg bg-[var(--surface-subtle)] p-3"
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="theme-accent-pill rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em]">
                                {RUN_KIND_LABEL[run.kind] || run.kind}
                              </span>
                              <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                                {RUN_STATUS_LABEL[run.status] || run.status}
                              </span>
                              <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                                {run.trigger_source}
                              </span>
                              <TimeStamp
                                value={run.started_at}
                                now={now}
                                className="text-[11px] text-[var(--text-muted)]"
                              />
                            </div>
                            <div className="space-y-1 text-sm text-[var(--text-main)]">
                              <div>
                                Attempt {run.attempt_index} · Timeout {run.timeout_seconds}s
                              </div>
                              <div className="break-all text-[var(--text-soft)]">
                                Session: {run.session_key}
                              </div>
                              {run.finished_at ? (
                                <div className="text-[var(--text-soft)]">
                                  Finished: <TimeStamp value={run.finished_at} now={now} />
                                </div>
                              ) : null}
                              {run.error_message ? (
                                <div className="text-[var(--danger-strong)]">
                                  Error: {run.error_message}
                                </div>
                              ) : null}
                              <details className="mt-2 rounded-md bg-[var(--surface-soft)] px-3 py-2">
                                <summary className="cursor-pointer text-xs font-medium text-[var(--text-muted)]">
                                  查看 Prompt Snapshot
                                </summary>
                                <pre className="mt-2 whitespace-pre-wrap break-words font-['IBM_Plex_Mono',monospace] text-[11px] leading-5 text-[var(--text-main)]">
                                  {run.prompt}
                                </pre>
                              </details>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="rounded-lg bg-[var(--surface-subtle)] p-4 text-center text-sm text-[var(--text-muted)]">
                          暂无运行记录
                        </div>
                      )}
                    </section>

                    <section className="space-y-2">
                      <div className="flex items-center justify-between rounded-xl bg-[var(--surface-subtle)] px-4 py-3">
                        <h3 className="font-['Space_Grotesk',sans-serif] text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          Related Logs
                        </h3>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {debugData?.logs?.length ? `${debugData.logs.length} 条` : '暂无'}
                        </span>
                      </div>
                      {debugData?.logs?.length ? (
                        debugData.logs.map((item, index) => (
                          <motion.div
                            key={`${item.ts}-${item.message}-${index}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03, duration: 0.2, ease: 'easeOut' }}
                            className="rounded-lg bg-[var(--surface-subtle)] p-3"
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="theme-accent-pill rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em]">
                                {item.source}
                              </span>
                              <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-medium uppercase text-[var(--text-muted)]">
                                {item.level}
                              </span>
                              <TimeStamp
                                value={item.ts}
                                now={now}
                                className="text-[11px] text-[var(--text-muted)]"
                              />
                            </div>
                            <p className="text-sm text-[var(--text-main)]">
                              {item.message || '(无消息)'}
                            </p>
                            {item.meta ? (
                              <pre className="mt-2 overflow-auto rounded-md bg-[var(--surface-soft)] p-3 font-['IBM_Plex_Mono',monospace] text-[11px] leading-5 text-[var(--text-main)]">
                                {renderLogMeta(item.meta)}
                              </pre>
                            ) : null}
                          </motion.div>
                        ))
                      ) : (
                        <div className="rounded-lg bg-[var(--surface-subtle)] p-4 text-center text-sm text-[var(--text-muted)]">
                          暂无相关日志
                        </div>
                      )}
                    </section>
                  </>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent
              value="report"
              className="min-h-0 flex-1 overflow-auto pr-1"
            >
              {reportState === 'loading' ? (
                <ReportSkeleton />
              ) : null}
              {reportError ? (
                <div className="theme-danger rounded-lg p-4 text-sm">
                  {reportError}
                </div>
              ) : null}
              {!reportError && reportState !== 'loading' ? (
                <article
                  className="markdown-body rounded-lg bg-[var(--surface-subtle)] px-5 pb-5 pt-[0.5px]"
                  dangerouslySetInnerHTML={{ __html: reportHtml }}
                />
              ) : null}
            </TabsContent>

            <TabsContent
              value="html"
              className="min-h-0 flex-1 overflow-hidden"
            >
              <div className="flex h-full flex-col gap-3">
                {htmlReportState === 'loading' && !htmlLoaded ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-lg">
                    <div className="flex items-center justify-center gap-1">
                      {[0, 1, 2, 3, 4].map(i => (
                        <motion.div
                          key={i}
                          className="h-8 w-2 rounded-full bg-[var(--accent)]"
                          animate={{
                            scaleY: [0.4, 1, 0.4],
                          }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: i * 0.1,
                            ease: 'easeInOut',
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">
                      正在加载 HTML 报告...
                    </span>
                  </div>
                ) : htmlReportState === 'error' ? (
                  <div className="theme-danger flex flex-1 items-center justify-center rounded-lg text-sm">
                    HTML 报告不可用
                  </div>
                ) : htmlReportUrl ? (
                  <iframe
                    src={htmlReportUrl}
                    className="flex-1 rounded-lg"
                    title="HTML Report"
                    sandbox=""
                    referrerPolicy="no-referrer"
                    onLoad={() => setHtmlLoaded(true)}
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-lg text-sm text-[var(--text-muted)]">
                    切换到 HTML 标签页以加载报告
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent
              value="files"
              className="min-h-0 flex-1 overflow-hidden"
            >
              <div
                className={cn(
                  'grid h-full min-h-0 gap-3',
                  showPreview
                    ? 'grid-cols-1 xl:grid-cols-[300px_1fr]'
                    : 'grid-cols-1',
                )}
              >
                <aside className="min-h-0 overflow-auto rounded-lg bg-[var(--surface-subtle)] p-3">
                  <div className="mb-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>当前路径</span>
                    <span className="font-['Space_Grotesk',sans-serif] text-[11px]">
                      /{filesPath || ''}
                    </span>
                  </div>
                  {filesState === 'loading' ? (
                    <FilesListSkeleton />
                  ) : (
                    <div className="space-y-1">
                      {filesPath ? (
                        <button
                          type="button"
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-soft)]"
                          onClick={() =>
                            onLoadFiles(
                              filesPath.split('/').slice(0, -1).join('/'),
                            )
                          }
                        >
                          ..
                        </button>
                      ) : null}
                      {filesItems.map(item => (
                        <button
                          key={item.path}
                          type="button"
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-soft)]"
                          onClick={() =>
                            item.type === 'dir'
                              ? onLoadFiles(item.path)
                              : onLoadFilePreview(item.path)
                          }
                        >
                          <span className="truncate">{item.name}</span>
                          <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                            {item.type === 'dir' ? (
                              '目录'
                            ) : (
                              <>
                                {readableFileSize(item.size)}
                                {item.mtime ? (
                                  <span className="ml-1.5 opacity-60">
                                    <TimeStamp value={item.mtime} now={now} />
                                  </span>
                                ) : null}
                              </>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </aside>
                {showPreview ? (
                  <section className="min-h-0 overflow-auto rounded-lg bg-[var(--surface-subtle)] p-4">
                    {filePreviewState === 'loading' ? (
                      <FilePreviewSkeleton />
                    ) : fileAudioData ? (
                      <AudioPlayer
                        src={`/api/tasks/${task.id}/file?path=${encodeURIComponent(selectedFilePath)}`}
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-main)]">
                        {filePreview}
                      </pre>
                    )}
                  </section>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
