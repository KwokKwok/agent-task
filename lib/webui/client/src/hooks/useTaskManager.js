import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { POLL_INTERVAL_MS, QUICK_FILTERS } from '../constants';
import {
  fetchJson,
  markdownToHtml,
  resolveInitialTaskAndTab,
  sortByPriorityThenTime,
  sortByTimeDesc,
  syncTaskRoute,
} from '../lib/helpers.js';

async function sendJson(path, method, body) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

const PANEL_EXIT_MS = 180;

export function useTaskManager() {
  const initialRoute = useMemo(() => resolveInitialTaskAndTab(), []);
  const panelCloseTimerRef = useRef(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [listError, setListError] = useState('');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState(initialRoute.taskId);
  const [activeTab, setActiveTab] = useState(initialRoute.tab);
  const [isPanelClosing, setIsPanelClosing] = useState(false);

  const [detailTask, setDetailTask] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [debugData, setDebugData] = useState({ summary: null, runs: [], logs: [] });
  const [debugState, setDebugState] = useState('idle');
  const [debugError, setDebugError] = useState('');

  const [feedbackItems, setFeedbackItems] = useState([]);
  const [feedbackState, setFeedbackState] = useState('idle');
  const [feedbackError, setFeedbackError] = useState('');

  const [reportHtml, setReportHtml] = useState('');
  const [reportState, setReportState] = useState('idle');
  const [reportError, setReportError] = useState('');

  const [htmlReportUrl, setHtmlReportUrl] = useState('');
  const [htmlReportOriginalUrl, setHtmlReportOriginalUrl] = useState('');
  const [htmlReportState, setHtmlReportState] = useState('idle');

  const [filesPath, setFilesPath] = useState('');
  const [filesItems, setFilesItems] = useState([]);
  const [filesState, setFilesState] = useState('idle');
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [filePreview, setFilePreview] = useState('');
  const [filePreviewState, setFilePreviewState] = useState('idle');
  const [fileAudioData, setFileAudioData] = useState(null);

  const [now, setNow] = useState(Date.now());
  const panelOpen = Boolean(selectedTaskId);

  const visibleTasks = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = tasks.filter((task) => {
      if (statusFilter === 'all' && task.status === 'archived') return false;
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (!keyword) return true;
      const hay = `${task.id} ${task.title || ''} ${task.description || ''} ${task.status || ''} ${task.priority || ''}`.toLowerCase();
      return hay.includes(keyword);
    });
    return statusFilter === 'todo'
      ? sortByPriorityThenTime(filtered)
      : sortByTimeDesc(filtered);
  }, [tasks, search, statusFilter]);

  const countsByStatus = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const baseFiltered = tasks.filter((task) => {
      if (!keyword) return true;
      const hay = `${task.id} ${task.title || ''} ${task.description || ''} ${task.status || ''} ${task.priority || ''}`.toLowerCase();
      return hay.includes(keyword);
    });
    return QUICK_FILTERS.reduce((acc, filter) => {
      acc[filter.value] = filter.value === 'all'
        ? baseFiltered.filter((task) => task.status !== 'archived').length
        : baseFiltered.filter((task) => task.status === filter.value).length;
      return acc;
    }, {});
  }, [tasks, search]);

  const loadTaskList = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    setListError('');
    try {
      const query = new URLSearchParams({
        status: 'all',
        sortBy: 'updated_at',
        order: 'desc',
      });
      const data = await fetchJson(`/api/tasks?${query.toString()}`);
      setTasks(data.items || []);
    } catch (error) {
      setListError(error.message || '加载记录失败');
    } finally {
      setIsBootstrapping(false);
      if (manual) setIsRefreshing(false);
    }
  }, []);

  const loadOverview = useCallback(async (taskId, { silent = false } = {}) => {
    if (!silent) setDetailLoading(true);
    setDetailError('');
    try {
      const [task, eventData] = await Promise.all([
        fetchJson(`/api/tasks/${taskId}`),
        fetchJson(`/api/tasks/${taskId}/events`),
      ]);
      setDetailTask(task);
      setEvents(eventData.items || []);
    } catch (error) {
      setDetailError(error.message || '记录详情加载失败');
    } finally {
      if (!silent) setDetailLoading(false);
    }
  }, []);

  const loadFeedback = useCallback(async (taskId, { silent = false } = {}) => {
    if (!silent) setFeedbackState('loading');
    setFeedbackError('');
    try {
      const data = await fetchJson(`/api/tasks/${taskId}/feedback`);
      setFeedbackItems(data.items || []);
      setFeedbackState('ready');
    } catch (error) {
      setFeedbackItems([]);
      setFeedbackError(error.message || '反馈加载失败');
      setFeedbackState('error');
    }
  }, []);

  const loadReport = useCallback(async (taskId, { silent = false } = {}) => {
    if (!silent) setReportState('loading');
    setReportError('');
    try {
      const data = await fetchJson(`/api/tasks/${taskId}/report`);
      setReportHtml(markdownToHtml(data.content || ''));
      setReportState('ready');
    } catch (error) {
      setReportHtml('');
      setReportError(error.message || 'report.md 不可用');
      setReportState('error');
    }
  }, []);

  const loadDebug = useCallback(async (taskId, { silent = false } = {}) => {
    if (!silent) setDebugState('loading');
    setDebugError('');
    try {
      const data = await fetchJson(`/api/tasks/${taskId}/debug`);
      setDebugData({
        summary: data.summary || null,
        runs: data.runs || [],
        logs: data.logs || [],
      });
      setDebugState('ready');
    } catch (error) {
      setDebugData({ summary: null, runs: [], logs: [] });
      setDebugError(error.message || '调试信息加载失败');
      setDebugState('error');
    }
  }, []);

  const loadHtmlReport = useCallback(async (taskId) => {
    setHtmlReportState('loading');
    try {
      const apiPath = `/api/tasks/${taskId}/open-report`;
      const res = await fetch(apiPath, { credentials: 'include' });
      if (!res.ok) throw new Error('HTML report 不可用');
      const html = await res.text();
      setHtmlReportOriginalUrl(`${window.location.origin}${apiPath}?mode=interactive`);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setHtmlReportUrl(url);
      setHtmlReportState('ready');
    } catch {
      setHtmlReportUrl('');
      setHtmlReportOriginalUrl('');
      setHtmlReportState('error');
    }
  }, []);

  const loadFiles = useCallback(async (taskId, path = '') => {
    setFilesState('loading');
    setSelectedFilePath('');
    setFilePreview('');
    setFilePreviewState('idle');
    try {
      const query = new URLSearchParams({ path });
      const data = await fetchJson(`/api/tasks/${taskId}/files?${query.toString()}`);
      setFilesPath(data.path || '');
      setFilesItems(data.items || []);
      setFilesState('ready');
    } catch (error) {
      setFilesState('error');
      setFilePreview(`无法加载文件列表: ${error.message}`);
    }
  }, []);

  const loadFilePreview = useCallback(async (taskId, path) => {
    setSelectedFilePath(path);
    setFilePreviewState('loading');
    try {
      const query = new URLSearchParams({ path, meta: 'true' });
      const data = await fetchJson(`/api/tasks/${taskId}/file?${query.toString()}`);
      if (data.type === 'audio') {
        setFilePreview(null);
        setFileAudioData(data);
      } else if (data.type === 'binary') {
        setFileAudioData(null);
        setFilePreview(`[binary] ${path}\nsize: ${data.size}\n${data.message || ''}`);
      } else {
        setFileAudioData(null);
        setFilePreview((data.content || '') + (data.truncated ? '\n\n[truncated]' : ''));
      }
      setFilePreviewState('ready');
    } catch (error) {
      setFileAudioData(null);
      setFilePreviewState('error');
      setFilePreview(`无法加载文件: ${error.message}`);
    }
  }, []);

  const selectTask = useCallback((taskId) => {
    if (panelCloseTimerRef.current) {
      window.clearTimeout(panelCloseTimerRef.current);
      panelCloseTimerRef.current = null;
    }
    setIsPanelClosing(false);
    setSelectedTaskId(taskId);
    setActiveTab('overview');
  }, []);

  const closePanelImmediately = useCallback(() => {
    if (panelCloseTimerRef.current) {
      window.clearTimeout(panelCloseTimerRef.current);
      panelCloseTimerRef.current = null;
    }
    setIsPanelClosing(false);
    setSelectedTaskId(null);
  }, []);

  const closePanel = useCallback(() => {
    if (!selectedTaskId || isPanelClosing) return;
    setIsPanelClosing(true);
    panelCloseTimerRef.current = window.setTimeout(() => {
      panelCloseTimerRef.current = null;
      closePanelImmediately();
    }, PANEL_EXIT_MS);
  }, [selectedTaskId, isPanelClosing, closePanelImmediately]);

  const updateStatus = useCallback(async (status) => {
    if (!selectedTaskId) return;
    const updated = await sendJson(`/api/tasks/${selectedTaskId}/status`, 'PATCH', { status });
    if (status === 'archived') {
      await loadTaskList();
      closePanel();
      return;
    }
    setDetailTask(updated);
    await Promise.all([
      loadTaskList(),
      loadOverview(selectedTaskId),
      activeTab === 'debug' ? loadDebug(selectedTaskId) : Promise.resolve(),
    ]);
  }, [selectedTaskId, loadTaskList, loadOverview, loadDebug, closePanel, activeTab]);

  const rejectTask = useCallback(async (message) => {
    if (!selectedTaskId) return;
    if (!String(message || '').trim()) return;
    await sendJson(`/api/tasks/${selectedTaskId}/feedback/reject`, 'POST', { message });
    await Promise.all([
      loadOverview(selectedTaskId),
      loadTaskList(),
      loadFeedback(selectedTaskId),
      activeTab === 'debug' ? loadDebug(selectedTaskId) : Promise.resolve(),
    ]);
  }, [selectedTaskId, loadOverview, loadTaskList, loadFeedback, loadDebug, activeTab]);

  const onLoadFiles = useCallback((path) => {
    if (selectedTaskId) void loadFiles(selectedTaskId, path);
  }, [selectedTaskId, loadFiles]);

  const onLoadFilePreview = useCallback((path) => {
    if (selectedTaskId) void loadFilePreview(selectedTaskId, path);
  }, [selectedTaskId, loadFilePreview]);

  useEffect(() => {
    return () => {
      if (panelCloseTimerRef.current) {
        window.clearTimeout(panelCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void loadTaskList();
  }, [loadTaskList]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadTaskList();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadTaskList]);

  useEffect(() => {
    if (!selectedTaskId) {
      setDetailTask(null);
      setDetailError('');
      setEvents([]);
      setFeedbackItems([]);
      setFeedbackState('idle');
      setFeedbackError('');
      setDebugData({ summary: null, runs: [], logs: [] });
      setDebugState('idle');
      setDebugError('');
      setReportState('idle');
      setReportHtml('');
      setReportError('');
      setFilesPath('');
      setFilesItems([]);
      setFilesState('idle');
      setSelectedFilePath('');
      setFilePreview('');
      setFilePreviewState('idle');
      setFileAudioData(null);
      setHtmlReportUrl('');
      setHtmlReportOriginalUrl('');
      setHtmlReportState('idle');
      return;
    }
    setReportState('idle');
    setReportHtml('');
    setReportError('');
    setFeedbackState('idle');
    setFeedbackError('');
    setFeedbackItems([]);
    setDebugData({ summary: null, runs: [], logs: [] });
    setDebugState('idle');
    setDebugError('');
    setHtmlReportUrl('');
    setHtmlReportOriginalUrl('');
    setHtmlReportState('idle');
    setFilesPath('');
    setFilesItems([]);
    setFilesState('idle');
    setSelectedFilePath('');
    setFilePreview('');
    setFilePreviewState('idle');
    void loadOverview(selectedTaskId);
  }, [selectedTaskId, loadOverview]);

  useEffect(() => {
    return () => {
      if (htmlReportUrl) URL.revokeObjectURL(htmlReportUrl);
    };
  }, [htmlReportUrl]);

  useEffect(() => {
    if (!selectedTaskId) return;
    if (activeTab === 'feedback' && feedbackState === 'idle') {
      void loadFeedback(selectedTaskId);
    }
    if (activeTab === 'report' && reportState === 'idle') {
      void loadReport(selectedTaskId);
    }
    if (activeTab === 'debug' && debugState === 'idle') {
      void loadDebug(selectedTaskId);
    }
    if (activeTab === 'html' && htmlReportState === 'idle') {
      void loadHtmlReport(selectedTaskId);
    }
    if (activeTab === 'files' && filesState === 'idle') {
      void loadFiles(selectedTaskId, '');
    }
  }, [
    selectedTaskId,
    activeTab,
    feedbackState,
    reportState,
    debugState,
    htmlReportState,
    filesState,
    loadFeedback,
    loadReport,
    loadDebug,
    loadHtmlReport,
    loadFiles,
  ]);

  useEffect(() => {
    if (!selectedTaskId || !detailTask || detailLoading) return;
    const latestSummary = tasks.find((item) => item.id === selectedTaskId);
    if (!latestSummary || latestSummary.updated_at === detailTask.updated_at) return;

    setDetailTask((current) => (
      current?.id === latestSummary.id
        ? { ...current, ...latestSummary }
        : current
    ));

    void loadOverview(selectedTaskId, { silent: true });

    if (activeTab === 'feedback' && feedbackState === 'ready') {
      void loadFeedback(selectedTaskId, { silent: true });
    }
    if (activeTab === 'report' && reportState === 'ready') {
      void loadReport(selectedTaskId, { silent: true });
    }
    if (activeTab === 'debug' && debugState === 'ready') {
      void loadDebug(selectedTaskId, { silent: true });
    }
  }, [
    tasks,
    selectedTaskId,
    detailTask,
    detailLoading,
    activeTab,
    feedbackState,
    reportState,
    debugState,
    loadOverview,
    loadFeedback,
    loadReport,
    loadDebug,
  ]);

  useEffect(() => {
    syncTaskRoute(selectedTaskId, activeTab);
  }, [selectedTaskId, activeTab]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    search, setSearch,
    statusFilter, setStatusFilter,
    visibleTasks,
    countsByStatus,
    listError,
    isBootstrapping,
    isRefreshing,
    loadTaskList,
    selectedTaskId,
    selectTask,
    closePanel,
    isPanelClosing,
    panelOpen,
    activeTab, setActiveTab,
    detailTask,
    detailError,
    detailLoading,
    events,
    feedbackItems,
    feedbackState,
    feedbackError,
    debugData,
    debugState,
    debugError,
    rejectTask,
    updateStatus,
    reportHtml,
    reportState,
    reportError,
    htmlReportUrl,
    htmlReportOriginalUrl,
    htmlReportState,
    filesPath,
    filesItems,
    filesState,
    selectedFilePath,
    filePreview,
    filePreviewState,
    fileAudioData,
    onLoadFiles,
    onLoadFilePreview,
    now,
  };
}
