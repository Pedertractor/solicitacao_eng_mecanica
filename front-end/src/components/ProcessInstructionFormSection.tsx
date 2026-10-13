import {
  describeDeadline,
  listProcesses,
  listTypes,
  PROCESS_REQUESTERS,
  shouldShowDeliveryDate,
  type ProcessInstructionFieldErrors,
} from '@/config/process-instruction';
import type { ProcessInstructionDraft } from '@/config/process-instruction-draft';
import { PartNumberAllocator } from '@/components/PartNumberAllocator';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  SOLICITATION_CLIENT_LABELS,
  SOLICITATION_CLIENT_OPTIONS,
  type SolicitationClient,
} from '@/services/solicitation';

export function ProcessInstructionFormSection({
  value,
  onChange,
  errors,
  onClearError,
}: {
  value: ProcessInstructionDraft;
  onChange: (next: ProcessInstructionDraft) => void;
  errors: ProcessInstructionFieldErrors;
  onClearError: (field: keyof ProcessInstructionFieldErrors) => void;
}) {
  const processes = listProcesses(value.requester);
  const types = listTypes(value.requester, value.process);
  const showDelivery = shouldShowDeliveryDate(
    value.requester,
    value.process,
    value.type,
  );
  const deadline = describeDeadline(
    value.requester,
    value.process,
    value.type,
    value.deliveryDate,
  );

  return (
    <div className='space-y-4'>
      <OptionSelect
        id='processRequester'
        label='Solicitante'
        required
        placeholder='Selecione o solicitante...'
        value={value.requester}
        options={PROCESS_REQUESTERS.map((item) => ({
          value: item,
          label: item,
        }))}
        error={errors.requester}
        onChange={(requester) => {
          onClearError('requester');
          onClearError('process');
          onClearError('type');
          onClearError('deliveryDate');
          onChange({
            ...value,
            requester,
            process: '',
            type: '',
            deliveryDate: '',
            requiresTooling:
              requester === 'Comercial' ? value.requiresTooling : false,
          });
        }}
      />

      {value.requester === 'Comercial' ? (
        <div className='flex items-start gap-3 rounded-md border px-3 py-3'>
          <Checkbox
            id='requiresTooling'
            checked={value.requiresTooling}
            onCheckedChange={(checked) =>
              onChange({ ...value, requiresTooling: checked === true })
            }
          />
          <div className='grid gap-1'>
            <Label htmlFor='requiresTooling' className='cursor-pointer'>
              Requer ferramentaria
            </Label>
            <p className='text-xs text-muted-foreground'>
              Inclui a etapa Ferramentaria no workflow após Engenharia.
            </p>
          </div>
        </div>
      ) : null}

      <OptionSelect
        id='processName'
        label='Processo'
        required
        placeholder={
          value.requester
            ? 'Selecione o processo...'
            : 'Selecione primeiro o solicitante...'
        }
        value={value.process}
        disabled={!value.requester}
        options={processes.map((item) => ({ value: item, label: item }))}
        error={errors.process}
        onChange={(process) => {
          onClearError('process');
          onClearError('type');
          onClearError('deliveryDate');
          onChange({ ...value, process, type: '', deliveryDate: '' });
        }}
      />

      <div className='grid gap-2'>
        <OptionSelect
          id='processType'
          label='Tipo'
          required
          placeholder={
            value.process
              ? 'Selecione o tipo...'
              : 'Selecione primeiro o processo...'
          }
          value={value.type}
          disabled={!value.process}
          options={types.map((item) => ({ value: item, label: item }))}
          error={errors.type}
          onChange={(type) => {
            onClearError('type');
            onClearError('deliveryDate');
            onChange({ ...value, type, deliveryDate: '' });
          }}
        />
        {deadline && (
          <div className='rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground'>
            <p>
              <span className='font-medium text-foreground'>Prazo:</span>{' '}
              {deadline.prazo}
            </p>
            <p>
              <span className='font-medium text-foreground'>Data limite:</span>{' '}
              {deadline.dataLimite}
            </p>
          </div>
        )}
      </div>

      {showDelivery && (
        <div className='grid gap-2'>
          <Label htmlFor='deliveryDate'>
            Data de entrega <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='deliveryDate'
            type='date'
            value={value.deliveryDate}
            onChange={(event) => {
              onClearError('deliveryDate');
              onChange({ ...value, deliveryDate: event.target.value });
            }}
            aria-invalid={!!errors.deliveryDate}
          />
          {errors.deliveryDate && (
            <p className='text-sm text-destructive'>{errors.deliveryDate}</p>
          )}
        </div>
      )}

      <OptionSelect
        id='processClient'
        label='Cliente'
        required
        placeholder='Selecione o cliente...'
        value={value.client}
        options={SOLICITATION_CLIENT_OPTIONS.map((client) => ({
          value: client,
          label: SOLICITATION_CLIENT_LABELS[client],
        }))}
        error={errors.client}
        onChange={(client) => {
          onClearError('client');
          onChange({ ...value, client: client as SolicitationClient });
        }}
      />

      <PartNumberAllocator
        value={value.allocatedPartNumbers}
        onChange={(allocatedPartNumbers) =>
          onChange({ ...value, allocatedPartNumbers })
        }
      />

      <div className='grid gap-2'>
        <Label htmlFor='fileLink'>Link de arquivos</Label>
        <Input
          id='fileLink'
          type='url'
          value={value.fileLink}
          placeholder='https://...'
          onChange={(event) => {
            onClearError('fileLink');
            onChange({ ...value, fileLink: event.target.value });
          }}
          aria-invalid={!!errors.fileLink}
        />
        {errors.fileLink && (
          <p className='text-sm text-destructive'>{errors.fileLink}</p>
        )}
      </div>

      <div className='grid gap-2'>
        <Label htmlFor='processComments'>Comentários</Label>
        <textarea
          id='processComments'
          rows={3}
          placeholder='Observações adicionais (opcional)'
          className={cn(
            'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-24 w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          )}
          value={value.comments}
          onChange={(event) =>
            onChange({ ...value, comments: event.target.value })
          }
        />
      </div>
    </div>
  );
}

function OptionSelect({
  id,
  label,
  required = false,
  placeholder,
  value,
  options,
  disabled = false,
  error,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>
        {label}
        {required ? <span className='text-destructive'> *</span> : null}
      </Label>
      <Select
        value={value || undefined}
        disabled={disabled}
        onValueChange={onChange}
      >
        <SelectTrigger id={id} aria-invalid={!!error} className='w-full'>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className='text-sm text-destructive'>{error}</p>}
    </div>
  );
}
