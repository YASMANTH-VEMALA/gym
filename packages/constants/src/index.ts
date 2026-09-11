export const ACCESS_SECTIONS = [
  {
    slug: 'dashboard',
    label: 'Dashboard',
    description: 'Overview metrics, charts and live floor feed',
  },
  {
    slug: 'monthly_sheet',
    label: 'Monthly Tracking Sheet',
    description:
      'Interactive Google Sheets/Excel attendance matrix with in-place editing',
  },
  {
    slug: 'members',
    label: 'Members & Registrations',
    description: 'Member directory, profiles and member registrations',
  },
  {
    slug: 'attendance',
    label: 'Daily Attendance & Check-ins',
    description: 'Quick check-in/out and QR attendance',
  },
  {
    slug: 'payments',
    label: 'Cash Payments & Dues',
    description: 'Cash collection, daily cash drawer and dues ledger',
  },
  {
    slug: 'plans',
    label: 'Membership Plans',
    description: 'Configure membership tiers and pricing',
  },
  {
    slug: 'staff',
    label: 'Staff Management',
    description: 'Staff directory and branch assignments',
  },
  {
    slug: 'qr',
    label: 'QR Management',
    description: 'Branch and member QR code credentials',
  },
  {
    slug: 'reports',
    label: 'Reports & Analytics',
    description: 'Detailed financial and attendance exports',
  },
  {
    slug: 'settings',
    label: 'Settings & Team Access',
    description: 'Business details and team access permissions',
  },
] as const;

export type AccessSectionSlug = (typeof ACCESS_SECTIONS)[number]['slug'];

export const ALL_SECTION_SLUGS: AccessSectionSlug[] = ACCESS_SECTIONS.map(
  (s) => s.slug,
);
