import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'prisma/config';
const envPath = resolve(__dirname, '../../.env');
if (existsSync(envPath)) loadEnvFile(envPath);
// Prisma's schema engine and node-postgres use different TLS option names.
// Preserve strict verification when using the same connection URL in both.
const directUrl = process.env.DIRECT_URL || '';
function migrationUrl(value: string): string {
  if (!value) return value;
  const url = new URL(value);
  if (url.searchParams.get('sslmode') === 'verify-full') {
    url.searchParams.set('sslmode', 'require');
    url.searchParams.set('sslaccept', 'strict');
  }
  const root = url.searchParams.get('sslrootcert');
  if (root) {
    url.searchParams.set('sslcert', root);
    url.searchParams.delete('sslrootcert');
  }
  return url.href;
}
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Migration tooling needs the session pooler, never the transaction pooler.
  datasource: { url: migrationUrl(directUrl) },
});
