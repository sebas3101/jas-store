import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store';
import { AppLayout }       from './components/layout/AppLayout';
import { LoginPage }       from './pages/LoginPage';
import { DashboardPage }   from './pages/DashboardPage';
import { ClientsPage }     from './pages/ClientsPage';
import { ClientDetailPage }from './pages/ClientDetailPage';
import { OrdersPage }      from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { PaymentsPage }    from './pages/PaymentsPage';
import { ProductsPage }    from './pages/ProductsPage';
import { SuppliersPage }   from './pages/SuppliersPage';
import { DeliveriesPage }  from './pages/DeliveriesPage';
import { PublicationsPage }from './pages/PublicationsPage';
import { ReportsPage }     from './pages/ReportsPage';
import { SettingsPage }    from './pages/SettingsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const currentUser = useAppStore(s => s.currentUser);
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Pantalla de carga mientras Supabase inicializa
function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
      <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      <p className="text-sm text-gray-500 font-medium">Conectando con JAS Store...</p>
    </div>
  );
}

// Pantalla de error de conexión
function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3 px-6">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-lg font-bold text-gray-800">Error de conexión</h2>
      <p className="text-sm text-gray-500 text-center max-w-sm">{message}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}

export default function App() {
  const { initialize, initialized, isLoading, error } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading || !initialized) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index                  element={<DashboardPage />} />
          <Route path="clientes"        element={<ClientsPage />} />
          <Route path="clientes/:id"    element={<ClientDetailPage />} />
          <Route path="pedidos"         element={<OrdersPage />} />
          <Route path="pedidos/:id"     element={<OrderDetailPage />} />
          <Route path="pagos"           element={<PaymentsPage />} />
          <Route path="productos"       element={<ProductsPage />} />
          <Route path="proveedores"     element={<SuppliersPage />} />
          <Route path="entregas"        element={<DeliveriesPage />} />
          <Route path="publicaciones"   element={<PublicationsPage />} />
          <Route path="reportes"        element={<ReportsPage />} />
          <Route path="configuracion"   element={<SettingsPage />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
