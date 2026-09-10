const { Client } = require('pg');
const { loadEnvFile } = require('node:process');
const { resolve } = require('node:path');
loadEnvFile(resolve(__dirname, '../../../.env'));
const client = new Client({
  connectionString: process.env.DIRECT_URL,
  connectionTimeoutMillis: 8000,
});
client
  .connect()
  .then(() =>
    client.query("select tablename from pg_tables where schemaname = 'public'"),
  )
  .then((result) => console.log(JSON.stringify(result.rows)))
  .catch(() => {
    console.error(
      'Database inspection failed: connection unavailable. No schema changes applied.',
    );
    process.exitCode = 1;
  })
  .finally(() => client.end());
