import { z } from 'zod';
import { parseMoneyMinor } from '@gym/validation';
export const planSchema = z
  .object({
    name: z.string().trim().min(1, 'Plan name is required').max(120),
    description: z.string().trim().max(2000),
    price: z
      .string()
      .trim()
      .refine((value) => {
        try {
          const minor = parseMoneyMinor(value);
          return minor > 0 && minor <= 1000000000;
        } catch {
          return false;
        }
      }, 'Enter a price greater than zero, up to 10,000,000, with at most two decimal places.'),
    durationDays: z
      .string()
      .regex(/^\d{1,4}$/, 'Enter a whole number of days')
      .refine(
        (value) => Number(value) >= 1 && Number(value) <= 3650,
        'Duration must be between 1 and 3650 days.',
      ),
    appliesToAllBranches: z.boolean(),
    branchIds: z.array(z.uuid()).max(100),
    status: z.enum(['ACTIVE', 'INACTIVE']),
  })
  .refine((value) => value.appliesToAllBranches || value.branchIds.length > 0, {
    path: ['branchIds'],
    message: 'Select at least one active branch.',
  });
export type PlanFormValues = z.infer<typeof planSchema>;
