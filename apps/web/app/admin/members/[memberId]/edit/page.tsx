import { EditMemberView } from '@/features/members/member-form';
export default async function Page({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  return <EditMemberView id={memberId} />;
}
