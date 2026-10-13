import type {
  AuthUser,
  ListUser,
  Unit,
  UserDepartment,
  UserRole,
} from '@/types/auth';
import api from '@/utils/axiosConfig';

/** Detalhe retornado por GET /users/:id (alinhado ao perfil completo da API). */
export interface UserDetail {
  id: string;
  name: string;
  cardNumber: string;
  unit: Unit;
  role: UserRole;
  department: UserDepartment;
  approvalStatus: AuthUser['approvalStatus'];
  mustChangePassword: boolean;
  active?: boolean;
  createdAt?: string;
}

export interface UpdateUserByAdminPayload {
  role: UserRole;
  department?: UserDepartment;
}

const BASE = '/users';

export interface ValidateEmployeeResponse {
  name: string;
  status: boolean;
}

export interface RegisterUserPayload {
  cardNumber: string;
  unit: Unit;
  role: UserRole;
  department?: UserDepartment;
  /** Senha padrão gerada no backend; usuário altera no primeiro login */
  password?: string;
  active?: boolean;
}

export interface PublicSignupPayload {
  cardNumber: string;
  unit: Unit;
  password: string;
  confirmPassword: string;
  department: UserDepartment;
}

export const userApi = {
  async listAll(): Promise<ListUser[]> {
    const { data } = await api.get<{ users: ListUser[] }>(BASE);
    return data.users;
  },

  async validateEmployee(
    cardNumber: string,
    unit: Unit,
  ): Promise<ValidateEmployeeResponse> {
    const { data } = await api.post<ValidateEmployeeResponse>(
      `${BASE}/validate-employee`,
      { cardNumber, unit },
      { skipErrorToast: true },
    );
    return data;
  },

  async validateSignup(
    cardNumber: string,
    unit: Unit,
  ): Promise<ValidateEmployeeResponse> {
    const { data } = await api.post<ValidateEmployeeResponse>(
      `${BASE}/signup/validate`,
      { cardNumber, unit },
      { skipErrorToast: true },
    );
    return data;
  },

  async signup(payload: PublicSignupPayload): Promise<void> {
    await api.post(`${BASE}/signup`, payload);
  },

  async register(payload: RegisterUserPayload): Promise<void> {
    await api.post(`${BASE}/register`, payload);
  },

  async getById(userId: string): Promise<UserDetail> {
    const { data } = await api.get<{ user: UserDetail }>(`${BASE}/${userId}`);
    return data.user;
  },

  async updateByAdmin(
    userId: string,
    payload: UpdateUserByAdminPayload,
  ): Promise<UserDetail> {
    const { data } = await api.patch<{ user: UserDetail }>(
      `${BASE}/${userId}`,
      payload,
    );
    return data.user;
  },

  async resetPasswordByAdmin(userId: string): Promise<UserDetail> {
    const { data } = await api.post<{ user: UserDetail }>(
      `${BASE}/${encodeURIComponent(userId)}/reset-password`,
    );
    return data.user;
  },

  async approve(userId: string): Promise<UserDetail> {
    const { data } = await api.post<{ user: UserDetail }>(
      `${BASE}/${encodeURIComponent(userId)}/approve`,
    );
    return data.user;
  },

  async reject(userId: string): Promise<UserDetail> {
    const { data } = await api.post<{ user: UserDetail }>(
      `${BASE}/${encodeURIComponent(userId)}/reject`,
    );
    return data.user;
  },

  /** Troca a senha no primeiro login (requer token). Mínimo 6 caracteres. */
  async changePasswordFirstLogin(newPassword: string): Promise<{ user: AuthUser }> {
    const { data } = await api.put<{ user: AuthUser }>(
      `${BASE}/me/change-password`,
      { newPassword },
    );
    return data;
  },
};
