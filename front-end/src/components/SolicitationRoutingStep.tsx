import { ArrowUpRight, Check, Cog, Compass, SlidersHorizontal, Wrench } from 'lucide-react';
import { PROCESS_REQUESTERS } from '@/config/process-instruction';
import type { ProcessInstructionDraft } from '@/config/process-instruction-draft';
import { changeSolicitationRequester, SOLICITATION_DESTINATIONS, type SolicitationDestination, type SolicitationRoutingErrors } from '@/config/solicitation-routing';
import { ComercialWorkflowOptions } from '@/components/ComercialWorkflowOptions';

export function SolicitationRoutingStep({ destination, onDestinationChange, value, onChange, errors }: {
  destination: SolicitationDestination | '';
  onDestinationChange: (destination: SolicitationDestination) => void;
  value: ProcessInstructionDraft;
  onChange: (next: ProcessInstructionDraft) => void;
  errors: SolicitationRoutingErrors;
}) {
  return (
    <div className='solicitation-routing-fields'>
      <fieldset aria-describedby={errors.destination ? 'destination-error' : undefined}>
        <legend><span className='solicitation-field-number'>01</span> Qual é o destino da solicitação?</legend>
        <p className='solicitation-field-hint'>Escolha a equipe que vai receber o chamado.</p>
        <div className='solicitation-destinations'>
          {SOLICITATION_DESTINATIONS.map(({ value: destinationValue, label, description }) => {
            const Icon = destinationValue === 'ENG_MECANICA' ? Cog : destinationValue === 'FERRAMENTARIA' ? Wrench : Compass;
            const selected = destination === destinationValue;
            return (
              <button key={destinationValue} type='button' className='solicitation-destination' aria-pressed={selected}
                onClick={() => onDestinationChange(destinationValue)}>
                <span className='solicitation-destination-top'><span className='solicitation-choice-icon'><Icon size={21} aria-hidden /></span>
                  <span className='solicitation-choice-check'>{selected ? <Check size={13} aria-hidden /> : <ArrowUpRight size={15} aria-hidden />}</span>
                </span>
                <strong>{label}</strong><span>{description}</span>
              </button>
            );
          })}
        </div>
        {errors.destination && <p id='destination-error' className='text-sm text-destructive' role='alert'>{errors.destination}</p>}
      </fieldset>
      <fieldset aria-describedby={errors.requester ? 'requester-department-error' : undefined}>
        <legend><span className='solicitation-field-number'>02</span> Qual departamento está solicitando?</legend>
        <p className='solicitation-field-hint'>A origem ajuda a definir as etapas necessárias.</p>
        <div className='solicitation-requesters'>
          {(destination === 'FERRAMENTARIA' ? ['Comercial'] : PROCESS_REQUESTERS).map((requester) => (
            <button type='button' key={requester} aria-pressed={value.requester === requester}
              onClick={() => onChange(changeSolicitationRequester(value, requester))}>
              {requester}{value.requester === requester && <Check size={13} aria-hidden />}
            </button>
          ))}
        </div>
        {errors.requester && <p id='requester-department-error' className='text-sm text-destructive' role='alert'>{errors.requester}</p>}
      </fieldset>
      {destination === 'DESENVOLVIMENTO_PROCESSOS' && value.requester === 'Comercial' && (
        <section className='solicitation-route-options' aria-labelledby='route-options-title'>
          <h3 id='route-options-title'><SlidersHorizontal size={16} aria-hidden /> Ajuste o caminho do chamado</h3>
          <ComercialWorkflowOptions value={value} onChange={onChange} />
        </section>
      )}
    </div>
  );
}
