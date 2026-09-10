export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export interface EmergencyContact {
  name: string;
  phone: string;
  relationship?: string | null;
}
export interface MemberInput {
  branchId?: string | null;
  fullName: string;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  occupation?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContacts?: EmergencyContact[];
  profilePhotoDataUrl?: string | null;
  heightCm?: number | null;
  weightGrams?: number | null;
  fitnessGoal?: string | null;
  notes?: string | null;
  joiningDate: string;
  status?: 'ACTIVE' | 'INACTIVE';
}
export interface MemberRecord extends Omit<MemberInput, 'status'> {
  id: string;
  businessId: string;
  memberNumber: string;
  status: MemberStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  outstandingMinor?: number;
  membershipCount?: number;
}
export interface MemberDetail extends MemberRecord {
  profilePhotoDataUrl: string | null;
  business: { name: string; timezone: string };
  activity: { id: string; action: string; occurredAt: string }[];
}
export interface MemberList {
  items: MemberRecord[];
  total: number;
  page: number;
  pageSize: number;
}
