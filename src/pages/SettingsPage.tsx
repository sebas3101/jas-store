import { useState } from 'react';
import { Plus, Trash2, Shield, Edit2, Key, UserCheck, UserX, CheckSquare, Square } from 'lucide-react';
import { useAppStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { roleLabel } from '../utils/formatters';
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
          <label className="label">Correo *</label>
          <input type="email" className="input-field" required value={form.email}
            onChange={e => set('email', e.target.value)} />
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
      className={`w-8 h-4 rounded-full transition-colors flex items-center ${
        value ? 'bg-primary-500' : 'bg-gray-200'
      }`}
    >
      <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${
        value ? 'translate-x-4' : 'translate-x-0'
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
    <div className={`space-y-2 ${compact ? 'max-h-72 overflow-y-auto pr-1' : ''}`}>
      {ALL_MODULES.map(mod => {
        const actions = MODULE_ACTIONS[mod];
        const modPerms = perms[mod] ?? {};
        const allOn = actions.every(a => modPerms[a.action]);
        return (
          <div key={mod} className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => toggleModule(mod, allOn)}
                  className="text-gray-400 hover:text-primary-600">
                  {allOn ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
                <span className="text-xs font-semibold text-gray-700">{MODULE_LABELS[mod]}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {actions.map(({ action, label }) => (
                <label key={action}
                  className="flex items-center gap-1.5 cursor-pointer">
                  <Toggle
                    value={modPerms[action] ?? false}
                    onChange={val => setAction(mod, action, val)}
                  />
                  <span className="text-[11px] text-gray-600">{label}</span>
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
  const { users, currentUser, addUser, updateUser, deleteUser } = useAppStore();
  const { can, isAdmin } = usePermissions();

  const [modalOpen, setModal]       = useState(false);
  const [editing, setEditing]       = useState<UserType | null>(null);
  const [deleting, setDeleting]     = useState<UserType | null>(null);
  const [permUser, setPermUser]     = useState<UserType | null>(null);

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
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Activar/desactivar */}
                {can('configuracion', 'editar') && user.id !== currentUser?.id && (
                  <button
                    title={user.active ? 'Desactivar usuario' : 'Activar usuario'}
                    onClick={() => handleToggleActive(user)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      user.active
                        ? 'hover:bg-amber-50 text-gray-400 hover:text-amber-500'
                        : 'hover:bg-emerald-50 text-gray-400 hover:text-emerald-500'
                    }`}
                  >
                    {user.active ? <UserX size={13} /> : <UserCheck size={13} />}
                  </button>
                )}
                {/* Administrar accesos */}
                {can('configuracion', 'administrar_accesos') && (
                  <button
                    title="Administrar accesos"
                    onClick={() => setPermUser(user)}
                    className="p-1.5 hover:bg-violet-50 rounded-lg text-gray-400 hover:text-violet-600"
                  >
                    <Key size={13} />
                  </button>
                )}
                {/* Editar */}
                {can('configuracion', 'editar') && (
                  <button
                    title="Editar usuario"
                    onClick={() => { setEditing(user); setModal(true); }}
                    className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-gray-600"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
                {/* Eliminar */}
                {can('configuracion', 'eliminar') && user.id !== currentUser?.id && (
                  <button
                    title="Eliminar usuario"
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

      {/* Leyenda de acciones */}
      <div className="card !p-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">Leyenda de acciones</p>
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><UserX size={12} className="text-amber-500" /> Desactivar sin borrar historial</span>
          <span className="flex items-center gap-1"><UserCheck size={12} className="text-emerald-500" /> Reactivar usuario</span>
          <span className="flex items-center gap-1"><Key size={12} className="text-violet-600" /> Administrar accesos por módulo</span>
          <span className="flex items-center gap-1"><Edit2 size={12} className="text-gray-500" /> Editar datos del usuario</span>
        </div>
      </div>

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
    </div>
  );
}
