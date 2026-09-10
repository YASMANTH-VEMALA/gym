export type MembershipPlanStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export interface MembershipPlanInput {
  name: string;
  description?: string | null;
  priceMinor: number;
  durationDays: number;
  appliesToAllBranches: boolean;
  branchIds?: string[];
  status?: 'ACTIVE' | 'INACTIVE';
}
export interface PlanBranch {
  id: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
}
export interface MembershipPlanRecord extends Omit<
  MembershipPlanInput,
  'branchIds' | 'status'
> {
  id: string;
  businessId: string;
  status: MembershipPlanStatus;
  branches: PlanBranch[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  activeMembers: number;
}
export interface MembershipPlanDetail extends MembershipPlanRecord {
  business: { name: string; currency: string; timezone: string };
  eligibleBranches: PlanBranch[];
  metrics: {
    activeMembers: number;
    totalMembers: number;
    revenueMinor: number;
  };
}
export interface MembershipPlanList {
  items: MembershipPlanRecord[];
  total: number;
  page: number;
  pageSize: number;
}
