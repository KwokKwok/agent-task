import { getTask, getTaskEvents } from '../task.js';
import { formatTask, formatEvents, error } from '../format.js';

export default function (program) {
  program
    .command('show <id>')
    .description('Show task record details')
    .action((id) => {
      const task = getTask(id);
      if (!task) {
        error(`Record not found: ${id}`);
        process.exit(1);
      }

      console.log(formatTask(task));
      console.log();

      const events = getTaskEvents(id);
      console.log('\x1b[1mEvents:\x1b[0m');
      console.log(formatEvents(events));
    });
}
