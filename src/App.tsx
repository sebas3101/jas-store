import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from './store';
import { AppLayout } from './components/layout/AppLayout';
// LoginPage carga de forma estática — es la primera pantalla, debe estar disponible de inmediato
import { LoginPage } from './pages/LoginPage';

// Páginas cargadas bajo demanda: cada una genera su propio chunk en el build
// y Recharts (la librería más pesada) solo se descarga cuando el usuario
// visita Dashboard o Reportes por primera vez.
const DashboardPage    = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ClientsPage      = lazy(() => import('./pages/ClientsPage').then(m => ({ default: m.ClientsPage })));
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage').then(m => ({ default: m.ClientDetailPage })));
const OrdersPage       = lazy(() => import('./pages/OrdersPage').then(m => ({ default: m.OrdersPage })));
const OrderDetailPage  = lazy(() => import('./pages/OrderDetailPage').then(m => ({ default: m.OrderDetailPage })));
const PaymentsPage     = lazy(() => import('./pages/PaymentsPage').then(m => ({ default: m.PaymentsPage })));
const ProductsPage     = lazy(() => import('./pages/ProductsPage').then(m => ({ default: m.ProductsPage })));
const SuppliersPage    = lazy(() => import('./pages/SuppliersPage').then(m => ({ default: m.SuppliersPage })));
const DeliveriesPage   = lazy(() => import('./pages/DeliveriesPage').then(m => ({ default: m.DeliveriesPage })));
const PublicationsPage = lazy(() => import('./pages/PublicationsPage').then(m => ({ default: m.PublicationsPage })));
const ReportsPage      = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const FinancesPage     = lazy(() => import('./pages/FinancesPage').then(m => ({ default: m.FinancesPage })));
const GoalsPage        = lazy(() => import('./pages/GoalsPage').then(m => ({ default: m.GoalsPage })));
const SettingsPage     = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const WarrantiesPage     = lazy(() => import('./pages/WarrantiesPage').then(m => ({ default: m.WarrantiesPage })));
const PaymentProofPage   = lazy(() => import('./pages/PaymentProofPage').then(m => ({ default: m.PaymentProofPage })));
const RecordatoriosPage  = lazy(() => import('./pages/RecordatoriosPage').then(m => ({ default: m.RecordatoriosPage })));
const ExpensesPage       = lazy(() => import('./pages/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const ChangePasswordPage    = lazy(() => import('./pages/ChangePasswordPage').then(m => ({ default: m.ChangePasswordPage })));
const ContactImportPage     = lazy(() => import('./pages/ContactImportPage').then(m => ({ default: m.ContactImportPage })));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const currentUser = useAppStore(s => s.currentUser);
  const { pathname } = useLocation();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.requirePasswordChange && pathname !== '/cambiar-contrasena') {
    return <Navigate to="/cambiar-contrasena" replace />;
  }
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
      <Suspense fallback={<LoadingScreen />}>
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
            <Route path="clientes"          element={<ClientsPage />} />
            <Route path="clientes/importar" element={<ContactImportPage />} />
            <Route path="clientes/:id"      element={<ClientDetailPage />} />
            <Route path="pedidos"         element={<OrdersPage />} />
            <Route path="pedidos/:id"     element={<OrderDetailPage />} />
            <Route path="pagos"           element={<PaymentsPage />} />
            <Route path="productos"       element={<ProductsPage />} />
            <Route path="proveedores"     element={<SuppliersPage />} />
            <Route path="entregas"        element={<DeliveriesPage />} />
            <Route path="publicaciones"   element={<PublicationsPage />} />
            <Route path="reportes"        element={<ReportsPage />} />
            <Route path="finanzas"        element={<FinancesPage />} />
            <Route path="metas"           element={<GoalsPage />} />
            <Route path="configuracion"   element={<SettingsPage />} />
            <Route path="garantias"       element={<WarrantiesPage />} />
            <Route path="comprobantes"    element={<PaymentProofPage />} />
            <Route path="recordatorios"      element={<RecordatoriosPage />} />
            <Route path="gastos"             element={<ExpensesPage />} />
            <Route path="cambiar-contrasena" element={<ChangePasswordPage />} />
            <Route path="*"                  element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
