import { notFound } from 'next/navigation';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';
const modules: Record<string, string> = {
  branches: 'Branches',
  members: 'Members',
  staff: 'Staff',
  'membership-plans': 'Membership Plans',
  memberships: 'Memberships',
  dues: 'Dues',
  attendance: 'Attendance',
  'qr-management': 'QR Management',
  reports: 'Reports',
};
export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const title = Object.hasOwn(modules, module) ? modules[module] : undefined;
  if (!title) notFound();
  return <ModulePlaceholder title={title} />;
}
