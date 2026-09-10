import { BranchDetailView } from '@/features/branches/branch-detail';
export default async function Page({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  return <BranchDetailView id={(await params).branchId} />;
}
