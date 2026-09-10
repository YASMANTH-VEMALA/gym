import { EditPlanView } from '@/features/membership-plans/plan-form';
export default async function Page({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  return <EditPlanView id={(await params).planId} />;
}
