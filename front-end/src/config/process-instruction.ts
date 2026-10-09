export const PROCESS_REQUESTERS = [
  'Comercial',
  'Engenharia',
  'Ferramentaria',
  'Produção',
  'Qualidade',
] as const;

export type ProcessRequester = (typeof PROCESS_REQUESTERS)[number];

export const PROCESS_PERMISSIONS: Record<
  ProcessRequester,
  Record<string, readonly string[]>
> = {
  Comercial: {
    Corte: ['Simulação Comercial'],
    Dobra: ['Simulação Comercial'],
    Engenharia: [
      'Alteração Cliente',
      'Alteração Interna',
      'Desenvolvimento Amostra',
      'Desenvolvimento Protótipo',
      'Desenvolvimento Teste',
    ],
    'Solda Robotizada': ['Simulação Comercial'],
    Usinagem: ['Simulação Comercial'],
  },
  Ferramentaria: {
    Dobra: ['Atualização de Processo', 'Desenvolvimento de Processo'],
    'Solda Robotizada': ['Simulação Comercial'],
    Usinagem: ['Ferramental Centro', 'Ferramental Torno'],
  },
  Produção: {
    Dobra: [
      'Atualização de Blank',
      'Atualização de Processo',
      'Desenvolvimento de Gabarito',
    ],
    Engenharia: ['Alteração Interna'],
    Pintura: [
      'Atualização de Processo',
      'Calafetagem',
      'Check List',
      'Desenvolvimento Vedação',
      'E-coat',
      'Expedição',
      'Inspeção Pintura',
      'Pintura Líquida',
      'Pintura Pó',
      'Repasse de Rosca',
      'Sala Limpa',
      'Teste Estanqueidade',
    ],
    'Solda Robotizada': [
      'Ajuste Arame',
      'Ajuste Programa',
      'Backup',
      'Programação',
    ],
    'Solda Semiautomática': [
      'Atualização de Processo',
      'Auxílio Visual',
      'Check List',
      'Desen. Processo Solda',
      'Desen. Processo Teste Estanq.',
    ],
    Usinagem: [
      'Atualização Processo Centro',
      'Atualização Processo Torno',
      'Desen. Processo Retrabalho',
    ],
  },
  Qualidade: {
    Engenharia: ['Alteração Cliente', 'Alteração Interna'],
    Pintura: [
      'Atualização de Processo',
      'Calafetagem',
      'Check List',
      'Desenvolvimento Vedação',
      'E-coat',
      'Expedição',
      'Inspeção Pintura',
      'Pintura Líquida',
      'Pintura Pó',
      'Repasse de Rosca',
      'Sala Limpa',
      'Teste Estanqueidade',
    ],
    'Solda Semiautomática': [
      'Atualização de Processo',
      'Auxílio Visual',
      'Check List',
      'Desen. Processo Solda',
      'Desen. Processo Teste Estanq.',
    ],
    Usinagem: [
      'Atualização Processo Centro',
      'Atualização Processo Torno',
      'Desen. Processo Retrabalho',
    ],
  },
  Engenharia: {
    Dobra: [
      'Atualização de Blank',
      'Atualização de Processo',
      'Desenvolvimento de Processo',
    ],
    Usinagem: [
      'Atualização Processo Centro',
      'Atualização Processo Torno',
      'Desen. Processo Centro Amostra',
      'Desen. Processo Torno Amostra',
      'Desen. Processo Retrabalho',
    ],
  },
};

const PROCESS_DEADLINES: Record<
  ProcessRequester,
  Record<string, Record<string, number | null>>
