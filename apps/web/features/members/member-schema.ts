import { z } from 'zod';
import {
  calendarToday,
  isCalendarDate,
  normalizeMemberPhone,
  memberPhonePattern,
  parseWeightGrams,
  fitnessGoals,
} from '@gym/validation';
const optional = (max: number) => z.string().trim().max(max);
const phone = z
  .string()
  .trim()
  .max(32)
  .refine(
    (value) => memberPhonePattern.test(normalizeMemberPhone(value)),
    'Enter 6–15 digits with an optional leading +.',
  );
const optionalPhone = z
  .string()
  .trim()
  .refine(
    (value) => !value || phone.safeParse(value).success,
    'Enter a valid phone number.',
  );
export const memberSchema = (timezone: string) =>
  z.object({
    branchId: z.union([z.literal(''), z.uuid()]),
    fullName: z.string().trim().min(1, 'Full name is required').max(120),
    phone,
    joiningDate: z
      .string()
      .refine(isCalendarDate, 'Enter a valid joining date.'),
    alternatePhone: optionalPhone,
    email: optional(254).refine(
      (value) => !value || z.email().safeParse(value).success,
      'Enter a valid email address.',
    ),
    gender: optional(50),
    dateOfBirth: z
      .string()
      .refine(
        (value) =>
          !value || (isCalendarDate(value) && value <= calendarToday(timezone)),
        'Enter a valid date of birth that is not in the future.',
      ),
    occupation: optional(120),
    addressLine1: optional(200),
    addressLine2: optional(200),
    city: optional(100),
    state: optional(100),
    postalCode: optional(20),
    country: optional(100),
    emergencyContacts: z
      .array(
        z.object({
          name: z.string().trim().min(1, 'Contact name is required.').max(120),
          phone,
          relationship: optional(80),
        }),
      )
      .max(5, 'Add no more than five emergency contacts.'),
    profilePhotoDataUrl: z.string().max(2_100_000),
    heightCm: z
      .string()
      .trim()
      .refine(
        (value) =>
          !value ||
          (/^\d{1,3}$/.test(value) &&
            Number(value) > 0 &&
            Number(value) <= 300),
        'Height must be a whole number from 1 to 300 cm.',
      ),
    weightKg: z
      .string()
      .trim()
      .refine((value) => {
        if (!value) return true;
        try {
          parseWeightGrams(value);
          return true;
        } catch {
          return false;
        }
      }, 'Enter a positive weight up to 1000 kg, with at most three decimal places.'),
    fitnessGoal: z.union([z.literal(''), z.enum(fitnessGoals)]),
    notes: optional(2000),
    status: z.enum(['ACTIVE', 'INACTIVE']),
  });
export type MemberFormValues = z.infer<ReturnType<typeof memberSchema>>;
