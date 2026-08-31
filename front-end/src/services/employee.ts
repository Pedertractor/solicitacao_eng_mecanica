import type { Unit } from '@/types/auth';
import api from '@/utils/axiosConfig';

const BASE = '/employees';

export interface EmployeeFromBase {
  id: number;
  name: string;
  cardNumber: string;
  unit: Unit;
}

export interface ListEmployeesResponse {
  employees: EmployeeFromBase[];
}

export const employeeApi = {
  async listAll(): Promise<EmployeeFromBase[]> {
    const { data } = await api.get<ListEmployeesResponse>(BASE);
    return data.employees ?? [];
  },
};
