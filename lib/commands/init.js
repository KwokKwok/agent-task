import { initDb } from '../db.js';
import { getBaseDir } from '../db.js';
import { success } from '../format.js';

export default function (program) {
  program
    .command('init')
    .description('Initialize agent-task data directory')
    .action(() => {
      initDb();
      success(`agent-task initialized at ${getBaseDir()}`);
    });
}