> = {
  Comercial: {
    Corte: { 'Simulação Comercial': 10 },
    Dobra: { 'Simulação Comercial': 10 },
    Engenharia: {
      'Alteração Cliente': 5,
      'Alteração Interna': 5,
      'Desenvolvimento Amostra': null,
      'Desenvolvimento Protótipo': null,
      'Desenvolvimento Teste': 5,
    },
    'Solda Robotizada': { 'Simulação Comercial': 10 },
    Usinagem: { 'Simulação Comercial': 10 },
  },
  Ferramentaria: {
    Dobra: { 'Atualização de Processo': 2, 'Desenvolvimento de Processo': 2 },
    'Solda Robotizada': { 'Simulação Comercial': 10 },
    Usinagem: { 'Ferramental Centro': 7, 'Ferramental Torno': 7 },
  },
  Engenharia: {
    Dobra: {
      'Atualização de Blank': 2,
      'Atualização de Processo': 2,
      'Desenvolvimento de Processo': 2,
    },
    Usinagem: {
      'Atualização Processo Centro': 7,
      'Atualização Processo Torno': 7,
      'Desen. Processo Centro Amostra': 7,
      'Desen. Processo Torno Amostra': 7,
      'Desen. Processo Retrabalho': 2,
    },
  },
  Produção: {
    Dobra: {
      'Atualização de Blank': 7,
      'Atualização de Processo': 15,
      'Desenvolvimento de Gabarito': 15,
    },
    Engenharia: { 'Alteração Interna': 30 },
    Pintura: {
      'Atualização de Processo': 30,
      Calafetagem: 30,
      'Check List': 30,
      'Desenvolvimento Vedação': 30,
      'E-coat': 30,
      Expedição: 30,
      'Inspeção Pintura': 30,
      'Pintura Líquida': 30,
      'Pintura Pó': 30,
      'Repasse de Rosca': 30,
      'Sala Limpa': 30,
      'Teste Estanqueidade': 30,
    },
    'Solda Robotizada': {
      'Ajuste Arame': 2,
      'Ajuste Programa': 2,
      Backup: 2,
      Programação: 2,
    },
    'Solda Semiautomática': {
      'Atualização de Processo': 30,
      'Auxílio Visual': 30,
      'Check List': 30,
      'Desen. Processo Solda': 30,
      'Desen. Processo Teste Estanq.': 30,
    },
    Usinagem: {
      'Atualização Processo Centro': 7,
      'Atualização Processo Torno': 7,
      'Desen. Processo Retrabalho': 2,
    },
  },
  Qualidade: {
    Engenharia: { 'Alteração Cliente': null, 'Alteração Interna': null },
    Pintura: {
      'Atualização de Processo': 5,
      Calafetagem: 5,
      'Check List': 5,
      'Desenvolvimento Vedação': 5,
      'E-coat': 5,
      Expedição: 5,
      'Inspeção Pintura': 5,
      'Pintura Líquida': 5,
      'Pintura Pó': 5,
      'Repasse de Rosca': 5,
      'Sala Limpa': 5,
      'Teste Estanqueidade': 5,
    },
    'Solda Semiautomática': {
      'Atualização de Processo': 30,
      'Auxílio Visual': 30,
      'Check List': 30,
      'Desen. Processo Solda': 30,
      'Desen. Processo Teste Estanq.': 30,
    },
    Usinagem: {
      'Atualização Processo Centro': 5,
      'Atualização Processo Torno': 5,
      'Desen. Processo Retrabalho': 5,
    },
  },
};

export function isProcessRequester(value: string): value is ProcessRequester {
  return (PROCESS_REQUESTERS as readonly string[]).includes(value);
}

export function listProcesses(requester: string): string[] {
  if (!isProcessRequester(requester)) return [];
  return Object.keys(PROCESS_PERMISSIONS[requester]);
}

export function listTypes(requester: string, process: string): string[] {
  if (!isProcessRequester(requester)) return [];
  return [...(PROCESS_PERMISSIONS[requester][process] ?? [])];
}

export function isValidProcessCombination(
  requester: string,
  process: string,
  type: string,
): boolean {
  return listTypes(requester, process).includes(type);
}

export function shouldShowDeliveryDate(
  requester: string,
  process: string,
  type: string,
): boolean {
  return (
    requester === 'Comercial' &&
    process === 'Engenharia' &&
    (type === 'Desenvolvimento Amostra' || type === 'Desenvolvimento Protótipo')
  );
}

function startOfToday(now = new Date()): Date {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today;
}

function formatPtBr(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

export function calcularDataLimite(diasUteis: number, now = new Date()): string {
  if (!Number.isFinite(diasUteis) || diasUteis <= 0) return '';
  const data = startOfToday(now);
  let diasAdicionados = 0;
  while (diasAdicionados < diasUteis) {
    data.setDate(data.getDate() + 1);
    const diaSemana = data.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasAdicionados++;
    }
  }
  return formatPtBr(data);
}

export function calcularPrazoVintePorCento(
  dataEntregaStr: string,
  now = new Date(),
): { diasUteis: number; dataLimiteStr: string | null } {
  if (!dataEntregaStr) {
    return { diasUteis: 0, dataLimiteStr: null };
  }

  const parsed = parseIsoDate(dataEntregaStr);
  if (!parsed) {
    return { diasUteis: 0, dataLimiteStr: null };
  }

  const hoje = startOfToday(now);
  if (parsed <= hoje) {
    return { diasUteis: 0, dataLimiteStr: null };
  }

  let totalDiasUteis = 0;
  const curr = new Date(hoje);
  curr.setDate(curr.getDate() + 1);

  while (curr <= parsed) {
    const diaSemana = curr.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      totalDiasUteis++;
    }
    curr.setDate(curr.getDate() + 1);
  }

  if (totalDiasUteis <= 0) {
    return { diasUteis: 0, dataLimiteStr: null };
  }

  const diasUteisPrazo = Math.max(1, Math.ceil(totalDiasUteis * 0.2));
  const dataLimite = new Date(hoje);
  let diasAdicionados = 0;
  while (diasAdicionados < diasUteisPrazo) {
    dataLimite.setDate(dataLimite.getDate() + 1);
    const diaSemana = dataLimite.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasAdicionados++;
    }
  }

  return {
    diasUteis: diasUteisPrazo,
    dataLimiteStr: formatPtBr(dataLimite),
  };
}

export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function lookupDeadline(
  requester: string,
  process: string,
  type: string,
): number | null | undefined {
  if (!isProcessRequester(requester)) return undefined;
  return PROCESS_DEADLINES[requester]?.[process]?.[type];
}

