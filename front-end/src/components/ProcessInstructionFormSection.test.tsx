import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyProcessInstructionDraft, type ProcessInstructionDraft } from '@/config/process-instruction-draft';
import { validateProcessInstructionFields } from '@/config/process-instruction';
import { ProcessInstructionFormSection } from './ProcessInstructionFormSection';

const controls = vi.hoisted(() => ({
  checkboxes: new Map<string, { checked: boolean; disabled?: boolean; onCheckedChange: (value: boolean) => void }>(),
  selects: [] as { value: string; onValueChange: (value: string) => void }[],
}));
vi.mock('@/components/PartNumberAllocator', () => ({ PartNumberAllocator: () => null }));
vi.mock('@/components/ui/checkbox', () => ({ Checkbox: (props: { id: string; checked: boolean; disabled?: boolean; onCheckedChange: (value: boolean) => void }) => {
  controls.checkboxes.set(props.id, props);
  return createElement('input', { type: 'checkbox', id: props.id, checked: props.checked, disabled: props.disabled, readOnly: true });
} }));
vi.mock('@/components/ui/select', () => {
  const Container = ({ children }: { children?: ReactNode }) => createElement('div', null, children);
  return {
    Select: (props: { children: ReactNode; value: string; onValueChange: (value: string) => void }) => {
      controls.selects.push(props);
      return createElement(Container, null, props.children);
    },
    SelectContent: Container, SelectItem: Container, SelectTrigger: Container, SelectValue: Container,
  };
});

function render(value: ProcessInstructionDraft, showRouting = true) {
  controls.checkboxes.clear();
  controls.selects.length = 0;
  const onChange = vi.fn();
  const markup = renderToStaticMarkup(createElement(ProcessInstructionFormSection, {
    value, onChange, errors: {}, onClearError: vi.fn(), showRouting,
  }));
  return { markup, onChange };
}

describe('Comercial request options', () => {
  beforeEach(() => vi.clearAllMocks());
  it('keeps commercial details without process, type selectors or workflow options on direct tooling', () => {
    const value = { ...emptyProcessInstructionDraft(), requester: 'Comercial', type: 'Simulação Comercial',
      executionUnit: 'TRACTOR' as const, client: 'PEDERTRACTOR' as const };
    const markup = renderToStaticMarkup(createElement(ProcessInstructionFormSection, {
      value, onChange: vi.fn(), errors: {}, onClearError: vi.fn(), showRouting: false, directCommercialTooling: true,
    }));
    for (const label of ['Unidade de execução', 'Cliente', 'Link de arquivos', 'Comentários', '10 dias úteis', 'Simulação Comercial']) expect(markup).toContain(label);
    for (const label of ['processName', 'processType', 'A Engenharia avaliará', 'Requer ferramentaria']) expect(markup).not.toContain(label);
    expect(validateProcessInstructionFields({ ...value, directCommercialTooling: true })).toEqual({});
    expect(validateProcessInstructionFields(value)).toHaveProperty('process');
  });

  it('clears routing flags when simulation is selected and disables them afterwards', () => {
    const draft = { ...emptyProcessInstructionDraft(), requester: 'Comercial', process: 'Corte', directTooling: true, requiresTooling: true };
    const { onChange } = render(draft);
    controls.selects[3]!.onValueChange('Simulação Comercial');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'Simulação Comercial', directTooling: false, requiresTooling: false }));
    const { markup } = render({ ...draft, type: 'Simulação Comercial', directTooling: false, requiresTooling: false });
    expect(markup).toContain('A Engenharia avaliará');
    expect(controls.checkboxes.get('directTooling')).toMatchObject({ checked: false, disabled: true });
    expect(controls.checkboxes.get('requiresTooling')).toMatchObject({ checked: false, disabled: true });
  });

  it('keeps routing options in the first step while showing the execution unit in the details step', () => {
    const { markup } = render({ ...emptyProcessInstructionDraft(), requester: 'Comercial', directTooling: true, requiresTooling: true }, false);
    expect(markup).toContain('Unidade de execução');
    expect(markup).toContain('Processo');
    expect(markup).not.toContain('Direto para Ferramentaria');
    expect(markup).not.toContain('Requer ferramentaria');
    expect(controls.checkboxes.size).toBe(0);
  });

  it('starts with no execution unit and shows the new controls only for Comercial', () => {
    const draft = emptyProcessInstructionDraft();
    expect(draft.executionUnit).toBe('');
    for (const requester of ['', 'Engenharia', 'Ferramentaria', 'Produção', 'Qualidade']) {
      const { markup } = render({ ...draft, requester });
      expect(markup).not.toContain('Unidade de execução');
      expect(markup).not.toContain('Direto para Ferramentaria');
    }
    const { markup } = render({ ...draft, requester: 'Comercial' });
    expect(markup).toContain('Unidade de execução');
    expect(markup).toContain('PEDERTRACTOR');
    expect(markup).toContain('TRACTOR');
    expect(markup).toContain('Direto para Ferramentaria');
  });

  it('requires an execution unit only for Comercial', () => {
    const draft = { ...emptyProcessInstructionDraft(), requester: 'Comercial', process: 'Corte', type: 'Simulação Comercial', client: 'PEDERTRACTOR' as const };
    expect(validateProcessInstructionFields(draft)).toHaveProperty('executionUnit');
    for (const executionUnit of ['PEDERTRACTOR', 'TRACTOR']) {
      expect(validateProcessInstructionFields({ ...draft, executionUnit })).toEqual({});
    }
    expect(validateProcessInstructionFields({ ...draft, requester: 'Engenharia' })).not.toHaveProperty('executionUnit');
  });

  it('forces tooling on the direct route and leaves it enabled and editable when deselected', () => {
    const draft = { ...emptyProcessInstructionDraft(), requester: 'Comercial' };
    const initial = render(draft);
    controls.checkboxes.get('directTooling')!.onCheckedChange(true);
    const direct = initial.onChange.mock.calls[0][0] as ProcessInstructionDraft;
    expect(direct).toMatchObject({ directTooling: true, requiresTooling: true });
    const selected = render(direct);
    expect(controls.checkboxes.get('requiresTooling')!.disabled).toBe(true);
    controls.checkboxes.get('directTooling')!.onCheckedChange(false);
    const standard = selected.onChange.mock.calls[0][0] as ProcessInstructionDraft;
    expect(standard).toMatchObject({ directTooling: false, requiresTooling: true });
    render(standard);
    expect(controls.checkboxes.get('requiresTooling')!.disabled).toBe(false);
  });

  it('saves the execution unit selection and clears Comercial options when changing requester', () => {
    const draft = { ...emptyProcessInstructionDraft(), requester: 'Comercial', directTooling: true, requiresTooling: true };
    const selected = render(draft);
    controls.selects[1].onValueChange('TRACTOR');
    expect(selected.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ executionUnit: 'TRACTOR' }));
    const updated = render({ ...draft, executionUnit: 'TRACTOR' });
    controls.selects[0].onValueChange('Produção');
    expect(updated.onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      requester: 'Produção', executionUnit: '', directTooling: false, requiresTooling: false,
    }));
  });
});
