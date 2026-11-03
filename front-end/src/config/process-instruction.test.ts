import { describe, expect, it } from 'vitest';
import * as frontend from './process-instruction';
import * as backend from '../../../back-end/src/lib/process-instruction';

const activities = ['Ajuste (Programa)', 'Backup', 'Programa (Novo)', 'Programa (Teste)', 'Reunião', 'Simulação', 'Suporte', 'Teste'];
const machiningActivities = ['Alteração', 'Cotação', 'Ferramentaria Centro', 'Ferramentaria Torno', 'Processo Centro', 'Processo Torno', 'Retrabalho', 'Contagem de Pedido'];
const manualWeldingActivities = ['Processo De Montagem', 'Processo De Solda', 'Processo De Solda Robô', 'Suporte Técnico', 'Contagem de Pedido'];
const punchPressActivities = ['Programação', 'Tipagem', 'Suporte Técnico', 'Processo Realizado', 'Análise Comercial', 'Reprogramação'];
const paintingActivities = ['Alteração Interna Eng.', 'E-coat', 'Expedição', 'Pintura Líquida', 'Pintura Pó', 'Repasse de Rosca', 'Sala Limpa'];
const cuttingActivities = ['Programação', 'Reprocessamento', 'Alteração Dimensional', 'Remodelar 3D', 'Atualiz. Tempo Controlado'];
const bendingActivities = ['Atualizar Processo', 'Elaborar Gabarito', 'Extrair Dxf', 'Processo Dobra', 'Simulação Comercial', 'Suporte Técnico', 'Teste Ferramenta', 'Contagem de pedido'];

for (const [name, config] of Object.entries({ frontend, backend })) {
  describe(`${name} bending activities`, () => {
    it.each(['Comercial', 'Ferramentaria', 'Produção', 'Engenharia'])('offers and accepts the eight requested types without duplicates for %s', (requester) => {
      const types = config.listTypes(requester, 'Dobra');
      expect(types.slice(0, bendingActivities.length)).toEqual(bendingActivities);
      for (const type of bendingActivities) {
        expect(types.filter((item) => item === type)).toHaveLength(1);
        expect(config.validateProcessInstructionFields({ requester, process: 'Dobra', type,
          executionUnit: 'TRACTOR', client: 'PEDERTRACTOR', deliveryDate: '', fileLink: '' })).toEqual({});
      }
      if (requester !== 'Comercial') expect(types).toContain('Atualização de Processo');
    });
  });

  describe(`${name} cutting activities`, () => {
    it('offers and accepts the five new types while preserving commercial simulation', () => {
      const types = config.listTypes('Comercial', 'Corte');
      expect(types).toEqual([...cuttingActivities, 'Simulação Comercial']);
      for (const type of types) {
        expect(config.validateProcessInstructionFields({ requester: 'Comercial', process: 'Corte', type,
          executionUnit: 'TRACTOR', client: 'PEDERTRACTOR', deliveryDate: '', fileLink: '' })).toEqual({});
      }
      expect(config.describeDeadline('Comercial', 'Corte', 'Simulação Comercial', '')?.prazo).toBe('10 dias úteis');
    });
  });

  describe(`${name} painting activities`, () => {
    it.each(['Produção', 'Qualidade'])('offers and accepts the requested activities without duplicates for %s', (requester) => {
      const types = config.listTypes(requester, 'Pintura');
      const input = { requester, process: 'Pintura', executionUnit: 'TRACTOR', client: 'PEDERTRACTOR', deliveryDate: '', fileLink: '' };
      for (const type of paintingActivities) {
        expect(types.filter((item) => item === type)).toHaveLength(1);
        expect(config.validateProcessInstructionFields({ ...input, type })).toEqual({});
      }
      for (const type of ['Atualização de Processo', 'Calafetagem', 'Check List', 'Desenvolvimento Vedação', 'Inspeção Pintura', 'Teste Estanqueidade']) {
        expect(types).toContain(type);
      }
      for (const type of paintingActivities.slice(1)) {
        expect(config.describeDeadline(requester, 'Pintura', type, '')?.prazo).toBe(requester === 'Produção' ? '30 dias úteis' : '5 dias úteis');
      }
    });
  });

  describe(`${name} punch press process`, () => {
    it.each(config.PROCESS_REQUESTERS)('offers the new process and accepts its six activities for %s', (requester) => {
      expect(config.listProcesses(requester)).toContain('Puncionadeira');
      expect(config.listTypes(requester, 'Puncionadeira')).toEqual(punchPressActivities);
      const input = { requester, process: 'Puncionadeira', executionUnit: 'TRACTOR', client: 'PEDERTRACTOR', deliveryDate: '', fileLink: '' };
      for (const type of punchPressActivities) {
        expect(config.validateProcessInstructionFields({ ...input, type })).toEqual({});
      }
      expect(config.validateProcessInstructionFields({ ...input, type: 'Backup' })).toHaveProperty('type');
    });
  });

  describe(`${name} manual welding process`, () => {
    it.each(config.PROCESS_REQUESTERS)('offers the new process and accepts its five activities for %s', (requester) => {
      expect(config.listProcesses(requester)).toContain('Solda (Manual)');
      expect(config.listTypes(requester, 'Solda (Manual)')).toEqual(manualWeldingActivities);
      const input = { requester, process: 'Solda (Manual)', executionUnit: 'TRACTOR', client: 'PEDERTRACTOR', deliveryDate: '', fileLink: '' };
      for (const type of manualWeldingActivities) {
        expect(config.validateProcessInstructionFields({ ...input, type })).toEqual({});
      }
      expect(config.validateProcessInstructionFields({ ...input, type: 'Backup' })).toHaveProperty('type');
    });
  });

  describe(`${name} machining activities`, () => {
    it.each(config.PROCESS_REQUESTERS)('offers and accepts the new activities for %s while preserving existing types', (requester) => {
      const types = config.listTypes(requester, 'Usinagem');
      expect(types.slice(0, machiningActivities.length)).toEqual(machiningActivities);
      const input = { requester, process: 'Usinagem', executionUnit: 'TRACTOR', client: 'PEDERTRACTOR', deliveryDate: '', fileLink: '' };
      for (const type of types) {
        expect(config.validateProcessInstructionFields({ ...input, type })).toEqual({});
      }
      expect(types).toContain(requester === 'Comercial' ? 'Simulação Comercial'
        : requester === 'Ferramentaria' ? 'Ferramental Centro' : 'Atualização Processo Centro');
    });
  });

  describe(`${name} robotic welding activities`, () => {
    it.each(['Comercial', 'Ferramentaria', 'Produção'])('offers and accepts the requested activities for %s', (requester) => {
      const types = config.listTypes(requester, 'Solda Robotizada');
      for (const type of activities) {
        expect(types).toContain(type);
        expect(config.validateProcessInstructionFields({ requester, process: 'Solda Robotizada', type,
          executionUnit: 'TRACTOR', client: 'PEDERTRACTOR', deliveryDate: '', fileLink: '' })).toEqual({});
      }
      expect(types).toEqual(requester === 'Produção' ? activities : [...activities, 'Simulação Comercial']);
    });

    it('preserves the deadlines of renamed production activities', () => {
      for (const type of ['Ajuste (Programa)', 'Backup', 'Programa (Novo)']) {
        expect(config.describeDeadline('Produção', 'Solda Robotizada', type, '')?.prazo).toBe('2 dias úteis');
      }
    });
  });
}
