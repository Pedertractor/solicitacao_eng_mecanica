import { cn } from '@/lib/utils';

export function KairoIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('size-6 shrink-0', className)}
    >
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="#1e3a5f"
        stroke="#3b82f6"
        strokeWidth="2"
      />
      <circle cx="16" cy="16" r="1.5" fill="#93c5fd" />
      <path
        d="M16 8v8l5.5 3.5"
        stroke="#93c5fd"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="4.5" r="1" fill="#60a5fa" />
      <circle cx="16" cy="27.5" r="1" fill="#60a5fa" />
      <circle cx="4.5" cy="16" r="1" fill="#60a5fa" />
      <circle cx="27.5" cy="16" r="1" fill="#60a5fa" />
    </svg>
  );
}
