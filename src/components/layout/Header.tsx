import { Bell } from 'lucide-react';
import { useAppStore } from '../../store';
import logoUrl from '../../assets/logo.jpeg';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { currentUser, orders, clients } = useAppStore();

  const alertCount =
    orders.filter(
      (o) => o.status === 'por_recoger' || o.status === 'pendiente_pago'
    ).length +
    clients.filter((c) => c.status === 'mora').length;

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
      <img src={logoUrl} alt="JAS" className="w-8 h-8 rounded-lg object-cover" />
      <p className="font-bold text-gray-900 text-sm flex-1">
        {title ?? 'JAS Store'}
      </p>
      <div className="flex items-center gap-1">
        <button className="p-2 rounded-xl hover:bg-gray-100 relative">
          <Bell size={18} className="text-gray-500" />
          {alertCount > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>
        <div className="w-8 h-8 bg-primary-100 rounded-xl flex items-center justify-center">
          <span className="text-primary-700 font-bold text-xs">
            {currentUser?.name.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  );
}
