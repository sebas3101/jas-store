import { useState } from 'react';
import { Plus, Trash2, Shield, Edit2, Key, UserCheck, UserX, CheckSquare, Square, RotateCcw, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useAppStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { roleLabel, formatDate } from '../utils/formatters';
import { usePermissions, PERMISSION_TEMPLATES, MODULE_ACTIONS, MODULE_LABELS, ALL_MODULES } from '../hooks/usePermissions';
import type { User as UserType, UserRole, UserPermissions, PermModule, PermAction } from '../types';
import logoUrl from '../assets/logo.jpeg';

const ROLES: UserRole[] = ['admin', 'jennifer', 'alexis', 'vendedor', 'consulta'];

const ROLE_COLORS: Record<UserRole, string> = {
  admin:    'bg-primary-50 text-primary-700',
  jennifer: 'bg-pink-50 text-pink-700',
  alexis:   'bg-blue-50 text-blue-700',
  vendedor: 'bg-emerald-50 text-emerald-700',
  consulta: 'bg-gray-100 text-gray-600',
};

// ─── Formulario de usuario ────────────────────────────────────────────────────

function UserForm({
  initial,
  onSave,
}: {
  initial?: Partial<UserType>;
  onSave: (u: Omit<UserType, 'id' | 'createdAt'>) => void;
}) {
  const [form, setForm] = useState<Omit<UserType, 'id' | 'createdAt'>>({
    name:        initial?.name ?? '',
    email:       initial?.email ?? '',
    password:    initial?.password ?? '',
    role:        initial?.role ?? 'vendedor',
    phone:       initial?.phone ?? '',
    active:      initial?.active ?? true,
    permissions: initial?.permissions ?? PERMISSION_TEMPLATES['vendedor'],
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const applyTemplate = (role: string) => {
    const tpl = PERMISSION_TEMPLATES[role];
    if (tpl) setForm(f => ({ ...f, permissions: JSON.parse(JSON.stringify(tpl)) }));
  };

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Nombre completo *</label>
          <input className="input-field" required value={form.name}
            onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label className="label">Usuario *</label>
          <input type="text" className="input-field" required value={form.email}
            onChange={e => {
              const v = e.target.value.trim();
              set('email', v.includes('@') ? v : v ? `${v}@jasstore.co` : '');
            }}
            placeholder="ej: maria → maria@jasstore.co"
            autoCapitalize="none" autoCorrect="off" />
          {form.email && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              Correo: {form.email}
            </p>
          )}
        </div>
        <div>
          <label className="label">Contraseña *</label>
          <input type="password" className="input-field" required={!initial?.id}
            value={form.password} onChange={e => set('password', e.target.value)}
            placeholder={initial?.id ? 'Dejar vacío para no cambiar' : ''} />
        </div>
        <div>
          <label className="label">Teléfono</label>
          <input className="input-field" value={form.phone ?? ''}
            onChange={e => set('phone', e.target.value)} />
        </div>
        <div>
          <label className="label">Rol de referencia</label>
          <select className="input-field" value={form.role}
            onChange={e => set('role', e.target.value as UserRole)}>
            {ROLES.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active}
              onChange={e => set('active', e.target.checked)}
              className="w-4 h-4 rounded accent-primary-600" />
            <span className="text-sm text-gray-700 font-medium">Usuario activo</span>
          </label>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">Accesos por módulo</p>
          <div className="flex gap-1 flex-wrap">
            {['jennifer','alexis','vendedor','admin'].map(t => (
              <button key={t} type="button" onClick={() => applyTemplate(t)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-500 font-medium">
                {t}
              </button>
            ))}
          </div>
        </div>
        <PermissionsMatrix
          perms={form.permissions ?? {}}
          onChange={p => set('permissions', p)}
          compact
        />
      </div>

      <button type="submit" className="btn-primary w-full justify-center">
        Guardar usuario
      </button>
    </form>
  );
}

// ─── Matriz de permisos ───────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-checked={value}
      role="switch"
      className={`w-11 h-6 rounded-full transition-colors flex items-center flex-shrink-0 ${
        value ? 'bg-primary-500' : 'bg-gray-200'
      }`}
    >
      <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mx-0.5 ${
        value ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  );
}

function PermissionsMatrix({
  perms,
  onChange,
  compact = false,
}: {
  perms: UserPermissions;
  onChange: (p: UserPermissions) => void;
  compact?: boolean;
}) {
  const setAction = (mod: PermModule, action: PermAction, val: boolean) => {
    onChange({
      ...perms,
      [mod]: { ...(perms[mod] ?? {}), [action]: val },
    });
  };

  const toggleModule = (mod: PermModule, allOn: boolean) => {
    const actions = MODULE_ACTIONS[mod];
    const patch: Record<string, boolean> = {};
    actions.forEach(a => { patch[a.action] = !allOn; });
    onChange({ ...perms, [mod]: patch });
  };

  return (
    <div className={`space-y-2 ${compact ? 'max-h-80 overflow-y-auto pr-1' : ''}`}>
      {ALL_MODULES.map(mod => {
        const actions = MODULE_ACTIONS[mod];
        const modPerms = perms[mod] ?? {};
        const allOn = actions.every(a => modPerms[a.action]);
        const someOn = actions.some(a => modPerms[a.action]);
        return (
          <div key={mod} className={`rounded-xl border transition-colors ${allOn ? 'bg-primary-50 border-primary-100' : someOn ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
            {/* Módulo header — toca para activar/desactivar todo */}
            <button
              type="button"
              onClick={() => toggleModule(mod, allOn)}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                {allOn
                  ? <CheckSquare size={15} className="text-primary-600 flex-shrink-0" />
                  : someOn
                    ? <Square size={15} className="text-amber-500 flex-shrink-0" />
                    : <Square size={15} className="text-gray-300 flex-shrink-0" />}
                <span className="text-xs font-bold text-gray-800">{MODULE_LABELS[mod]}</span>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                allOn ? 'bg-primary-100 text-primary-700' : someOn ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
              }`}>
                {allOn ? 'Todo activo' : someOn ? `${actions.filter(a => modPerms[a.action]).length}/${actions.length}` : 'Sin acceso'}
              </span>
            </button>
            {/* Acciones — siempre visibles */}
            <div className="flex flex-wrap gap-2 px-3 pb-3">
              {actions.map(({ action, label }) => (
                <label key={action}
                  className="flex items-center gap-2 cursor-pointer bg-white rounded-lg px-2 py-1.5 border border-gray-100 select-none">
                  <Toggle
                    value={modPerms[action] ?? false}
                    onChange={val => setAction(mod, action, val)}
                  />
                  <span className="text-[11px] font-medium text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal de solo permisos ───────────────────────────────────────────────────

function PermissionsModal({
  user,
  onSave,
  onClose,
}: {
  user: UserType;
  onSave: (perms: UserPermissions) => void;
  onClose: () => void;
}) {
  const [perms, setPerms] = useState<UserPermissions>(
    user.permissions ?? PERMISSION_TEMPLATES['vendedor'] ?? {}
  );

  const applyTemplate = (key: string) => {
    const tpl = PERMISSION_TEMPLATES[key];
    if (tpl) setPerms(JSON.parse(JSON.stringify(tpl)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Plantilla:</span>
        {['admin','jennifer','alexis','vendedor','consulta'].map(t => (
          <button key={t} type="button" onClick={() => applyTemplate(t)}
            className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-600 font-medium">
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <PermissionsMatrix perms={perms} onChange={setPerms} />
      <div className="flex gap-2 pt-2 border-t">
        <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
        <button onClick={() => { onSave(perms); onClose(); }} className="btn-primary flex-1 justify-center">
          Guardar accesos
        </button>
      </div>
    </div>
  );
}

// ─── Página principal de Configuración ───────────────────────────────────────

export function SettingsPage() {
  const { users, currentUser, addUser, updateUser, deleteUser,
    clients, orders, payments, products, suppliers, purchases, expenses, warranties } = useAppStore();
  const { can, isAdmin } = usePermissions();

  const [modalOpen,    setModal]    = useState(false);
  const [editing,      setEditing]  = useState<UserType | null>(null);
  const [deleting,     setDeleting] = useState<UserType | null>(null);
  const [permUser,     setPermUser] = useState<UserType | null>(null);
  const [resetUser,    setResetUser]= useState<UserType | null>(null);
  const [tempPwd,      setTempPwd]  = useState('');
  const [resetDone,    setResetDone]= useState(false);

  // Solo admins o usuarios con administrar_accesos llegan aquí
  if (!isAdmin && !can('configuracion', 'ver')) {
    return (
      <div className="text-center py-20">
        <Shield size={40} className="text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Acceso restringido</p>
        <p className="text-sm text-gray-400 mt-1">Solo el administrador puede ver esta sección</p>
      </div>
    );
  }

  const handleSave = (data: Omit<UserType, 'id' | 'createdAt'>) => {
    if (editing) {
      // Si la contraseña quedó vacía, no cambiarla
      const update: Partial<UserType> = { ...data };
      if (!update.password) delete update.password;
      updateUser(editing.id, update);
    } else {
      addUser(data);
    }
    setModal(false);
    setEditing(null);
  };

  const handleSavePerms = (userId: string, perms: UserPermissions) => {
    updateUser(userId, { permissions: perms });
  };

  const handleToggleActive = (user: UserType) => {
    updateUser(user.id, { active: !user.active });
  };

  const handleResetPassword = async () => {
    if (!resetUser || !tempPwd) return;
    await updateUser(resetUser.id, { password: tempPwd, requirePasswordChange: true });
    setResetDone(true);
  };

  const handleBackup = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const label = format(new Date(), 'yyyy-MM-dd');

    // Clientes
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['ID', 'Nombre', 'Teléfono', 'Dirección', 'Estado', 'Notas', 'Creado'],
      ...clients.map(c => [c.id, c.name, c.phone ?? '', c.address ?? '', c.status, c.notes ?? '', formatDate(c.createdAt)]),
    ]), 'Clientes');

    // Pedidos
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Número', 'Fecha', 'Cliente ID', 'Total', 'Pagado', 'Pendiente', 'Estado', 'Método Pago', 'Notas'],
      ...orders.map(o => [o.orderNumber, formatDate(o.orderDate), o.clientId, o.totalAmount, o.amountPaid, o.totalAmount - o.amountPaid, o.status, o.paymentMethod, o.notes ?? '']),
    ]), 'Pedidos');

    // Pagos
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Fecha', 'Cliente ID', 'Monto', 'Método', 'Notas'],
      ...payments.map(p => [formatDate(p.date), p.clientId, p.amount, p.method, p.notes ?? '']),
    ]), 'Pagos');

    // Productos
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['ID', 'Nombre', 'Categoría', 'Precio venta', 'Precio costo', 'Estado', 'Color', 'Talla'],
      ...products.map(p => [p.id, p.name, p.category, p.salePrice, p.costPrice, p.status, p.color ?? '', p.size ?? '']),
    ]), 'Productos');

    // Proveedores
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['ID', 'Nombre', 'Teléfono', 'Dirección', 'Notas'],
      ...suppliers.map(s => [s.id, s.name, s.phone ?? '', s.address ?? '', s.notes ?? '']),
    ]), 'Proveedores');

    // Compras
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Fecha', 'Descripción', 'Costo', 'Estado'],
      ...(purchases ?? []).map(p => [formatDate(p.purchaseDate), p.description, p.cost, p.status]),
    ]), 'Compras');

    // Gastos
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Fecha', 'Tipo', 'Descripción', 'Responsable', 'Método', 'Valor', 'Observaciones'],
      ...(expenses ?? []).map(e => [formatDate(e.date), e.type, e.description ?? '', e.responsible ?? '', e.paymentMethod, e.amount, e.notes ?? '']),
    ]), 'Gastos');

    // Garantías
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Fecha solicitud', 'Cliente ID', 'Producto', 'Descripción', 'Estado'],
      ...(warranties ?? []).map(w => [formatDate(w.requestDate), w.clientId, w.productName, w.description ?? '', w.status]),
    ]), 'Garantías');

    XLSX.writeFile(wb, `JAS-Backup-${label}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="text-sm text-gray-500 mt-0.5">Usuarios y gestión de accesos</p>
        </div>
        {can('configuracion', 'crear') && (
          <button onClick={() => { setEditing(null); setModal(true); }} className="btn-primary">
            <Plus size={16} /> Nuevo usuario
          </button>
        )}
      </div>

      {/* Tarjeta de la tienda */}
      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <img src={logoUrl} alt="JAS Store" className="w-16 h-16 rounded-2xl object-cover shadow-md" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">JAS Store</h2>
            <p className="text-sm text-gray-500">Tienda virtual de ropa, lociones y cosméticos</p>
            <p className="text-xs text-gray-400 mt-0.5">Sistema de Gestión Comercial v1.3.0</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Usuarios activos</p>
            <p className="font-bold text-gray-900">{users.filter(u => u.active).length}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Sesión actual</p>
            <p className="font-bold text-gray-900">{currentUser?.name}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Rol</p>
            <p className="font-bold text-primary-700">{roleLabel[currentUser?.role ?? 'consulta']}</p>
          </div>
        </div>
      </div>

      {/* Lista de usuarios */}
      <div className="card">
        <h2 className="section-title mb-4">Usuarios del sistema</h2>
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-opacity ${
                user.active ? 'bg-gray-50' : 'bg-gray-50 opacity-55'
              }`}
            >
              {/* Avatar */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                user.active ? 'bg-primary-100' : 'bg-gray-200'
              }`}>
                <span className={`font-bold text-sm ${user.active ? 'text-primary-700' : 'text-gray-400'}`}>
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[user.role]}`}>
                    {roleLabel[user.role]}
                  </span>
                  {!user.active && (
                    <span className="text-[10px] text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">Inactivo</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {/* Activar/desactivar */}
                {can('configuracion', 'editar') && user.id !== currentUser?.id && (
                  <button
                    aria-label={user.active ? 'Desactivar usuario' : 'Activar usuario'}
                    onClick={() => handleToggleActive(user)}
                    className={`p-1.5 rounded-xl transition-colors ${
                      user.active
                        ? 'hover:bg-amber-50 text-gray-400 hover:text-amber-500'
                        : 'hover:bg-emerald-50 text-gray-400 hover:text-emerald-500'
                    }`}
                  >
                    {user.active ? <UserX size={15} /> : <UserCheck size={15} />}
                  </button>
                )}
                {/* Restablecer contraseña */}
                {can('configuracion', 'editar') && user.id !== currentUser?.id && (
                  <button
                    aria-label="Restablecer contraseña"
                    onClick={() => { setResetUser(user); setTempPwd(''); setResetDone(false); }}
                    className="p-1.5 hover:bg-amber-50 rounded-xl text-gray-400 hover:text-amber-600 transition-colors"
                    title="Restablecer contraseña"
                  >
                    <RotateCcw size={15} />
                  </button>
                )}
                {/* Administrar accesos */}
                {can('configuracion', 'administrar_accesos') && (
                  <button
                    aria-label="Administrar accesos"
                    onClick={() => setPermUser(user)}
                    className="p-1.5 hover:bg-violet-50 rounded-xl text-gray-400 hover:text-violet-600 transition-colors"
                  >
                    <Key size={15} />
                  </button>
                )}
                {/* Editar */}
                {can('configuracion', 'editar') && (
                  <button
                    aria-label="Editar usuario"
                    onClick={() => { setEditing(user); setModal(true); }}
                    className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Edit2 size={15} />
                  </button>
                )}
                {/* Eliminar */}
                {can('configuracion', 'eliminar') && user.id !== currentUser?.id && (
                  <button
                    aria-label="Eliminar usuario"
                    onClick={() => setDeleting(user)}
                    className="p-1.5 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leyenda de acciones */}
      <div className="card !p-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">Leyenda de acciones</p>
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><UserX size={12} className="text-amber-500" /> Desactivar sin borrar historial</span>
          <span className="flex items-center gap-1"><UserCheck size={12} className="text-emerald-500" /> Reactivar usuario</span>
          <span className="flex items-center gap-1"><RotateCcw size={12} className="text-amber-500" /> Restablecer contraseña (fuerza cambio)</span>
          <span className="flex items-center gap-1"><Key size={12} className="text-violet-600" /> Administrar accesos por módulo</span>
          <span className="flex items-center gap-1"><Edit2 size={12} className="text-gray-500" /> Editar datos del usuario</span>
        </div>
      </div>

      {/* Backup completo */}
      {isAdmin && (
        <div className="card !p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-gray-800">Backup completo</p>
            <p className="text-xs text-gray-400 mt-0.5">Exporta todos los datos del sistema a Excel (clientes, pedidos, pagos, productos, compras, gastos, garantías)</p>
          </div>
          <button onClick={handleBackup} className="btn-ghost flex-shrink-0">
            <Download size={15} /> Exportar backup
          </button>
        </div>
      )}

      {/* Modal crear/editar usuario */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModal(false); setEditing(null); }}
        title={editing ? `Editar: ${editing.name}` : 'Nuevo usuario'}
      >
        <UserForm initial={editing ?? undefined} onSave={handleSave} />
      </Modal>

      {/* Modal de permisos */}
      <Modal
        isOpen={!!permUser}
        onClose={() => setPermUser(null)}
        title={`Accesos — ${permUser?.name}`}
      >
        {permUser && (
          <PermissionsModal
            user={permUser}
            onSave={perms => handleSavePerms(permUser.id, perms)}
            onClose={() => setPermUser(null)}
          />
        )}
      </Modal>

      {/* Confirmar eliminar */}
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) deleteUser(deleting.id); setDeleting(null); }}
        title="Eliminar usuario"
        message={`¿Eliminar a "${deleting?.name}"? Sus pedidos, pagos y registros se conservarán. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
      />

      {/* Modal restablecer contraseña */}
      <Modal
        isOpen={!!resetUser}
        onClose={() => { setResetUser(null); setResetDone(false); setTempPwd(''); }}
        title={`Restablecer contraseña — ${resetUser?.name}`}
      >
        {resetDone ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
              <Key size={24} className="text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-gray-800">Contraseña restablecida</p>
            <p className="text-xs text-gray-500">
              La nueva contraseña temporal es: <span className="font-bold text-gray-900">{tempPwd}</span>
            </p>
            <p className="text-xs text-amber-600">El usuario deberá cambiarla en el próximo inicio de sesión.</p>
            <button
              onClick={() => { setResetUser(null); setResetDone(false); setTempPwd(''); }}
              className="btn-primary w-full justify-center"
            >
              Listo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Define una contraseña temporal para <strong>{resetUser?.name}</strong>. Al iniciar sesión,
              el usuario será obligado a cambiarla.
            </p>
            <div>
              <label className="label">Contraseña temporal *</label>
              <input
                type="text"
                className="input-field"
                value={tempPwd}
                onChange={e => setTempPwd(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setResetUser(null); setTempPwd(''); }}
                className="btn-ghost flex-1 justify-center"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetPassword}
                disabled={tempPwd.length < 6}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                Restablecer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
