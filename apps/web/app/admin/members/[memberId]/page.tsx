import { MemberDetailView } from '@/features/members/member-detail';
export default async function Page({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  return <MemberDetailView id={memberId} />;
}
