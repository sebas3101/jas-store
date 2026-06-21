import { useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

interface Props {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: Props) {
  const refresh = useCallback(onRefresh, [onRefresh]);
  const { isPulling, pullDistance, isRefreshing } = usePullToRefresh({ onRefresh: refresh });

  const showIndicator = isPulling || isRefreshing;
  const triggered     = pullDistance >= 64;

  return (
    <div className="relative">
      {/* Indicator */}
      {showIndicator && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-white shadow-md border border-gray-100 transition-all"
          style={{
            top: isRefreshing ? 8 : Math.max(pullDistance - 36, -8),
          }}
        >
          <RefreshCw
            size={16}
            className={`text-primary-600 transition-transform ${
              isRefreshing ? 'animate-spin' : triggered ? 'rotate-180' : ''
            }`}
          />
        </div>
      )}
      <div style={{ transform: isRefreshing ? 'translateY(44px)' : isPulling ? `translateY(${pullDistance * 0.5}px)` : undefined, transition: isRefreshing || isPulling ? undefined : 'transform 0.2s ease' }}>
        {children}
      </div>
    </div>
  );
}
