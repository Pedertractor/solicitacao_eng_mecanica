import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center text-center'>
      <h2 className='mb-2 text-2xl font-semibold text-foreground'>404</h2>
      <p className='mb-6 text-muted-foreground'>Página não encontrada.</p>
      <Button asChild>
        <Link to='/'>Voltar ao início</Link>
      </Button>
    </div>
  );
}
