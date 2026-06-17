import { useAppStore } from '../store';
import type { PermModule, PermAction, UserPermissions, ModulePerms } from '../types';

// ─── Mapeo ruta → módulo ──────────────────────────────────────────────────────

const ROUTE_MODULE: Record<string, PermModule> = {
  '/':              'dashboard',
  '/clientes':      'clientes',
  '/pedidos':       'pedidos',
  '/pagos':         'pagos',
  '/productos':     'productos',
  '/proveedores':   'proveedores',
  '/entregas':      'entregas',
  '/publicaciones': 'publicaciones',
  '/reportes':      'reportes',
  '/configuracion': 'configuracion',
};

// ─── Plantillas de permisos ───────────────────────────────────────────────────

const FULL: ModulePerms = {
  ver: true, crear: true, editar: true, eliminar: true, exportar: true,
  registrar_pago: true, registrar_abono: true, ver_financiero: true,
  cambiar_estado: true, administrar_accesos: true,
};

export const PERMISSION_TEMPLATES: Record<string, UserPermissions> = {
  admin: {
    dashboard:    { ...FULL },
    clientes:     { ...FULL },
    pedidos:      { ...FULL },
    productos:    { ...FULL },
    publicaciones:{ ...FULL },
    pagos:        { ...FULL },
    proveedores:  { ...FULL },
    entregas:     { ...FULL },
    reportes:     { ...FULL },
    configuracion:{ ...FULL },
  },

  jennifer: {
    dashboard:    { ver: true },
    clientes:     { ver: true, crear: true, editar: true, ver_financiero: true },
    pedidos:      { ver: true, crear: true, editar: true, cambiar_estado: true },
    pagos:        { ver: true, registrar_pago: true, registrar_abono: true, ver_financiero: true },
    entregas:     { ver: true },
    publicaciones:{ ver: true, crear: true },
    reportes:     { ver: true },
    productos:    { ver: true },
  },

  alexis: {
    dashboard: { ver: true },
    pedidos:   { ver: true, cambiar_estado: true },
    entregas:  { ver: true, cambiar_estado: true },
  },

  vendedor: {
    dashboard:    { ver: true },
    productos:    { ver: true },
    pedidos:      { ver: true, crear: true },
    publicaciones:{ ver: true, crear: true },
  },

  consulta: {
    dashboard: { ver: true },
    reportes:  { ver: true },
  },
};

// ─── Definición de acciones por módulo (para la matriz de permisos) ──────────

export const MODULE_ACTIONS: Record<PermModule, { action: PermAction; label: string }[]> = {
  dashboard:    [{ action: 'ver', label: 'Ver' }],
  clientes:     [
    { action: 'ver',           label: 'Ver' },
    { action: 'crear',         label: 'Crear' },
    { action: 'editar',        label: 'Editar' },
    { action: 'eliminar',      label: 'Eliminar' },
    { action: 'ver_financiero',label: 'Ver deudas' },
  ],
  pedidos: [
    { action: 'ver',           label: 'Ver' },
    { action: 'crear',         label: 'Crear' },
    { action: 'editar',        label: 'Editar' },
    { action: 'eliminar',      label: 'Eliminar' },
    { action: 'cambiar_estado',label: 'Cambiar estado' },
  ],
  productos: [
    { action: 'ver',      label: 'Ver' },
    { action: 'crear',    label: 'Crear' },
    { action: 'editar',   label: 'Editar' },
    { action: 'eliminar', label: 'Eliminar' },
  ],
  publicaciones: [
    { action: 'ver',    label: 'Ver' },
    { action: 'crear',  label: 'Crear' },
    { action: 'editar', label: 'Editar' },
    { action: 'eliminar', label: 'Eliminar' },
  ],
  pagos: [
    { action: 'ver',             label: 'Ver' },
    { action: 'registrar_pago',  label: 'Registrar pago' },
    { action: 'registrar_abono', label: 'Registrar abono' },
    { action: 'eliminar',        label: 'Eliminar' },
    { action: 'ver_financiero',  label: 'Ver montos' },
  ],
  proveedores: [
    { action: 'ver',      label: 'Ver' },
    { action: 'crear',    label: 'Crear' },
    { action: 'editar',   label: 'Editar' },
    { action: 'eliminar', label: 'Eliminar' },
  ],
  entregas: [
    { action: 'ver',           label: 'Ver' },
    { action: 'cambiar_estado',label: 'Cambiar estado' },
  ],
  reportes: [
    { action: 'ver',            label: 'Ver' },
    { action: 'exportar',       label: 'Exportar' },
    { action: 'ver_financiero', label: 'Ver financiero' },
  ],
  configuracion: [
    { action: 'ver',                 label: 'Ver' },
    { action: 'crear',               label: 'Crear usuarios' },
    { action: 'editar',              label: 'Editar usuarios' },
    { action: 'eliminar',            label: 'Eliminar usuarios' },
    { action: 'administrar_accesos', label: 'Admin. accesos' },
  ],
};

export const MODULE_LABELS: Record<PermModule, string> = {
  dashboard:    'Inicio',
  clientes:     'Clientes',
  pedidos:      'Pedidos',
  productos:    'Productos',
  publicaciones:'Publicaciones',
  pagos:        'Pagos',
  proveedores:  'Proveedores',
  entregas:     'Entregas',
  reportes:     'Reportes',
  configuracion:'Configuración',
};

export const ALL_MODULES: PermModule[] = [
  'dashboard','clientes','pedidos','productos','publicaciones',
  'pagos','proveedores','entregas','reportes','configuracion',
];

// ─── Hook principal ───────────────────────────────────────────────────────────

export function usePermissions() {
  const currentUser = useAppStore(s => s.currentUser);
  const isAdmin = currentUser?.role === 'admin';
  const perms: UserPermissions = currentUser?.permissions ?? {};

  /**
   * Verifica si el usuario puede ejecutar una acción en un módulo.
   * Los administradores siempre tienen acceso completo.
   */
  const can = (module: PermModule, action: PermAction): boolean => {
    if (isAdmin) return true;
    return perms[module]?.[action] ?? false;
  };

  /**
   * Verifica si el usuario puede ver un módulo (basado en ruta base).
   * El dashboard siempre es visible para usuarios autenticados.
   */
  const canAccess = (basePath: string): boolean => {
    if (basePath === '/') return true; // dashboard siempre visible
    const mod = ROUTE_MODULE[basePath];
    if (!mod) return false;
    return can(mod, 'ver');
  };

  /** Filtra ítems de navegación según permisos activos. */
  const filterNavItems = <T extends { to: string }>(items: T[]): T[] =>
    items.filter(item => canAccess(item.to));

  return { can, canAccess, filterNavItems, isAdmin, perms };
}
