import '@/styles/pederflow-brand.css';

export function PederflowBrand({ caption = 'PLATAFORMA INTERNA' }: { caption?: string } = {}) {
  return (
    <span className='pederflow-brand'>
      <svg className='pederflow-brand-mark' width='40' height='40' viewBox='0 0 40 40' fill='none' aria-hidden='true'>
        <rect width='40' height='40' rx='11' fill='#0675BD' />
        <path d='M12 29V11H21a5 5 0 0 1 0 10H12' stroke='white' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' />
        <path d='m18 28 9-7' stroke='white' strokeOpacity='.65' strokeWidth='2.5' strokeLinecap='round' />
        <circle cx='29' cy='10' r='2.5' fill='#F4CE57' />
      </svg>
      <span className='pederflow-brand-name'>peder<span>flow</span><span className='pederflow-brand-caption'>{caption}</span></span>
    </span>
  );
}
