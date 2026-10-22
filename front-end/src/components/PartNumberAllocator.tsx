import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { splitStoredPartNumbers } from '@/lib/part-numbers';
import { solicitationApi } from '@/services/solicitation';
import { cn } from '@/lib/utils';

type LookupPhase = 'idle' | 'loading' | 'found' | 'notFound' | 'error';

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
  const [phase, setPhase] = useState<LookupPhase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const debounceTimerRef = useRef<number | undefined>(undefined);
  const requestIdRef = useRef(0);

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    return () => {
      window.clearTimeout(debounceTimerRef.current);
      requestIdRef.current += 1;
    };
  }, []);

  const trimmedQuery = query.trim();
  const displayPhase = trimmedQuery ? phase : 'idle';
  const displayMessage = trimmedQuery ? message : null;

  const runLookup = (trimmed: string) => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    void (async () => {
      try {
        const part = await solicitationApi.lookupPartByNumber(trimmed);
        if (requestId !== requestIdRef.current) return;
        if (valueRef.current.some((item) => samePart(item, part.partNumber))) {
          toast.error('Part number já adicionado.');
          setPhase('error');
          setMessage('Part number já adicionado.');
          return;
        }
        onChangeRef.current([...valueRef.current, part.partNumber]);
        setPhase('found');
        setMessage(null);
        window.setTimeout(() => {
          if (requestId !== requestIdRef.current) return;
          setQuery('');
          setPhase('idle');
        }, 450);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        const status = (error as { status?: number }).status;
        setPhase(status === 404 ? 'notFound' : 'error');
        setMessage(
          status === 404
            ? 'Part number não encontrado.'
            : ((error as { message?: string }).message ??
              'Não foi possível consultar o part number.'),
        );
      }
    })();
  };

  const handleQueryChange = (next: string) => {
    setQuery(next);
    window.clearTimeout(debounceTimerRef.current);

    const trimmed = next.trim();
    if (!trimmed) {
      requestIdRef.current += 1;
      setPhase('idle');
      setMessage(null);
      return;
    }

    setPhase('loading');
    setMessage(null);
    debounceTimerRef.current = window.setTimeout(() => {
      runLookup(trimmed);
    }, 500);
  };

  return (
    <div className='grid gap-2'>
      <Label htmlFor='partNumber'>partnumber (P.N)</Label>
      <div className='relative'>
        <Input
          id='partNumber'
          value={query}
          placeholder='Digite o part number'
          onChange={(event) => handleQueryChange(event.target.value)}
          aria-invalid={displayPhase === 'notFound' || displayPhase === 'error'}
          className={cn(
            (displayPhase === 'loading' || displayPhase === 'found') && 'pr-9',
          )}
        />
        {displayPhase === 'loading' && (
          <Loader2
            className='pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground'
            aria-hidden
          />
        )}
        {displayPhase === 'found' && (
          <Check
            className='pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-green-600'
            aria-hidden
          />
        )}
      </div>
      {displayMessage && <p className='text-sm text-destructive'>{displayMessage}</p>}
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
