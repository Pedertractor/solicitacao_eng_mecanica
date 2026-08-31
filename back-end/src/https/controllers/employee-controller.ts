import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiPedertractorEmployee } from '../../integrations/api-pedertractor-employee.js';

const apiPedertractor = new ApiPedertractorEmployee();

export async function getEmployeeList(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const data = await apiPedertractor.listEmployees();
    const employees = (Array.isArray(data) ? data : []).map((item) => ({
      id: item.id,
      name: item.name,
      cardNumber: item.cardNumber,
      unit: item.unit,
    }));
    return reply.status(200).send({ employees });
  } catch (error) {
    console.error('getEmployeeList:', error);
    throw error;
  }
}
