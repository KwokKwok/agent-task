import { setStatus } from '../task.js';
import { formatTask, success, error } from '../format.js';

export default function (program) {
  program
    .command('status <id> <status>')
    .description('Change record status (todo, in_progress, done, archived)')
    .option('-m, --message <msg>', 'Transition message')
    .action((id, status, opts) => {
      try {
        const task = setStatus(id, status, opts.message);
        success(`${task.id} → ${status}`);
        console.log();
        console.log(formatTask(task));
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });
}
