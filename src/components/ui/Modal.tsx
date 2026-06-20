import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Animate in on mount
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const el = panelRef.current;
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = window.innerWidth < 640 ? 'translateY(24px)' : 'translateY(10px) scale(0.97)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 200ms ease, transform 200ms ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        style={{ animation: 'fadeIn 150ms ease' }}
      />
      <div
        ref={panelRef}
        className={cn(
          'relative bg-white w-full flex flex-col max-h-[92vh] sm:max-h-[90vh]',
          'rounded-t-2xl sm:rounded-2xl shadow-2xl',
          sizes[size]
        )}
      >
        {/* Pull handle — solo móvil */}
        <div className="sm:hidden w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 pr-2 leading-snug">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Cerrar"
           type="button">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 sm:py-5">{children}</div>
      </div>
    </div>
  );
}
