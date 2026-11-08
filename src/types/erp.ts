export type RoleName = 'Superadmin' | 'Admin' | 'User';

export interface AppUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: RoleName;
  isBlocked: boolean;
  empNo?: string | null;
  status: 'Active' | 'Inactive';
  stamp?: string;
  createdAt?: string;
}

export interface UserPermission {
  userId: number;
  rightCode: string;
  status: 'Active' | 'Inactive';
  stamp: string;
}

export interface RightItem {
  rightCode: string;
  moduleCode: string;
  description: string;
  status: 'Active' | 'Inactive';
}

export interface ModuleItem {
  moduleCode: string;
  moduleName: string;
  status: 'Active' | 'Inactive';
}

export interface AuditLogItem {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}
