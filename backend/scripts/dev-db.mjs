/**
 * Local development database: a self-contained PostgreSQL instance, no system install or Docker
 * required. Data persists in .devdb/ between runs (gitignored). This is for local development only
 * — do not use this for anything you need to survive a machine reset or share with a team.
 *
 *   node scripts/dev-db.mjs          start (foreground; Ctrl+C to stop)
 */
import EmbeddedPostgres from 'embedded-postgres';

const PORT = 5433; // 5432 may be in use by a system PostgreSQL install; this stays out of its way.
const USER = 'agentmart';
const PASSWORD = 'agentmart_dev_password';
const DB = 'agentmart_admin';

const pg = new EmbeddedPostgres({
  databaseDir: './.devdb',
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
});

async function main() {
  await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase(DB);
    console.log(`✔ created database "${DB}"`);
  } catch (e) {
    if (!/already exists/i.test(e?.message ?? '')) throw e;
  }
  console.log(`PG READY on port ${PORT} (user=${USER}, db=${DB})`);
}

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

main().catch((e) => {
  console.error('✖', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
