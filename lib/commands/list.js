import { listTasks } from '../task.js';
import { formatTaskList, info } from '../format.js';

export default function (program) {
  program
    .command('list')
    .description('List task records')
    .option('-s, --status <status>', 'Filter by status')
    .option('-a, --all', 'Include archived tasks')
    .action((opts) => {
      const tasks = listTasks({ status: opts.status, all: opts.all });
      info(`${tasks.length} record(s) found`);
      console.log();
      console.log(formatTaskList(tasks));
    });
}
