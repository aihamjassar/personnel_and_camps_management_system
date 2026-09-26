export interface ApiErrorShape {
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  status: "success" | "fail";
  data: T | null;
  error: ApiErrorShape | null;
}

export interface SessionUser {
  user_id?: number;
  userId?: number;
  username: string;
  full_name?: string;
  permissions: string[];
}

export interface LoginPayload {
  token: string;
  user: SessionUser;
}

export interface ReferenceOption {
  name: string;
}

export interface RankOption extends ReferenceOption {
  level?: number;
}

export interface Camp extends ReferenceOption {
  camp_id: number;
  capacity: number;
  location: string | null;
  is_active: boolean;
}

export interface Unit extends ReferenceOption {
  unit_id: number;
  camp_id: number;
  camp?: { camp_id: number; name: string };
  parent_unit_id?: number | null;
}

export interface Rank extends ReferenceOption {
  rank_id: number;
  level: number;
  description?: string | null;
}

export interface Position extends ReferenceOption {
  position_id: number;
  unit_id?: number | null;
  description?: string | null;
}

export interface Personnel {
  personnel_id: number;
  full_name: string;
  national_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  camp_id: number | null;
  unit_id: number | null;
  rank_id: number | null;
  current_status: string;
  rank?: { rank_id: number; name: string; level: number } | null;
  unit?: { unit_id: number; name: string } | null;
  camp?: { camp_id: number; name: string } | null;
}

export interface PersonnelStatus {
  status_id: number;
  personnel_id: number;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface Assignment {
  assignment_id: number;
  personnel_id: number;
  unit_id: number;
  position_id: number;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  personnel?: { personnel_id: number; full_name: string };
  unit?: { unit_id: number; name: string };
  position?: { position_id: number; name: string };
}

export interface ManagedUser {
  user_id: number;
  username: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  roles: { role: { role_id: number; role_name: string } }[];
}

export interface RoleOption {
  role_id: number;
  role_name: string;
  description: string | null;
}

export interface Summary {
  total_personnel: number;
  active_personnel: number;
  by_camp: { camp_id: number | null; name: string; count: number; capacity: number }[];
  by_rank: { rank_id: number | null; name: string; count: number }[];
  recent_transfers: unknown[];
}
