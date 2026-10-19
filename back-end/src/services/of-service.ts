import { ApiPedertractorOf } from '../integrations/api-pedertractor-of.js';
import type { PedertractorOfProcess } from '../types/pedertractor-of-process.js';

export class OfService {
  private readonly api = new ApiPedertractorOf();

  async getProcesses(ofNumber: string): Promise<PedertractorOfProcess[]> {
    return this.api.getProcesses(ofNumber);
  }
}
