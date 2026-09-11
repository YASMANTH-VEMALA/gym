import type { AccessSectionSlug } from '@gym/constants';
export type { AccessSectionSlug };

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

export type AccessRole = 'OWNER' | 'ADMIN' | 'MANAGER';

export interface BusinessProfileInput {
  name?: string;
  timezone?: string;
  currency?: string;
  logoDataUrl?: string | null;
  logoUrl?: string | null;
}

export interface BusinessProfile {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  logoUrl: string | null;
  role: AccessRole;
}

export interface TeamMemberAccessDto {
  userId: string;
  email: string | null;
  role: AccessRole;
  assignedBranchId: string | null;
  assignedBranchName: string | null;
  permissions: AccessSectionSlug[];
}

export interface MonthlyMatrixDay {
  date: string; // 'YYYY-MM-DD'
  dayNumber: number; // 1..31
  dayOfWeek: string; // 'Mon', 'Tue'...
  isToday: boolean;
  isPast: boolean;
  isSunday: boolean;
}

export interface MonthlyMatrixMemberAttendance {
  memberId: string;
  fullName: string;
  memberNumber: string;
  phone: string;
  planName: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  attendance: Record<string, 'PRESENT' | 'ABSENT' | 'REST'>;
  totalPresent: number;
  totalAbsent: number;
  totalRest: number;
  attendanceRate: number; // percentage
  feeStatus: {
    status: 'PAID' | 'DUE' | 'NO_PLAN';
    outstandingMinor: number;
    currency: string;
    dueDate?: string | null;
  };
}

export interface MonthlyMatrixResponse {
  branch: {
    id: string;
    name: string;
  };
  year: number;
  month: number; // 1..12
  monthName: string; // 'September 2026'
  days: MonthlyMatrixDay[];
  members: MonthlyMatrixMemberAttendance[];
  dailyTotals: Record<string, number>; // date -> count of check-ins
  totalActiveMembers: number;
  averageDailyCheckins: number;
  googleSheetsConfig?: {
    connected: boolean;
    sheetId?: string | null;
    lastSyncedAt?: string | null;
  };
}

export interface UpdateMatrixCellInput {
  memberId: string;
  branchId: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'REST' | 'CLEAR';
  session?: string;
}

export interface DashboardResponse {
  business: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    logoUrl?: string | null;
  };
  role: AccessRole;
  assignedBranchId?: string | null;
  permissions?: AccessSectionSlug[];
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
    // Enhanced detailed operational metrics
    todayCashCollected?: number;
    monthCashCollected?: number;
    activeOnFloorNow?: number;
    membersWithDuesCount?: number;
    newRegistrationsThisMonth?: number;
  };
  recentActivity: { id: string; label: string; occurredAt: string }[];
  activityScope: 'business' | 'branch';
  upcomingExpirations: {
    id: string;
    memberName: string;
    planName: string;
    endDate: string;
    phone?: string;
  }[];
  outstandingDues: {
    id: string;
    memberName: string;
    amountMinor: number;
    dueDate: string;
    phone?: string;
    planName?: string;
  }[];
  chartData: {
    collections: { date: string; amountMinor: number }[];
    memberGrowth: { date: string; count: number }[];
  };
  generatedAt: string;
}
