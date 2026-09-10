import { PlanDetailView } from '@/features/membership-plans/plan-detail';
export default async function Page({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  return <PlanDetailView id={(await params).planId} />;
}
