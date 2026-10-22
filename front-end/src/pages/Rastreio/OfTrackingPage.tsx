import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Factory, Loader2, Search } from 'lucide-react';
import {
  AppPageContainer,
  FilterPanel,
  ListEmptyState,
  ListErrorState,
  PageHero,
  PageSectionHeader,
} from '@/components/layout';
import { OfProcessTimeline } from '@/components/of/OfProcessTimeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ofApi } from '@/services/of';
import { surfaceStyles } from '@/lib/surface-styles';
import { cn } from '@/lib/utils';

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
    <AppPageContainer width='narrow'>
      <PageHero
        eyebrow='Produção'
        eyebrowIcon={Factory}
        title='Rastreio'
        description='Acompanhe a linha do tempo dos processos de uma OF e veja quando cada operação foi apontada.'
      />

      <FilterPanel title='Consulta' description='Busque pelo número da OF'>
        <form onSubmit={handleSubmit}>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
            <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
              <Label htmlFor='of-number' className='text-xs font-medium'>
                Número da OF
              </Label>
              <Input
                id='of-number'
                type='text'
                inputMode='numeric'
                placeholder='Ex.: 123456'
                className={surfaceStyles.field}
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
      </FilterPanel>

      {searchedOf.length === 0 ? (
        <ListEmptyState>
          <Factory className='mx-auto size-8 text-muted-foreground/60' />
          <p className='mt-3 text-sm font-medium text-foreground'>
            Nenhuma OF consultada
          </p>
          <p className='mt-1 text-sm text-muted-foreground'>
            Digite o número da OF e clique em Buscar para ver a linha do tempo.
          </p>
        </ListEmptyState>
      ) : query.isLoading ? (
        <div
          className={cn(
            surfaceStyles.card,
            'flex items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground',
          )}
        >
          <Loader2 className='size-4 animate-spin' />
          Carregando processos da OF {searchedOf}…
        </div>
      ) : query.isError ? (
        <ListErrorState>
          Não foi possível carregar os processos da OF {searchedOf}.
        </ListErrorState>
      ) : (query.data?.length ?? 0) === 0 ? (
        <ListEmptyState>
          Nenhum processo encontrado para a OF {searchedOf}.
        </ListEmptyState>
      ) : (
        <section className='space-y-4'>
          <PageSectionHeader
            icon={Factory}
            title={`OF ${searchedOf}`}
            description={`${query.data!.length} ${query.data!.length === 1 ? 'operação' : 'operações'} na linha do tempo`}
          />
          <OfProcessTimeline processes={query.data!} />
        </section>
      )}
    </AppPageContainer>
  );
}
