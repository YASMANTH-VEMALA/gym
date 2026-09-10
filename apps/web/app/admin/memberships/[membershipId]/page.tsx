import { MembershipDetail } from '@/features/memberships/membership-pages';
export default async function Page({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;
  return <MembershipDetail id={membershipId} />;
}
