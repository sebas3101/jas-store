import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Phone, Building2, Users, ArrowRight, AlertTriangle } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import {
  clientStatusLabel,
  clientStatusColor,
  formatCurrency,
} from '../utils/formatters';
import type { Client, ClientStatus } from '../types';

const STATUSES: { value: ClientStatus | 'all'; label: string }[] = [
  { value: 'all',           label: 'Todos'       },
  { value: 'al_dia',        label: 'Al día'      },
  { value: 'pendiente',     label: 'Pendiente'   },
  { value: 'mora',          label: 'En mora'     },
  { value: 'credito_cerrado', label: 'Crédito cerrado' },
];

const INDICATOR: Record<ClientStatus, string> = {
  al_dia:         'bg-emerald-400',
  pendiente:      'bg-amber-400',
  mora:           'bg-red-500',
  credito_cerrado: 'bg-gray-400',
};

function ClientForm({
  initial,
  onSave,
}: {
  initial?: Partial<Client>;
  onSave: (c: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [form, setForm] = useState<Omit<Client, 'id' | 'createdAt' | 'updatedAt'>>({
    name:        initial?.name ?? '',
    phone:       initial?.phone ?? '',
    address:     initial?.address ?? '',
    company:     initial?.company ?? '',
    reference:   initial?.reference ?? '',
    status:      initial?.status ?? 'al_dia',
    isInternal:  initial?.isInternal ?? false,
    notes:       initial?.notes ?? '',
    creditLimit: initial?.creditLimit ?? 200000,
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSave(form); }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Nombre completo *</label>
          <input className="input-field" required value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="Ej: María García" />
        </div>
        <div>
          <label className="label">Celular *</label>
          <input className="input-field" required value={form.phone}
            onChange={e => set('phone', e.target.value)} placeholder="3101234567" />
        </div>
        <div>
          <label className="label">Estado</label>
          <select className="input-field" value={form.status}
            onChange={e => set('status', e.target.value)}>
            {STATUSES.filter(s => s.value !== 'all').map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Dirección</label>
          <input className="input-field" value={form.address ?? ''}
            onChange={e => set('address', e.target.value)} placeholder="Calle / Carrera..." />
        </div>
        <div>
          <label className="label">Empresa / Referencia</label>
          <input className="input-field" value={form.company ?? ''}
            onChange={e => set('company', e.target.value)} placeholder="Empresa u origen" />
        </div>
        <div>
          <label className="label">Límite de crédito ($)</label>
          <input className="input-field" type="number" value={form.creditLimit ?? 0}
            onChange={e => set('creditLimit', Number(e.target.value))} />
        </div>
        <div className="col-span-2">
          <label className="label">Notas</label>
          <textarea className="input-field resize-none" rows={2} value={form.notes ?? ''}
            onChange={e => set('notes', e.target.value)} placeholder="Información adicional..." />
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isInternal}
              onChange={e => set('isInternal', e.target.checked)}
              className="w-4 h-4 rounded accent-primary-600" />
            <span className="text-sm text-gray-700 font-medium">Cliente interno (empresa)</span>
          </label>
        </div>
      </div>
      <button type="submit" className="btn-primary w-full justify-center">
        Guardar cliente
      </button>
    </form>
  );
}

// Severity: days since oldest unpaid order date
function debtSeverity(daysOverdue: number): { label: string; bg: string; text: string } {
  if (daysOverdue <= 15) return { label: '1-15 días', bg: 'bg-yellow-50', text: 'text-yellow-700' };
  if (daysOverdue <= 30) return { label: '16-30 días', bg: 'bg-orange-50', text: 'text-orange-700' };
  if (daysOverdue <= 60) return { label: '31-60 días', bg: 'bg-red-50', text: 'text-red-700' };
  return { label: '+60 días', bg: 'bg-red-100', text: 'text-red-900' };
}

export function ClientsPage() {
  const { clients, addClient, updateClient, orders, getClientDebt } = useAppStore();
  const { can } = usePermissions();
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState<ClientStatus | 'all'>('all');
  const [filterType, setFilterType]   = useState<'all' | 'internal' | 'external'>('all');
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<Client | null>(null);

  // Cartera vencida: clientes con deuda > 0 y al menos un pedido con más de 15 días sin pagar
  const today = new Date();
  const carteraVencida = clients
    .map(c => {
      const debt = getClientDebt(c.id);
      if (debt <= 0) return null;
      const oldestUnpaid = orders
        .filter(o => o.clientId === c.id && o.status !== 'pagado' && o.status !== 'cancelado')
        .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime())[0];
      if (!oldestUnpaid) return null;
      const days = differenceInDays(today, parseISO(oldestUnpaid.orderDate));
      if (days < 1) return null;
      return { client: c, debt, days };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.days - a.days);

  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchType   = filterType === 'all' ||
      (filterType === 'internal' && c.isInternal) ||
      (filterType === 'external' && !c.isInternal);
    return matchSearch && matchStatus && matchType;
  });

  const handleSave = (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing) {
      updateClient(editing.id, data);
    } else {
      addClient(data);
    }
    setModalOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clients.length} clientes registrados</p>
        </div>
        {can('clientes', 'crear') && (
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="btn-primary"
          >
            <Plus size={16} /> Nuevo cliente
          </button>
        )}
      </div>

      {/* Cartera vencida */}
      {carteraVencida.length > 0 && (
        <div className="card border-l-4 border-red-400 !p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
            <h2 className="text-sm font-bold text-gray-900">
              Cartera vencida — {carteraVencida.length} cliente{carteraVencida.length > 1 ? 's' : ''} con deuda activa
            </h2>
          </div>
          <div className="space-y-2">
            {carteraVencida.map(({ client, debt, days }) => {
              const sev = debtSeverity(days);
              return (
                <Link
                  key={client.id}
                  to={`/clientes/${client.id}`}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 hover:brightness-95 transition-all ${sev.bg}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 bg-white bg-opacity-60 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className={`text-xs font-bold ${sev.text}`}>
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${sev.text}`}>{client.name}</p>
                      <p className={`text-[10px] ${sev.text} opacity-75`}>{sev.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold ${sev.text}`}>{formatCurrency(debt)}</span>
                    <ArrowRight size={12} className={sev.text} />
                  </div>
                </Link>
              );
            })}
          </div>
          <p className={`text-[10px] text-gray-500 text-right`}>
            Total cartera: {formatCurrency(carteraVencida.reduce((s, x) => s + x.debt, 0))}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="input-field pl-9"
            placeholder="Buscar por nombre o celular..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                filterStatus === s.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            {['all','external','internal'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t as typeof filterType)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  filterType === t
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t === 'all' ? 'Todos' : t === 'internal' ? 'Internos' : 'Externos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay clientes"
          description="Agrega el primer cliente para comenzar"
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <Plus size={14} /> Agregar cliente
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(client => {
            const debt = getClientDebt(client.id);
            const clientOrders = orders.filter(o => o.clientId === client.id);
            return (
              <div key={client.id} className="card !p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                {/* Indicator */}
                <div className={`w-2 h-12 rounded-full flex-shrink-0 ${INDICATOR[client.status]}`} />

                {/* Avatar */}
                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-700 font-bold text-sm">
                    {client.name.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{client.name}</p>
                    <span className={clientStatusColor[client.status] + ' text-[10px]'}>
                      {clientStatusLabel[client.status]}
                    </span>
                    {client.isInternal && (
                      <span className="badge-blue text-[10px]">Interno</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Phone size={10} /> {client.phone}
                    </span>
                    {client.company && (
                      <span className="flex items-center gap-1 hidden sm:flex">
                        <Building2 size={10} /> {client.company}
                      </span>
                    )}
                    <span>{clientOrders.length} pedido{clientOrders.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Debt */}
                <div className="text-right hidden sm:block">
                  {debt > 0 ? (
                    <>
                      <p className="text-sm font-bold text-red-600">{formatCurrency(debt)}</p>
                      <p className="text-xs text-gray-400">Deuda</p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-emerald-600">Al día ✓</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {can('clientes', 'editar') && (
                    <button
                      onClick={() => { setEditing(client); setModalOpen(true); }}
                      className="btn-ghost text-xs !px-2 !py-1.5"
                    >
                      Editar
                    </button>
                  )}
                  <Link to={`/clientes/${client.id}`} className="btn-primary !px-2.5 !py-1.5">
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
      >
        <ClientForm
          initial={editing ?? undefined}
          onSave={handleSave}
        />
      </Modal>
    </div>
  );
}
