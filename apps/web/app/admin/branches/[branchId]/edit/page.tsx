import { EditBranchView } from '@/features/branches/branch-form';
export default async function Page({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  return <EditBranchView id={(await params).branchId} />;
}
