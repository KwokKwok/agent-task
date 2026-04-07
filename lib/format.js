const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

const STATUS_COLORS = {
  todo: 'yellow',
  in_progress: 'blue',
  done: 'green',
  archived: 'gray',
};

const PRIORITY_COLORS = {
  low: 'gray',
  medium: 'white',
  high: 'yellow',
  urgent: 'red',
};

function c(color, text) {
  return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

function indentMultiline(value, indent) {
  return String(value).replaceAll('\n', `\n${indent}`);
}

export function colorStatus(status) {
  return c(STATUS_COLORS[status] || 'white', status);
}

export function formatTask(task) {
  const lines = [
    `${c('bold', 'ID:')}        ${task.id}`,
    `${c('bold', 'Title:')}     ${task.title}`,
    `${c('bold', 'Status:')}    ${colorStatus(task.status)}`,
    `${c('bold', 'Priority:')}  ${c(PRIORITY_COLORS[task.priority] || 'white', task.priority)}`,
  ];

  if (task.description) {
    const indent = ' '.repeat(11);
    lines.push(`${c('bold', 'Desc:')}      ${indentMultiline(task.description, indent)}`);
  }
  if (task.type_id) {
    lines.push(`${c('bold', 'Type:')}      ${task.type_id}`);
  }
  if (task.workspace_path) {
    lines.push(`${c('bold', 'Workspace:')} ${task.workspace_path}`);
  }
  if (task.timeout_seconds) {
    lines.push(`${c('bold', 'Timeout:')}   ${task.timeout_seconds}s`);
  }
  if (task.dispatch_status && task.dispatch_status !== 'idle') {
    lines.push(`${c('bold', 'Dispatch:')}  ${task.dispatch_status}`);
  }
  lines.push(`${c('bold', 'Created:')}   ${task.created_at}`);
  lines.push(`${c('bold', 'Updated:')}   ${task.updated_at}`);

  return lines.join('\n');
}

export function formatTaskList(tasks) {
  if (!tasks.length) {
    return c('dim', '(无记录)');
  }

  const idW = 10;
  const statusW = 12;
  const prioW = 8;
  const typeW = 18;
  const timeW = 10;

  const header = [
    'ID'.padEnd(idW),
    'Status'.padEnd(statusW),
    'Priority'.padEnd(prioW),
    'Type'.padEnd(typeW),
    'Created'.padEnd(timeW),
    'Title',
  ].join('  ');

  const sep = c('dim', '─'.repeat(72));

  const rows = tasks.map(t => [
    t.id.padEnd(idW),
    colorStatus(t.status).padEnd(statusW + COLORS.reset.length + (COLORS[STATUS_COLORS[t.status]]?.length || 0)),
    c(PRIORITY_COLORS[t.priority] || 'white', t.priority).padEnd(prioW + COLORS.reset.length + (COLORS[PRIORITY_COLORS[t.priority]]?.length || 0)),
    String(t.type_id || '-').padEnd(typeW),
    t.created_at.slice(0, 10).padEnd(timeW),
    t.title,
  ].join('  '));

  return [c('bold', header), sep, ...rows].join('\n');
}

export function formatEvents(events) {
  if (!events.length) {
    return c('dim', '(无事件)');
  }
  return events.map(e =>
    `  ${c('dim', e.created_at.slice(0, 19))}  ${c('cyan', e.event_type)}  ${e.message || ''}`
  ).join('\n');
}

export function success(msg) {
  console.log(`${c('green', '✓')} ${msg}`);
}

export function error(msg) {
  console.error(`${c('red', '✗')} ${msg}`);
}

export function info(msg) {
  console.log(`${c('blue', 'ℹ')} ${msg}`);
}
