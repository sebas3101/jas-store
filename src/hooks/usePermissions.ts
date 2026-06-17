import { useAppStore } from '../store';
import type { UserRole } from '../types';

// Rutas permitidas por rol. La ruta '/' (dashboard) es accesible para todos.
// Las rutas de detalle (/clientes/:id, /pedidos/:id) heredan el permiso
// de su ruta base (/clientes, /pedidos).
const ROUTE_ACCESS: Record<UserRole, string[]> = {
  admin:    ['/', '/clientes', '/pedidos', '/pagos', '/productos', '/proveedores',
             '/entregas', '/publicaciones', '/reportes', '/configuracion'],
  jennifer: ['/', '/clientes', '/pedidos', '/pagos', '/entregas', '/publicaciones'],
  alexis:   ['/', '/pedidos', '/entregas'],
  vendedor: ['/', '/productos', '/pedidos', '/publicaciones'],
  consulta: ['/', '/reportes'],
};

export interface NavItem {
  to: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
}

export function usePermissions() {
  const currentUser = useAppStore(s => s.currentUser);
  const role: UserRole = currentUser?.role ?? 'consulta';
  const allowedRoutes = ROUTE_ACCESS[role] ?? ['/'];

  /** Devuelve true si el rol puede acceder a la ruta dada (base path). */
  const canAccess = (basePath: string): boolean => allowedRoutes.includes(basePath);

  /** Filtra un array de ítems de navegación dejando solo los accesibles. */
  const filterNavItems = <T extends { to: string }>(items: T[]): T[] =>
    items.filter(item => canAccess(item.to));

  return { role, allowedRoutes, canAccess, filterNavItems };
}
