import { useEffect, useRef, useState } from 'react';
import { CogIcon } from 'lucide-animated';

import { LoginGearField } from '@/components/login-gear-field';
import { LoginForm } from '@/components/login-form';
import { PlatformPageShell } from '@/components/platform-backdrop';
import type { AnimatedIconHandle } from '@/config/sidebar';

const INTRO_ANIMATION_MS = 2000;

export function LoginPage() {
  const cogRef = useRef<AnimatedIconHandle>(null);
  const [gearsVisible, setGearsVisible] = useState(true);

  useEffect(() => {
    cogRef.current?.startAnimation();

    const timeout = window.setTimeout(() => {
      setGearsVisible(false);
      cogRef.current?.stopAnimation();
    }, INTRO_ANIMATION_MS);

    return () => window.clearTimeout(timeout);
  }, []);

  function handleHeaderEnter() {
    cogRef.current?.startAnimation();
    setGearsVisible(true);
  }

  function handleHeaderLeave() {
    cogRef.current?.stopAnimation();
    setGearsVisible(false);
  }

  return (
    <PlatformPageShell
      className='h-svh items-center justify-center overflow-y-auto p-6 md:p-10'
      contentClassName='w-full max-w-sm flex-col items-center justify-center gap-6'
      overlay={<LoginGearField visible={gearsVisible} />}
    >
      <div className='flex w-full flex-col gap-6'>
        <a
          href='/'
          className='group flex items-center gap-3 self-center text-foreground transition-opacity hover:opacity-90'
          onMouseEnter={handleHeaderEnter}
          onMouseLeave={handleHeaderLeave}
        >
          <div className='flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-shadow group-hover:shadow-md'>
            <CogIcon ref={cogRef} size={18} className='shrink-0' />
          </div>
          <span className='text-base font-semibold tracking-tight'>
            Solicitação Engenharia Mecânica
          </span>
        </a>
        <LoginForm />
      </div>
    </PlatformPageShell>
  );
}
