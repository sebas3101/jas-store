import { useState } from 'react';
import { Plus, Trash2, Shield, Edit2 } from 'lucide-react';
import { useAppStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { roleLabel } from '../utils/formatters';
import type { User as UserType, UserRole } from '../types';
import logoUrl from '../assets/logo.jpeg';

const ROLES: UserRole[] = ['admin', 'jennifer', 'alexis', 'vendedor', 'consulta'];

const ROLE_COLORS: Record<UserRole, string> = {
  admin:    'bg-primary-50 text-primary-700',
  jennifer: 'bg-pink-50 text-pink-700',
  alexis:   'bg-blue-50 text-blue-700',
  vendedor: 'bg-emerald-50 text-emerald-700',
  consulta: 'bg-gray-100 text-gray-600',
};

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin:    ['Acceso total al sistema', 'Gestión de usuarios', 'Reportes completos'],
  jennifer: ['Clientes y pedidos', 'Abonos y deudas', 'Clientes internos', 'Pagos'],
  alexis:   ['Pedidos por recoger', 'Gestión de entregas', 'Actualizar estados'],
  vendedor: ['Productos y catálogo', 'Pedidos propios', 'Publicaciones'],
  consulta: ['Solo visualización', 'Sin acceso a edición'],
};

function UserForm({
  initial,
  onSave,
}: {
  initial?: Partial<UserType>;
  onSave: (u: Omit<UserType, 'id' | 'createdAt'>) => void;
}) {
  const [form, setForm] = useState<Omit<UserType, 'id' | 'createdAt'>>({
    name:     initial?.name ?? '',
    email:    initial?.email ?? '',
    password: initial?.password ?? '',
    role:     initial?.role ?? 'vendedor',
    phone:    initial?.phone ?? '',
    active:   initial?.active ?? true,
  });
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Nombre completo *</label>
          <input className="input-field" required value={form.name}
            onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label className="label">Correo *</label>
          <input type="email" className="input-field" required value={form.email}
            onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Contraseña *</label>
          <input type="password" className="input-field" required value={form.password}
            onChange={e => set('password', e.target.value)} />
        </div>
        <div>
          <label className="label">Teléfono</label>
          <input className="input-field" value={form.phone ?? ''}
            onChange={e => set('phone', e.target.value)} />
        </div>
        <div>
          <label className="label">Rol</label>
          <select className="input-field" value={form.role}
            onChange={e => set('role', e.target.value as UserRole)}>
            {ROLES.map(r => (
              <option key={r} value={r}>{roleLabel[r]}</option>
            ))}
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
      <button type="submit" className="btn-primary w-full justify-center">
        Guardar usuario
      </button>
    </form>
  );
}

export function SettingsPage() {
  const { users, currentUser, addUser, updateUser, deleteUser } = useAppStore();
  const [modalOpen, setModal]   = useState(false);
  const [editing, setEditing]   = useState<UserType | null>(null);
  const [deleting, setDeleting] = useState<UserType | null>(null);

  if (currentUser?.role !== 'admin') {
    return (
      <div className="text-center py-20">
        <Shield size={40} className="text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Acceso restringido</p>
        <p className="text-sm text-gray-400 mt-1">Solo el administrador puede ver esta sección</p>
      </div>
    );
  }

  const handleSave = (data: Omit<UserType, 'id' | 'createdAt'>) => {
    if (editing) { updateUser(editing.id, data); }
    else { addUser(data); }
    setModal(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de usuarios y permisos</p>
        </div>
        <button onClick={() => { setEditing(null); setModal(true); }} className="btn-primary">
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {/* Business info card */}
      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <img src={logoUrl} alt="JAS Store" className="w-16 h-16 rounded-2xl object-cover shadow-md" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">JAS Store</h2>
            <p className="text-sm text-gray-500">Tienda virtual de ropa, lociones y cosméticos</p>
            <p className="text-xs text-gray-400 mt-0.5">Sistema de Gestión Comercial v0.1.0</p>
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

      {/* Users */}
      <div className="card">
        <h2 className="section-title mb-4">Usuarios del sistema</h2>
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id} className={`flex items-center gap-3 p-3 rounded-xl ${
              user.active ? 'bg-gray-50' : 'bg-gray-50 opacity-60'
            }`}>
              <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-primary-700 font-bold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
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
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => { setEditing(user); setModal(true); }}
                  className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-gray-600"
                >
                  <Edit2 size={13} />
                </button>
                {user.id !== currentUser?.id && (
                  <button
                    onClick={() => setDeleting(user)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role permissions */}
      <div className="card">
        <h2 className="section-title mb-4">Permisos por rol</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ROLES.map(role => (
            <div key={role} className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLORS[role]}`}>
                  {roleLabel[role]}
                </span>
              </div>
              <ul className="space-y-0.5">
                {ROLE_PERMISSIONS[role].map(perm => (
                  <li key={perm} className="text-xs text-gray-600 flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-gray-400 rounded-full flex-shrink-0" />
                    {perm}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => { setModal(false); setEditing(null); }}
        title={editing ? 'Editar usuario' : 'Nuevo usuario'}>
        <UserForm initial={editing ?? undefined} onSave={handleSave} />
      </Modal>

      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) deleteUser(deleting.id); setDeleting(null); }}
        title="Eliminar usuario"
        message={`¿Eliminar al usuario "${deleting?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar" danger />
    </div>
  );
}
