/** Phase 2 dashboard wire contract. Monetary values are in minor units. */
export * from './members';
export type {
  MembershipPlanStatus,
  MembershipPlanInput,
  MembershipPlanRecord,
  MembershipPlanDetail,
  MembershipPlanList,
  PlanBranch,
} from './membership-plans';
export type {
  BranchStatus,
  BranchInput,
  BranchRecord,
  BranchDetail,
  BranchList,
} from './branches';
export type {
  StaffStatus,
  StaffBranch,
  StaffInput,
  StaffRecord,
  StaffDetail,
  StaffList,
} from './staff';
export interface DashboardResponse {
  business: { id: string; name: string; currency: string; timezone: string };
  role: 'OWNER' | 'ADMIN';
  branchSummary: {
    total: number;
    inScope: number;
    selected: { id: string; name: string } | null;
  };
  metrics: {
    totalMembers: number;
    activeMembers: number;
    collections: number;
    outstandingDues: number;
    todayCheckIns: number;
    expiringSoon: number;
    totalStaff: number;
  };
  recentActivity: { id: string; label: string; occurredAt: string }[];
  activityScope: 'business';
  upcomingExpirations: {
    id: string;
    memberName: string;
    planName: string;
    endDate: string;
  }[];
  outstandingDues: {
    id: string;
    memberName: string;
    amountMinor: number;
    dueDate: string;
  }[];
  chartData: {
    collections: { date: string; amountMinor: number }[];
    memberGrowth: { date: string; count: number }[];
  };
  generatedAt: string;
}
