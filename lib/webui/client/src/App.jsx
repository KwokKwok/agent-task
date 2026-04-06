import { MoonStar, Search, Settings, SunMedium, SunMoon } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input.jsx';
import { Toaster } from './components/ui/sonner';
import { Skeleton } from './components/ui/skeleton.jsx';
import { TooltipProvider } from './components/ui/tooltip';
import { DetailPanel } from './components/DetailPanel.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { TaskCard } from './components/TaskCard.jsx';
import { useTaskManager } from './hooks/useTaskManager.js';
import { useTheme } from './hooks/useTheme';
import { QUICK_FILTERS } from './constants';
import { cn } from './lib/utils';
import logoUrl from './logo.svg';

export default function App() {
  const [activePage, setActivePage] = useState('main');
  const tm = useTaskManager();
  const { preference, resolvedTheme, setThemePreference } = useTheme();

  const detailPanelProps = {
    task: tm.detailTask,
    events: tm.events,
    activeTab: tm.activeTab,
    onTabChange: tab => tm.setActiveTab(tab),
    onClose: tm.closePanel,
    reportState: tm.reportState,
    reportHtml: tm.reportHtml,
    reportError: tm.reportError,
    feedbackItems: tm.feedbackItems,
    feedbackState: tm.feedbackState,
    feedbackError: tm.feedbackError,
    debugData: tm.debugData,
    debugState: tm.debugState,
    debugError: tm.debugError,
    onRejectTask: tm.rejectTask,
    onUpdateStatus: tm.updateStatus,
    htmlReportUrl: tm.htmlReportUrl,
    htmlReportOriginalUrl: tm.htmlReportOriginalUrl,
    htmlReportState: tm.htmlReportState,
    detailLoading: tm.detailLoading,
    filesState: tm.filesState,
    filesPath: tm.filesPath,
    filesItems: tm.filesItems,
    filePreview: tm.filePreview,
    filePreviewState: tm.filePreviewState,
    fileAudioData: tm.fileAudioData,
    selectedFilePath: tm.selectedFilePath,
    onLoadFiles: tm.onLoadFiles,
    onLoadFilePreview: tm.onLoadFilePreview,
    now: tm.now,
  };

  // Settings modal overlay
  const showSettings = activePage === 'settings';
  const themeOrder = ['light', 'dark', 'system'];
  const currentThemeIndex = themeOrder.indexOf(preference);
  const nextTheme = themeOrder[(currentThemeIndex + 1) % themeOrder.length];
  const ThemeIcon = preference === 'system' ? SunMoon : preference === 'dark' ? MoonStar : SunMedium;
  const currentThemeLabel = preference === 'system'
    ? `跟随系统（当前${resolvedTheme === 'dark' ? '夜间' : '日间'}）`
    : preference === 'dark'
      ? '夜间'
      : '日间';
  const nextThemeLabel = nextTheme === 'system'
    ? '跟随系统'
    : nextTheme === 'dark'
      ? '夜间'
      : '日间';
  const themeButtonLabel = `主题：${currentThemeLabel}，点击切换到${nextThemeLabel}`;

  return (
    <TooltipProvider delayDuration={180}>
      <div className="app-shell min-h-screen">
        <Toaster
          theme={resolvedTheme}
          position="top-center"
          closeButton
        />
        <div className="app-backdrop pointer-events-none fixed inset-0" />

        {/* Settings Modal */}
        {showSettings && (
          <SettingsModal
            onClose={() => setActivePage('main')}
          />
        )}

        <div
          className={cn(
            'relative mx-auto flex h-screen max-w-[1900px] min-h-[680px] lg:grid',
            tm.panelOpen
              ? 'lg:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.4fr)]'
              : 'lg:grid-cols-1',
          )}
        >
          {/* Task list */}
          <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-3 md:px-4 md:pt-4 lg:px-0 lg:pt-0">
            <div
              className="flex-1 overflow-auto scroll-smooth"
              style={{ scrollbarWidth: 'none' }}
            >
              <header className="sticky top-0 z-30 space-y-4 px-2 pb-3 pt-2 md:px-3 md:pt-3">
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[calc(100%+2rem)] backdrop-blur-xl backdrop-saturate-150"
                  style={{
                    maskImage:
                      'linear-gradient(to bottom, black 60%, transparent)',
                    WebkitMaskImage:
                      'linear-gradient(to bottom, black 60%, transparent)',
                  }}
                />
                <div className="flex items-center gap-3">
                  <img
                    src={logoUrl}
                    alt="agent-task logo"
                    className="h-10 w-10 shrink-0"
                  />
                  <div className="relative w-full max-w-2xl">
                    <Search className="app-search-icon pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <Input
                      value={tm.search}
                      onChange={event => tm.setSearch(event.target.value)}
                      placeholder="搜索工作记录标题 / ID / 描述"
                      className="app-search h-10 pl-9"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setThemePreference(nextTheme)}
                    aria-label={themeButtonLabel}
                    title={themeButtonLabel}
                  >
                    <ThemeIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setActivePage('settings')}
                    aria-label="设置"
                    className="hidden lg:inline-flex"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {QUICK_FILTERS.map(item => (
                    <button
                      key={item.value}
                      type="button"
                      className={cn(
                        'filter-chip inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        tm.statusFilter === item.value
                          ? 'is-active'
                          : '',
                      )}
                      onClick={() => tm.setStatusFilter(item.value)}
                    >
                      {item.label}
                      <span
                        className={cn(
                          'filter-chip-count rounded-full px-1.5 py-0 text-[10px]',
                          tm.statusFilter === item.value ? 'is-active' : '',
                        )}
                      >
                        {tm.countsByStatus[item.value] || 0}
                      </span>
                    </button>
                  ))}
                </div>
              </header>

              <div className="px-2 pb-16 pt-2 md:px-3">
                {tm.isBootstrapping ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton
                        key={`skeleton-${index}`}
                        className="h-40 rounded-xl"
                      />
                    ))}
                  </div>
                ) : null}

                {!tm.isBootstrapping && tm.listError ? (
                  <div className="theme-danger rounded-xl border p-4 text-sm">
                    {tm.listError}
                  </div>
                ) : null}

                {!tm.isBootstrapping && !tm.listError ? (
                  tm.visibleTasks.length ? (
                    <div
                      className={cn(
                        'grid gap-3',
                        tm.panelOpen
                          ? 'grid-cols-1'
                          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
                      )}
                    >
                      {tm.visibleTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          isActive={tm.selectedTaskId === task.id}
                          panelOpen={tm.panelOpen}
                          onClick={() => tm.selectTask(task.id)}
                          now={tm.now}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="theme-empty rounded-xl border border-dashed p-6 text-center text-sm">
                      当前筛选条件下没有记录
                    </div>
                  )
                ) : null}
              </div>
            </div>

            <div className="app-footer-fade pointer-events-none absolute inset-x-0 bottom-0 h-20" />
          </section>

          {/* Desktop detail panel */}
          {tm.panelOpen ? (
            <motion.section
              initial={{ opacity: 0, x: 12 }}
              animate={tm.isPanelClosing ? { opacity: 0, x: 12 } : { opacity: 1, x: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="hidden min-h-0 py-2 pr-2 lg:block"
            >
              {tm.detailError ? (
                <div className="theme-danger flex h-full items-center justify-center rounded-[26px] border p-6 text-sm">
                  {tm.detailError}
                </div>
              ) : (
                <DetailPanel {...detailPanelProps} />
              )}
            </motion.section>
          ) : null}
        </div>

        {/* Mobile detail panel overlay */}
        {tm.panelOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={tm.isPanelClosing ? { opacity: 0 } : { opacity: 1 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed inset-0 z-30 bg-[var(--overlay-strong)] lg:hidden"
              onClick={tm.closePanel}
            />
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={tm.isPanelClosing ? { opacity: 0, y: 16 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-40 lg:hidden"
            >
              {tm.detailError ? (
                <div className="theme-danger flex h-full items-center justify-center rounded-none border p-6 text-sm lg:rounded-[24px]">
                  {tm.detailError}
                </div>
              ) : (
                <DetailPanel {...detailPanelProps} />
              )}
            </motion.section>
          </>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
