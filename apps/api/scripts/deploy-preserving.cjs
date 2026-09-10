// Additive migration deployment with a before/after preservation check.
const { Client } = require('pg');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
require('node:process').loadEnvFile(resolve(__dirname, '../../../.env'));
const client = new Client({
  connectionString: process.env.DIRECT_URL,
  connectionTimeoutMillis: 10000,
});
(async () => {
  await client.connect();
  const tables = (
    await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename",
    )
  ).rows.map((x) => x.tablename);
  const columns = {};
  for (const table of tables) {
    columns[table] = (
      await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
        [table],
      )
    ).rows
      .map((r) => '"' + r.column_name.replaceAll('"', '""') + '"')
      .join(',');
  }
  const snapshot = async () => {
    const result = {};
    for (const table of tables) {
      const identifier = '"' + table.replaceAll('"', '""') + '"';
      result[table] = (
        await client.query(
          `SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY row_to_json(t)::text),'')) AS digest FROM (SELECT ${columns[table]} FROM ${identifier}) t`,
        )
      ).rows[0];
    }
    return result;
  };
  const before = await snapshot();
  const migration = spawnSync(
    process.execPath,
    [
      resolve(__dirname, '../../../node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--config',
      resolve(__dirname, '../prisma.config.ts'),
    ],
    { encoding: 'utf8', timeout: 120000 },
  );
  if (migration.status !== 0) throw new Error('Migration deployment failed');
  const after = await snapshot();
  for (const table of tables) {
    if (JSON.stringify(before[table]) !== JSON.stringify(after[table]))
      throw new Error('Existing data changed during deployment');
    console.log(`${table}: ${after[table].count} existing rows unchanged`);
  }
  console.log('Additive migrations applied; existing data preserved.');
})()
  .catch(() => {
    console.error(
      'Migration/preservation check failed. Inspect migration status before proceeding.',
    );
    process.exitCode = 1;
  })
  .finally(() => client.end());
