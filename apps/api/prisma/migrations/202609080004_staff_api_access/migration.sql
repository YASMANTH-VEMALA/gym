BEGIN;
-- Match the existing application's API-only access boundary. Browser clients
-- must pass through NestJS tenant authorization, not access PostgREST tables.
ALTER TABLE "Staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffBranchAssignment" ENABLE ROW LEVEL SECURITY;
COMMIT;
