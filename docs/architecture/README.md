# Architecture boundaries

Phase 6 adds [Member Management](member-management.md) in `src/modules/members`. Members are business-owned profiles, separate from authentication and future memberships, with generated numbers and current-phone uniqueness.

Phase 5 adds [Membership Plan Management](membership-plans.md) in `src/modules/membership-plans`, with integer minor-unit prices, calendar-day durations, branch applicability, and Owner/Admin lifecycle operations.

Phase 4 adds [Staff Management](staff-management.md) in `src/modules/staff`. It owns employment records and branch assignments and reuses the existing Owner/Admin access boundary.

Phase 3 adds the connected [Branch Management module](branch-management.md), reusing the existing authentication, business access, and shell. Its NestJS module lives in `src/modules/branches` and owns branch validation, tenant isolation, and archive rules.

The Gym product is one standalone product with two independently runnable applications. The backend is a modular monolith; it may later run as an independent service connected to a Main SaaS Platform.

- `apps/web` owns presentation and communicates with the backend through REST APIs. It must not import backend source or Prisma code.
- `apps/api` owns the database and domain logic. `src/modules/auth` implements JWT/JWKS authentication, Owner onboarding, business access, and Admin invitations. `src/modules/dashboard` reuses those providers for the connected dashboard. Other gym modules remain future work.
- `common` is reserved for genuinely cross-cutting backend behavior. Integration boundaries live under `integrations`, `database`, and `redis`.
- `packages/ui`, `types`, `validation`, `config`, and `constants` are reserved for reusable frontend components, contracts, schemas, configuration, and constants respectively. They must not depend on applications or contain product business logic. Shared packages currently have no runtime interdependencies.
- Business context is authorized in NestJS using verified JWT subjects and database access records. Owners manage invitations; Owners and Admins access all branches in their business. Future branch restrictions must also be enforced in the backend.
- Future Main SaaS integration should use explicit API contracts without coupling either application's internals to that platform.

Supabase Google OAuth/email OTP, Resend invitation delivery, onboarding, business access, and the Admin shell/dashboard are implemented. See [authentication](authentication.md) for configuration and security and [Phase 2](admin-dashboard.md) for dashboard contracts, routes, and scope. Storage, Redis, other gym operations, and the Member template remain future work. Docker, microservices, queues, CI/CD, and deployment configuration are outside this foundation.
