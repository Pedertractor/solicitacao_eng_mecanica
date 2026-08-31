import type { PillarCode } from '@/config/pillars';
import { PILLAR_OPTIONS } from '@/config/pillars';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

type Props = {
  idPrefix?: string;
  value: PillarCode[];
  onChange: (value: PillarCode[]) => void;
  disabled?: boolean;
};

export function PillarMultiSelect({
  idPrefix = 'pillar',
  value,
  onChange,
  disabled = false,
}: Props) {
  const toggle = (code: PillarCode, checked: boolean) => {
    if (checked) {
      onChange([...new Set([...value, code])]);
      return;
    }
    onChange(value.filter((item) => item !== code));
  };

  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      {PILLAR_OPTIONS.map((option) => {
        const inputId = `${idPrefix}-${option.value}`;
        const checked = value.includes(option.value);
        return (
          <div key={option.value} className='flex items-center gap-2'>
            <Checkbox
              id={inputId}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(next) =>
                toggle(option.value, next === true)
              }
            />
            <Label htmlFor={inputId} className='font-normal'>
              {option.label}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
