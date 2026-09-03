import * as React from 'react';
import type { LegendProps as RechartsLegendProps } from 'recharts';
import {
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
} from 'recharts';

import { cn } from '@/lib/utils';

type ChartConfig = Record<
  string,
  {
    label: string;
    color?: string;
  }
>;

type ChartContainerProps = {
  config: ChartConfig;
  children: React.ReactNode;
  className?: string;
};

const ChartContext = React.createContext<ChartConfig | null>(null);

export function useChartConfig() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) {
    throw new Error('useChartConfig must be used within a ChartContainer');
  }
  return ctx;
}

export function ChartContainer({
  config,
  className,
  children,
}: ChartContainerProps) {
  const style: React.CSSProperties = {};

  for (const [key, value] of Object.entries(config)) {
    if (value.color) {
      (style as Record<`--color-${string}`, string>)[`--color-${key}`] =
        value.color;
    }
  }

  return (
    <ChartContext.Provider value={config}>
      <div className={cn('h-full w-full', className)} style={style}>
        {children}
      </div>
    </ChartContext.Provider>
  );
}

type ChartTooltipProps = React.ComponentProps<typeof RechartsTooltip> & {
  className?: string;
};

export function ChartTooltip(props: ChartTooltipProps) {
  return (
    <RechartsTooltip
      {...props}
      contentStyle={{
        borderRadius: 8,
        borderColor: 'hsl(var(--border))',
        backgroundColor: 'hsl(var(--popover))',
        color: 'hsl(var(--popover-foreground))',
        boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
        padding: '8px 10px',
      }}
      wrapperStyle={{ outline: 'none' }}
      labelClassName='mb-1 text-xs font-medium text-muted-foreground'
      itemStyle={{ fontSize: 12 }}
    />
  );
}

type ChartLegendProps = RechartsLegendProps & {
  className?: string;
};

export function ChartLegend(props: ChartLegendProps) {
  return (
    <RechartsLegend
      {...props}
      wrapperStyle={{
        paddingTop: 8,
      }}
    />
  );
}

