import { z } from 'zod';
const required = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `Use at most ${max} characters`);
export const branchSchema = z.object({
  name: required('Branch name', 100),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (value) => !value || /^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(value),
      'Use 2–20 letters, numbers, hyphens, or underscores',
    ),
  addressLine1: required('Address line 1', 200),
  addressLine2: z.string().trim().max(200),
  city: required('City', 100),
  state: required('State', 100),
  country: required('Country', 100),
  postalCode: required('Postal code', 20),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => !value || /^[+0-9().\s#xX-]{6,32}$/.test(value),
      'Enter a valid phone number (6–32 characters)',
    ),
  email: z
    .string()
    .trim()
    .max(254)
    .refine(
      (value) => !value || z.email().safeParse(value).success,
      'Enter a valid email address',
    ),
  timezone: z
    .string()
    .trim()
    .max(100)
    .refine((value) => {
      if (!value) return true;
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Enter a valid IANA timezone, such as Asia/Kolkata'),
});
export type BranchFormValues = z.infer<typeof branchSchema>;
