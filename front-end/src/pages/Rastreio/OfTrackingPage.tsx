import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Factory, Loader2, Search } from 'lucide-react';
import { OfProcessTimeline } from '@/components/of/OfProcessTimeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ofApi } from '@/services/of';

export function OfTrackingPage() {
  const [ofInput, setOfInput] = useState('');
  const [searchedOf, setSearchedOf] = useState('');

  const query = useQuery({
    queryKey: ['of-processes', searchedOf],
    queryFn: () => ofApi.getProcesses(searchedOf),
    enabled: searchedOf.length > 0,
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = ofInput.trim();
    if (!trimmed) return;
    setSearchedOf(trimmed);
  }

  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6'>
      <div>
        <h1 className='text-2xl font-semibold tracking-tight'>Rastreio</h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          Acompanhe a linha do tempo dos processos de uma OF e veja quando cada
          operação foi apontada.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className='rounded-xl border bg-card p-4 shadow-sm sm:p-5'
      >
        <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
          <div className='flex min-w-0 flex-1 flex-col gap-2'>
            <Label htmlFor='of-number'>Número da OF</Label>
            <Input
              id='of-number'
              type='text'
              inputMode='numeric'
              placeholder='Ex.: 123456'
              value={ofInput}
              onChange={(event) => setOfInput(event.target.value)}
              autoComplete='off'
            />
          </div>
          <Button
            type='submit'
            disabled={!ofInput.trim() || query.isFetching}
            className='sm:w-auto'
          >
            {query.isFetching ? (
              <>
                <Loader2 className='size-4 animate-spin' />
                Buscando
              </>
            ) : (
              <>
                <Search className='size-4' />
                Buscar
              </>
            )}
          </Button>
        </div>
      </form>

      {searchedOf.length === 0 ? (
        <div className='rounded-xl border border-dashed px-6 py-12 text-center'>
          <Factory className='mx-auto size-8 text-muted-foreground/60' />
          <p className='mt-3 text-sm font-medium'>Nenhuma OF consultada</p>
          <p className='mt-1 text-sm text-muted-foreground'>
            Digite o número da OF e clique em Buscar para ver a linha do tempo.
          </p>
        </div>
      ) : query.isLoading ? (
        <div className='flex items-center justify-center gap-2 rounded-xl border px-6 py-12 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' />
          Carregando processos da OF {searchedOf}…
        </div>
      ) : query.isError ? (
        <div className='rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center text-sm text-destructive'>
          Não foi possível carregar os processos da OF {searchedOf}.
        </div>
      ) : (query.data?.length ?? 0) === 0 ? (
        <div className='rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground'>
          Nenhum processo encontrado para a OF {searchedOf}.
        </div>
      ) : (
        <section className='space-y-4'>
          <div className='flex flex-wrap items-end justify-between gap-2'>
            <div>
              <h2 className='text-lg font-semibold tracking-tight'>
                OF {searchedOf}
              </h2>
              <p className='text-sm text-muted-foreground'>
                {query.data!.length}{' '}
                {query.data!.length === 1 ? 'operação' : 'operações'} na
                linha do tempo
              </p>
            </div>
          </div>
          <OfProcessTimeline processes={query.data!} />
        </section>
      )}
    </div>
  );
}
