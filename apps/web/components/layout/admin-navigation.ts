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
export const navigation = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Branches', path: '/admin/branches', icon: Building2 },
      { label: 'Members', path: '/admin/members', icon: Users },
      { label: 'Staff', path: '/admin/staff', icon: UserRoundCog },
    ],
  },
  {
    label: 'Membership',
    items: [
      {
        label: 'Membership Plans',
        path: '/admin/membership-plans',
        icon: CreditCard,
      },
      { label: 'Memberships', path: '/admin/memberships', icon: BadgeCheck },
      {
        label: 'Payments & Dues',
        path: '/admin/payments',
        icon: Wallet,
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Attendance', path: '/admin/attendance', icon: ScanLine },
      { label: 'QR Management', path: '/admin/qr', icon: QrCode },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Reports', path: '/admin/reports', icon: ChartNoAxesCombined },
    ],
  },
  {
    label: 'System',
    items: [{ label: 'Settings', path: '/admin/settings', icon: Settings2 }],
  },
];
export function pageTitle(path: string) {
  if (path.startsWith('/admin/memberships/')) return 'Memberships';
  if (path === '/admin/payments') return 'Payments';
  if (path.startsWith('/admin/members/')) return 'Members';
  if (path.startsWith('/admin/membership-plans/')) return 'Membership Plans';
  if (path.startsWith('/admin/branches/')) return 'Branches';
  if (path.startsWith('/admin/staff/')) return 'Staff';
  if (path === '/admin/settings/access') return 'Access management';
  return (
    navigation
      .flatMap((group) => group.items)
      .find((item) => item.path === path)?.label || 'Workspace'
  );
}
