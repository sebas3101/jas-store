import type { LucideIcon } from 'lucide-react';
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
  purple: { bg: 'bg-primary-50', icon: 'bg-primary-100 text-primary-600', text: 'text-primary-600' },
  green:  { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-600' },
  yellow: { bg: 'bg-amber-50',   icon: 'bg-amber-100 text-amber-600',     text: 'text-amber-600'   },
  red:    { bg: 'bg-red-50',     icon: 'bg-red-100 text-red-600',         text: 'text-red-600'     },
  blue:   { bg: 'bg-blue-50',    icon: 'bg-blue-100 text-blue-600',       text: 'text-blue-600'    },
  gray:   { bg: 'bg-gray-50',    icon: 'bg-gray-100 text-gray-600',       text: 'text-gray-600'    },
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
    <div className={cn('stat-card', className)}>
      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-xl', c.icon)}>
          <Icon size={20} />
        </div>
        {trend && (
          <span
            className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              trend.value >= 0
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-red-50 text-red-600'
            )}
          >
            {trend.value >= 0 ? '+' : ''}
            {trend.value}% {trend.label}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1 break-words leading-tight">{value}</p>
        <p className="text-xs sm:text-sm font-medium text-gray-500 mt-0.5 leading-snug">{title}</p>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{subtitle}</p>}
      </div>
    </div>
  );
}
