export const QUICK_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'todo', label: '待开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'archived', label: '已归档' },
] as const;

export const STATUS_VALUES = [
  'todo',
  'in_progress',
  'done',
  'archived',
] as const;

export const TAB_VALUES = ['overview', 'feedback', 'report', 'html', 'files', 'debug'] as const;
export const POLL_INTERVAL_MS = 3000;

export const PRIORITY_RANK = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const;

export const PRIORITY_LABEL = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
} as const;

export const EVENT_LABEL = {
  created: '记录创建',
  status_changed: '状态变更',
  workspace_created: '工作区已创建',
  archived: '记录归档',
  dispatch_started: '自动派发',
  dispatch_failed: '派发失败',
  dispatch_timed_out: '执行超时',
  repair_started: '自动续作',
  repair_failed: '续作失败',
  repair_exhausted: '续作次数已用尽',
  feedback_reject: '驳回反馈',
  feedback_comment: '补充意见',
  feedback_update: 'AI 更新说明',
} as const;

export const STATUS_META = {
  todo: { label: '待开始', tone: 'default' },
  in_progress: { label: '进行中', tone: 'active' },
  done: { label: '已完成', tone: 'done' },
  archived: { label: '已归档', tone: 'default' },
} as const;
