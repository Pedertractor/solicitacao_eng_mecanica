import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { AppPageContainer, PageHero } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { surfaceStyles } from '@/lib/surface-styles';
import { cn } from '@/lib/utils';

export function NotFoundPage() {
  return (
    <AppPageContainer width='narrow'>
      <PageHero
        eyebrow='Erro'
        eyebrowIcon={FileQuestion}
        title='Página não encontrada'
        description='O endereço acessado não existe ou foi movido.'
        compact
      />
      <div
        className={cn(
          surfaceStyles.emptyState,
          'flex flex-col items-center gap-4',
        )}
      >
        <p className='text-4xl font-bold tracking-tight text-foreground'>404</p>
        <p className='text-sm text-muted-foreground'>
          Verifique o link ou volte para o início do painel.
        </p>
        <Button asChild>
          <Link to='/'>Voltar ao início</Link>
        </Button>
      </div>
    </AppPageContainer>
  );
}
