import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../utils/cn';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'purple' | 'green' | 'yellow' | 'red' | 'blue' | 'gray';
  trend?: { value: number; label: string };
  className?: string;
}

const colorMap = {
  purple: {
    icon: 'bg-primary-100 text-primary-600',
    accent: 'bg-primary-600',
  },
  green: {
    icon: 'bg-emerald-100 text-emerald-600',
    accent: 'bg-emerald-500',
  },
  yellow: {
    icon: 'bg-amber-100 text-amber-600',
    accent: 'bg-amber-500',
  },
  red: {
    icon: 'bg-red-100 text-red-600',
    accent: 'bg-red-500',
  },
  blue: {
    icon: 'bg-blue-100 text-blue-600',
    accent: 'bg-blue-500',
  },
  gray: {
    icon: 'bg-gray-100 text-gray-500',
    accent: 'bg-gray-400',
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'purple',
  trend,
  className,
}: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={cn('stat-card relative overflow-hidden', className)}>
      {/* Barra de color superior */}
      <div className={cn('absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl', c.accent)} />

      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-xl', c.icon)}>
          <Icon size={19} strokeWidth={2} />
        </div>
        {trend && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full',
              trend.value >= 0
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-red-50 text-red-600'
            )}
          >
            {trend.value >= 0
              ? <TrendingUp size={11} />
              : <TrendingDown size={11} />
            }
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 break-words leading-tight">
          {value}
        </p>
        <p className="text-xs font-medium text-gray-500 mt-0.5 leading-snug">{title}</p>
        {subtitle && (
          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
