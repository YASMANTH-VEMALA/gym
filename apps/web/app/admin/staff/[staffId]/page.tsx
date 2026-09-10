import { StaffDetailView } from '@/features/staff/staff-detail';
export default async function Page({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  return <StaffDetailView id={(await params).staffId} />;
}
