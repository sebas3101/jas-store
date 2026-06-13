import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Header } from './Header';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
          <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
