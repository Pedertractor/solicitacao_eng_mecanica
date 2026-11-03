import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { splitStoredPartNumbers } from '@/lib/part-numbers';

function samePart(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function PartNumberAllocator({
  value,
  onChange,
}: {
  value: string[];
  onChange: (parts: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const trimmedQuery = query.trim();

  const addPart = () => {
    if (!trimmedQuery) return;
    if (value.some((item) => samePart(item, trimmedQuery))) {
      setMessage('Part number já adicionado.');
      return;
    }
    onChange([...value, trimmedQuery]);
    setQuery('');
    setMessage(null);
  };

  return (
    <div className='grid gap-2'>
      <Label htmlFor='partNumber'>partnumber (P.N)</Label>
      <div className='flex gap-2'>
        <Input
          id='partNumber'
          value={query}
          placeholder='Digite o part number'
          onChange={(event) => {
            setQuery(event.target.value);
            setMessage(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addPart();
            }
          }}
          aria-invalid={Boolean(message)}
        />
        <Button type='button' variant='outline' disabled={!trimmedQuery} onClick={addPart}>
          Adicionar
        </Button>
      </div>
      <p className='text-sm text-muted-foreground'>Digite o part number e clique em Adicionar ou pressione Enter.</p>
      {message && <p role='alert' className='text-sm text-destructive'>{message}</p>}
      {value.length > 0 && (
        <ul className='grid grid-cols-3 gap-2'>
          {value.map((part) => (
            <li
              key={part}
              className='flex min-w-0 items-center justify-between gap-1 rounded-md border bg-muted/30 px-2 py-2 sm:px-3'
            >
              <span className='min-w-0 truncate font-mono text-xs sm:text-sm'>
                {part}
              </span>
              <Button
                type='button'
                variant='ghost'
                size='icon-xs'
                aria-label={`Remover ${part}`}
                onClick={() =>
                  onChange(value.filter((item) => !samePart(item, part)))
                }
              >
                <X className='size-3.5' />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PartNumberChips({ value }: { value: string | null }) {
  const parts = splitStoredPartNumbers(value);
  if (parts.length === 0) {
    return <p className='mt-1 text-sm'>—</p>;
  }
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {parts.map((part) => (
        <li
          key={part}
          className="max-w-full truncate rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] leading-tight"
        >
          {part}
        </li>
      ))}
    </ul>
  );
}
