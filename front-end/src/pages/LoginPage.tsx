import { Cog } from 'lucide-react';

import { LoginForm } from '@/components/login-form';
import { PlatformPageShell } from '@/components/platform-backdrop';

export function LoginPage() {
  return (
    <PlatformPageShell
      className="h-svh items-center justify-center overflow-y-auto p-6 md:p-10"
      contentClassName="w-full max-w-sm flex-col items-center justify-center gap-6"
    >
      <div className="flex w-full flex-col gap-6">
        <a
          href="/"
          className="group flex items-center gap-3 self-center text-foreground transition-opacity hover:opacity-90"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-shadow group-hover:shadow-md">
            <Cog size={18} className="shrink-0" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Solicitação Pedertractor
          </span>
        </a>
        <LoginForm />
      </div>
    </PlatformPageShell>
  );
}
