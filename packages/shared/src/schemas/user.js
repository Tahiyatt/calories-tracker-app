import { z } from 'zod';

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  dateOfBirth: z.coerce.date().optional(),
  heightCm: z.number().positive().max(280).optional(),
  timezone: z.string().min(1).default('UTC'),
});

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
  profile: profileSchema.partial().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = profileSchema.partial();
