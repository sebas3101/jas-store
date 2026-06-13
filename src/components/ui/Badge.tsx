import { cn } from '../../utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'green' | 'yellow' | 'red' | 'gray' | 'purple' | 'blue';
  className?: string;
}

export function Badge({ children, variant = 'gray', className }: BadgeProps) {
  const variants = {
    green: 'badge-green',
    yellow: 'badge-yellow',
    red: 'badge-red',
    gray: 'badge-gray',
    purple: 'badge-purple',
    blue: 'badge-blue',
  };
  return (
    <span className={cn(variants[variant], className)}>
      {children}
    </span>
  );
}
