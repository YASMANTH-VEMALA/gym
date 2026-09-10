import { createBrowserClient } from '@supabase/ssr';
let client: ReturnType<typeof createBrowserClient> | undefined;
export function browserAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      'Authentication is not configured. Contact your administrator.',
    );
  return (client ??= createBrowserClient(url, key));
}
