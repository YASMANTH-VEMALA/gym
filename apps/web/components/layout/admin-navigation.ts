import {
  LayoutDashboard,
  Building2,
  Users,
  UserRoundCog,
  CreditCard,
  BadgeCheck,
  Wallet,
  ScanLine,
  QrCode,
  ChartNoAxesCombined,
  Settings2,
} from 'lucide-react';

export interface NavigationItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  section: string;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const navigation: NavigationGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        path: '/admin/dashboard',
        icon: LayoutDashboard,
        section: 'dashboard',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        label: 'Attendance',
        path: '/admin/attendance',
        icon: ScanLine,
        section: 'monthly_sheet',
      },
      {
        label: 'QR Management',
        path: '/admin/qr',
        icon: QrCode,
        section: 'qr',
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        label: 'Members',
        path: '/admin/members',
        icon: Users,
        section: 'members',
      },
      {
        label: 'Branches',
        path: '/admin/branches',
        icon: Building2,
        section: 'branches',
      },
      {
        label: 'Staff',
        path: '/admin/staff',
        icon: UserRoundCog,
        section: 'staff',
      },
    ],
  },
  {
    label: 'Billing',
    items: [
      {
        label: 'Payments',
        path: '/admin/payments',
        icon: Wallet,
        section: 'payments',
      },
      {
        label: 'Memberships',
        path: '/admin/memberships',
        icon: BadgeCheck,
        section: 'memberships',
      },
      {
        label: 'Plans & Pricing',
        path: '/admin/membership-plans',
        icon: CreditCard,
        section: 'plans',
      },
    ],
  },
  {
    label: 'Workspace',
    items: [
      {
        label: 'Reports',
        path: '/admin/reports',
        icon: ChartNoAxesCombined,
        section: 'reports',
      },
      {
        label: 'Settings & Access',
        path: '/admin/settings',
        icon: Settings2,
        section: 'settings',
      },
    ],
  },
];

export function pageTitle(path: string) {
  if (path.startsWith('/admin/memberships/')) return 'Memberships';
  if (path === '/admin/payments') return 'Payments';
  if (path.startsWith('/admin/members/')) return 'Members';
  if (path.startsWith('/admin/membership-plans/')) return 'Membership Plans';
  if (path.startsWith('/admin/branches/')) return 'Branches';
  if (path.startsWith('/admin/staff/')) return 'Staff';
  if (path.startsWith('/admin/attendance')) return 'Monthly Attendance Sheet';
  if (path === '/admin/settings/access') return 'Access & Team Permissions';
  return (
    navigation
      .flatMap((group) => group.items)
      .find((item) => item.path === path || path.startsWith(item.path))?.label ||
    'Gym Workspace'
  );
}
