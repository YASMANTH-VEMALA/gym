import { EditStaffView } from '@/features/staff/staff-form';
export default async function Page({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  return <EditStaffView id={(await params).staffId} />;
}
