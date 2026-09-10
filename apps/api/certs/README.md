# Supabase database CA

`supabase-ca.crt` is the public Supabase Root 2021 CA certificate, downloaded from
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt.
It contains no private key. The certificate expires on April 26, 2031.

For Supabase database URLs, set `sslmode=verify-full` and `sslrootcert` to the
absolute path of this file. Node PostgreSQL then verifies both the certificate
chain and hostname. Prisma CLI maps these to its `sslmode=require`,
`sslaccept=strict`, and `sslcert` options. Never disable certificate validation.

See [Supabase SSL configuration](https://supabase.com/docs/guides/platform/ssl-enforcement).
