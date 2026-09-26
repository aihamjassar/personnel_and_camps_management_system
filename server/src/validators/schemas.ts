import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const createPersonnelSchema = z.object({
  full_name: z.string().min(1).max(200),
  national_id: z.string().min(1).max(50).optional(),
  date_of_birth: z.coerce.date().optional(),
  gender: z.enum(["male", "female"]).optional(),
  phone: z.string().max(30).optional(),
  email: z.email().max(200).optional(),
  rank_id: z.int().positive().optional(),
  unit_id: z.int().positive().optional(),
  camp_id: z.int().positive().optional(),
});

export const updatePersonnelSchema = createPersonnelSchema.partial();

export const statusChangeSchema = z.object({
  status: z.enum(["active", "inactive", "on_leave", "transferred", "discharged"]),
  notes: z.string().max(1000).optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  camp_id: z.coerce.number().int().positive().optional(),
  unit_id: z.coerce.number().int().positive().optional(),
  rank_id: z.coerce.number().int().positive().optional(),
  status: z.string().max(50).optional(),
});

export const campSchema = z.object({
  name: z.string().min(1).max(200),
  capacity: z.int().min(0).default(0),
  location: z.string().max(300).optional(),
});

export const unitSchema = z.object({
  name: z.string().min(1).max(200),
  camp_id: z.int().positive(),
  parent_unit_id: z.int().positive().optional(),
});

export const rankSchema = z.object({
  name: z.string().min(1).max(100),
  level: z.int().min(1),
  description: z.string().max(500).optional(),
});

export const positionSchema = z.object({
  name: z.string().min(1).max(200),
  unit_id: z.int().positive().optional(),
  description: z.string().max(500).optional(),
});

export const assignmentSchema = z.object({
  personnel_id: z.int().positive(),
  unit_id: z.int().positive(),
  position_id: z.int().positive(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
});

export const createUserSchema = z.object({
  username: z.string().min(3).max(100),
  password: z.string().min(8).max(200),
  full_name: z.string().min(1).max(200),
  email: z.email().max(200).optional(),
  role_ids: z.array(z.int().positive()).default([]),
});
