import { AttendancePage } from '@/features/attendance/attendance-page';
export default async function Page({ searchParams }: PageProps<'/admin/attendance'>) {
  const { tab } = await searchParams;
  return <AttendancePage initialTab={tab === 'scanner' ? 'checkin' : 'sheet'} />;
}
