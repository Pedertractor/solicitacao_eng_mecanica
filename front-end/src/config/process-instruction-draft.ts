import type { SolicitationClient } from '@/services/solicitation';

export type ProcessInstructionDraft = {
  requester: string;
  process: string;
  type: string;
  deliveryDate: string;
  client: SolicitationClient | '';
  allocatedPartNumbers: string[];
  fileLink: string;
  comments: string;
  requiresTooling: boolean;
};

export function emptyProcessInstructionDraft(): ProcessInstructionDraft {
  return {
    requester: '',
    process: '',
    type: '',
    deliveryDate: '',
    client: '',
    allocatedPartNumbers: [],
    fileLink: '',
    comments: '',
    requiresTooling: false,
  };
}
