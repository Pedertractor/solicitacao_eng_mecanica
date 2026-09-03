import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { createElement, Fragment, type ReactNode } from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Insere zero-width spaces em sequências longas sem espaço,
 * para o texto quebrar no mobile em vez de estourar o layout.
 */
export function softWrapLongTokens(text: string, maxRun = 8): string {
  return text.replace(/\S+/g, (token) => {
    if (token.length <= maxRun) return token;
    return token.replace(new RegExp(`(.{${maxRun}})`, 'g'), '$1\u200B');
  });
}

/** Renderiza texto com <wbr> em pontos seguros — mais confiável que CSS puro no mobile. */
export function SoftBreakText({
  text,
  maxRun = 8,
}: {
  text: string;
  maxRun?: number;
}): ReactNode {
  const parts = softWrapLongTokens(text, maxRun).split('\u200B');
  return parts.map((part, index) =>
    createElement(
      Fragment,
      { key: `${index}-${part.slice(0, 8)}` },
      part,
      index < parts.length - 1 ? createElement('wbr') : null,
    ),
  );
}
