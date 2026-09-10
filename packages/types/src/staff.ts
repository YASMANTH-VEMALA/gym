export type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export interface StaffBranch {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'ARCHIVED';
}
export interface StaffInput {
  fullName: string;
  phone: string;
  email?: string | null;
  jobTitle: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  joiningDate: string;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  notes?: string | null;
  branchIds: string[];
}
export interface StaffRecord extends Omit<StaffInput, 'branchIds' | 'status'> {
  id: string;
  businessId: string;
  status: StaffStatus;
  branches: StaffBranch[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}
export interface StaffDetail extends StaffRecord {
  activity: { id: string; action: string; occurredAt: string }[];
  business: { name: string; timezone: string };
}
export interface StaffList {
  items: StaffRecord[];
  total: number;
  page: number;
  pageSize: number;
}
