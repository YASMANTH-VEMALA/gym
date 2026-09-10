export type BranchStatus = 'ACTIVE' | 'ARCHIVED';
export interface BranchInput {
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  code?: string;
  phone?: string | null;
  email?: string | null;
  addressLine2?: string | null;
  timezone?: string | null;
}
export interface BranchRecord {
  id: string;
  businessId: string;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  timezone: string | null;
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  memberCount: number;
  staffCount: number;
}
export interface BranchDetail extends BranchRecord {
  business: { name: string; currency: string; timezone: string };
  effectiveTimezone: string;
  metrics: {
    members: number;
    activeMemberships: number;
    staff: number;
    todayCheckIns: number;
    outstandingDues: number;
    collections: number;
  };
}
export interface BranchList {
  items: BranchRecord[];
  total: number;
  page: number;
  pageSize: number;
}
