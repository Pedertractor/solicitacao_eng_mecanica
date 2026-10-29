import { Link } from 'react-router-dom';
import { PederflowBrand } from '@/components/pederflow-brand';
import { ROUTES } from '@/routes/constants';

export function PublicPlatformHeader() {
  return (
    <header className='pederflow-public-header'>
      <Link to={ROUTES.LOGIN} aria-label='Pederflow — acessar a plataforma'>
        <PederflowBrand />
      </Link>
      <img src='/pedertractor-tractorcomponents.svg' alt='Pedertractor e Tractorcomponents' width={562} height={120} />
    </header>
  );
}
