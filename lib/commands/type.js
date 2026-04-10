import { error, info, success } from '../format.js';
import {
  createTaskType,
  formatTaskTypesMarkdown,
  listTaskTypes,
  updateTaskType,
} from '../task-type.js';

function formatTaskTypeList(types) {
  if (!types.length) {
    return '(无任务类型)';
  }

  const idW = 18;
  const timeoutW = 10;
  const header = [
    'Type ID'.padEnd(idW),
    'Timeout'.padEnd(timeoutW),
    'Name'.padEnd(10),
    'Trigger',
  ].join('  ');
  const sep = '─'.repeat(88);

  const rows = types.map((item) => [
    item.id.padEnd(idW),
    `${item.openclaw?.timeoutSeconds || 1800}s`.padEnd(timeoutW),
    item.name.padEnd(10),
    item.triggerCondition || '',
  ].join('  '));

  return [header, sep, ...rows].join('\n');
}

function formatTaskTypeDetail(item) {
  return [
    `ID:         ${item.id}`,
    `Name:       ${item.name}`,
    `Trigger:    ${item.triggerCondition || '-'}`,
    `Before:     ${item.beforeCreate || '-'}`,
    `Timeout:    ${item.openclaw?.timeoutSeconds || 1800}s`,
    'Execution:',
    item.executionStepsReference || '-',
  ].join('\n');
}

export default function (program) {
  const command = program
    .command('type')
    .description('Inspect available task types');

  command
    .command('list')
    .description('List task types')
    .action(() => {
      try {
        const types = listTaskTypes();
        info(`${types.length} task type(s)`);
        console.log();
        console.log(formatTaskTypeList(types));
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });

  command
    .command('export')
    .description('Export all task types as markdown for agent intake')
    .action(() => {
      try {
        console.log(formatTaskTypesMarkdown(listTaskTypes()));
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });

  command
    .command('create')
    .description('Create a task type')
    .requiredOption('--id <id>', 'Task type id')
    .requiredOption('--name <name>', 'Task type name')
    .option('--trigger-condition <text>', 'Trigger condition shown to the chat agent')
    .option('--before-create <text>', 'What to do before creating this task type')
    .option('--execution-reference <text>', 'Execution reference markdown')
    .option('--timeout <seconds>', 'Default timeout in seconds')
    .action((opts) => {
      try {
        const item = createTaskType({
          id: opts.id,
          name: opts.name,
          triggerCondition: opts.triggerCondition,
          beforeCreate: opts.beforeCreate,
          executionStepsReference: opts.executionReference,
          timeoutSeconds: opts.timeout,
        });
        success(`Task type created: ${item.id}`);
        console.log();
        console.log(formatTaskTypeDetail(item));
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });

  command
    .command('update <id>')
    .description('Update a task type')
    .option('--name <name>', 'Task type name')
    .option('--trigger-condition <text>', 'Trigger condition shown to the chat agent')
    .option('--before-create <text>', 'What to do before creating this task type')
    .option('--execution-reference <text>', 'Execution reference markdown')
    .option('--timeout <seconds>', 'Default timeout in seconds')
    .action((id, opts) => {
      try {
        const item = updateTaskType(id, {
          name: opts.name,
          triggerCondition: opts.triggerCondition,
          beforeCreate: opts.beforeCreate,
          executionStepsReference: opts.executionReference,
          timeoutSeconds: opts.timeout,
        });
        success(`Task type updated: ${item.id}`);
        console.log();
        console.log(formatTaskTypeDetail(item));
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });
}
