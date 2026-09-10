import { z } from 'zod';
const optional = (max: number) => z.string().trim().max(max);
const phone = z
  .string()
  .trim()
  .regex(
    /^[+0-9().\s#xX-]{6,32}$/,
    'Enter a valid phone number (6–32 characters)',
  );
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, 'Enter a valid date');
export const staffSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  phone,
  email: optional(254).refine(
    (value) => !value || z.email().safeParse(value).success,
    'Enter a valid email address',
  ),
  jobTitle: z.string().trim().min(1, 'Job title is required').max(100),
  gender: optional(50),
  dateOfBirth: z
    .string()
    .refine(
      (value) => !value || date.safeParse(value).success,
      'Enter a valid date',
    ),
  joiningDate: date,
  address: optional(500),
  emergencyContactName: optional(120),
  emergencyContactPhone: z
    .string()
    .trim()
    .refine(
      (value) => !value || phone.safeParse(value).success,
      'Enter a valid emergency phone number',
    ),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  notes: optional(2000),
  branchIds: z.array(z.uuid()).min(1, 'Select at least one branch'),
});
export type StaffFormValues = z.infer<typeof staffSchema>;