export function describeDeadline(
  requester: string,
  process: string,
  type: string,
  deliveryDateIso: string,
  now = new Date(),
): { prazo: string; dataLimite: string } | null {
  if (!requester || !process || !type) return null;

  const prazoVal = lookupDeadline(requester, process, type);
  const isSample = shouldShowDeliveryDate(requester, process, type);

  if (typeof prazoVal === 'number') {
    return {
      prazo: `${prazoVal} dias úteis`,
      dataLimite: calcularDataLimite(prazoVal, now),
    };
  }

  if (isSample) {
    if (!deliveryDateIso) {
      return {
        prazo: '20% do período até a Data de Entrega',
        dataLimite: 'selecione a Data de Entrega',
      };
    }
    const parsed = parseIsoDate(deliveryDateIso);
    const hoje = startOfToday(now);
    if (!parsed || parsed <= hoje) {
      return {
        prazo: '20% do período até a Data de Entrega',
        dataLimite: 'a Data de Entrega deve ser posterior a hoje',
      };
    }
    const calc = calcularPrazoVintePorCento(deliveryDateIso, now);
    return {
      prazo: `20% do período até a Data de Entrega (${calc.diasUteis} dias úteis)`,
      dataLimite: calc.dataLimiteStr || 'a definir',
    };
  }

  return {
    prazo: 'não definido',
    dataLimite: 'a definir',
  };
}

export function buildStoredDeadline(
  requester: string,
  process: string,
  type: string,
  deliveryDateIso: string | null,
  now = new Date(),
): { deadlineLabel: string; deadlineDate: string } {
  const prazoVal = lookupDeadline(requester, process, type);
  const isSample = shouldShowDeliveryDate(requester, process, type);

  if (typeof prazoVal === 'number') {
    return {
      deadlineLabel: `${prazoVal} dias úteis`,
      deadlineDate: calcularDataLimite(prazoVal, now),
    };
  }

  if (isSample && deliveryDateIso) {
    const parsed = parseIsoDate(deliveryDateIso);
    const hoje = startOfToday(now);
    if (parsed && parsed > hoje) {
      const calc = calcularPrazoVintePorCento(deliveryDateIso, now);
      return {
        deadlineLabel: `20% do período até a Data de Entrega (${calc.diasUteis} dias úteis)`,
        deadlineDate: calc.dataLimiteStr || 'A definir',
      };
    }
  }

  return {
    deadlineLabel: 'Não definido',
    deadlineDate: 'A definir',
  };
}

export function deliveryDateError(
  requester: string,
  process: string,
  type: string,
  deliveryDateIso: string,
  now = new Date(),
): string | undefined {
  if (!shouldShowDeliveryDate(requester, process, type)) return undefined;
  if (!deliveryDateIso) return 'Informe a data de entrega.';
  const parsed = parseIsoDate(deliveryDateIso);
  if (!parsed) return 'Data de entrega inválida.';
  if (parsed <= startOfToday(now)) {
    return 'A data de entrega deve ser posterior a hoje.';
  }
  return undefined;
}

export function optionalHttpsUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Link de arquivos inválido.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Link de arquivos inválido.');
  }
  return trimmed;
}

export function formatIsoDateLabel(value: string | null): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function processInstructionTitle(process: string, type: string): string {
  return `Instrução de Processo — ${process} / ${type}`;
}

export type ProcessInstructionFieldErrors = {
  requester?: string;
  process?: string;
  type?: string;
  deliveryDate?: string;
  client?: string;
  fileLink?: string;
};

export function validateProcessInstructionFields(input: {
  requester: string;
  process: string;
  type: string;
  deliveryDate: string;
  client: string;
  fileLink: string;
}): ProcessInstructionFieldErrors {
  const errors: ProcessInstructionFieldErrors = {};

  if (!input.requester.trim()) {
    errors.requester = 'Selecione o solicitante.';
  } else if (!isProcessRequester(input.requester)) {
    errors.requester = 'Solicitante inválido.';
  }

  if (!errors.requester) {
    if (!input.process.trim()) {
      errors.process = 'Selecione o processo.';
    } else if (!listProcesses(input.requester).includes(input.process)) {
      errors.process = 'Processo inválido para o solicitante.';
    }
  }

  if (!errors.requester && !errors.process) {
    if (!input.type.trim()) {
      errors.type = 'Selecione o tipo.';
    } else if (
      !isValidProcessCombination(input.requester, input.process, input.type)
    ) {
      errors.type = 'Tipo inválido para o processo.';
    }
  }

  const dateError = deliveryDateError(
    input.requester,
    input.process,
    input.type,
    input.deliveryDate,
  );
  if (dateError) errors.deliveryDate = dateError;

  if (!input.client.trim()) {
    errors.client = 'Selecione o cliente.';
  }

  if (input.fileLink.trim()) {
    try {
      optionalHttpsUrl(input.fileLink);
    } catch (error) {
      errors.fileLink =
        error instanceof Error ? error.message : 'Link de arquivos inválido.';
    }
  }

  return errors;
}
