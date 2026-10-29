import { ArrowUpRight, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';

import { FlowIllustration } from '@/components/flow-illustration';
import { LoginForm } from '@/components/login-form';
import { PederflowBrand } from '@/components/pederflow-brand';
import { ROUTES } from '@/routes/constants';
import './login.css';

export function LoginPage() {
  return (
    <main className='pederflow-login'>
      <div className='login-shell'>
        <header className='login-header'>
          <Link to={ROUTES.LOGIN} className='login-brand-link' aria-label='Pederflow — início'>
            <PederflowBrand />
          </Link>
          <div className='login-companies'>
            <img
              src='/pedertractor-tractorcomponents.svg'
              alt='Pedertractor e Tractorcomponents'
              width={562}
              height={120}
              className='login-companies-logo'
            />
          </div>
        </header>

        <div className='login-body'>
          <section className='login-story' aria-labelledby='login-story-title'>
            <div className='login-story-copy'>
              <p className='login-eyebrow login-eyebrow-light'><span />ÁREA DO COLABORADOR</p>
              <h2 id='login-story-title'>Seu trabalho,<br />em um só fluxo.</h2>
              <p className='login-story-description'>Pessoas, solicitações e processos.<br />Tudo conectado para ir mais longe.</p>
            </div>

            <div className='login-flow'>
              <FlowIllustration />
            </div>

            <div className='login-story-footer'>
              <div><span className='login-yellow-line' />CONECTANDO CADA ETAPA</div>
              <span className='login-drawing-number'>PF / 01</span>
            </div>
          </section>

          <section className='login-access' aria-label='Acesso à plataforma'>
            <LoginForm />
          </section>
        </div>

        <footer className='login-footer'>
          <span><strong>Pederflow</strong><span className='login-footer-slash'>/</span>O próximo passo começa aqui.</span>
          <span className='login-footer-security'><LockKeyhole size={12} aria-hidden='true' />Acesso exclusivo para colaboradores</span>
        </footer>
      </div>
      <Link to={ROUTES.SOLICITACAO} className='login-public-link'>
        Quer abrir uma solicitação? <span>Acesse por aqui <ArrowUpRight size={13} aria-hidden='true' /></span>
      </Link>
    </main>
  );
}
