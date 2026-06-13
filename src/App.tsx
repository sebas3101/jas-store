import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store';
import { AppLayout } from './components/layout/AppLayout';
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

export default function App() {
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
