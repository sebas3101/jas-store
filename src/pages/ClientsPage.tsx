import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Phone, Users, ArrowRight, AlertTriangle, Download, Upload, MessageCircle } from 'lucide-react';
import { exportClientes } from '../utils/exportExcel';
import { differenceInDays, parseISO } from 'date-fns';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import {
  clientStatusLabel,
  clientStatusColor,
  formatCurrency,
} from '../utils/formatters';
import { buildDebtReminderMessage, openWhatsApp } from '../utils/whatsapp';
import type { Client, ClientStatus } from '../types';

const PER_PAGE = 20;

const STATUSES: { value: ClientStatus | 'all'; label: string }[] = [
  { value: 'all',           label: 'Todos'       },
  { value: 'al_dia',        label: 'Al día'      },
  { value: 'pendiente',     label: 'Pendiente'   },
  { value: 'mora',          label: 'En mora'     },
  { value: 'credito_cerrado', label: 'Crédito cerrado' },
];

const STATUS_AVATAR: Record<ClientStatus, { bg: string; text: string; dot: string }> = {
  al_dia:          { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-400' },
  pendiente:       { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400'   },
  mora:            { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500'     },
  credito_cerrado: { bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400'    },
};

function ClientForm({
  initial,
  onSave,
  existingClients = [],
}: {
  initial?: Partial<Client>;
  onSave: (c: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => void;
  existingClients?: Client[];
}) {
  const isEditing = !!initial?.id;
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

  const normalizedPhone = form.phone.replace(/[\s\-()]/g, '');
  const phoneDuplicate = existingClients.find(
    c => c.id !== initial?.id && c.phone?.replace(/[\s\-()]/g, '') === normalizedPhone && normalizedPhone.length >= 7
  );

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (!phoneDuplicate) onSave(form); }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Nombre completo *</label>
          <input className="input-field" required value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="Ej: María García" />
        </div>
        <div className={isEditing ? '' : 'col-span-2'}>
          <label className="label">Celular *</label>
          <input type="tel" inputMode="numeric" required value={form.phone}
            onChange={e => set('phone', e.target.value)} placeholder="3101234567"
            className={`input-field ${phoneDuplicate ? 'border-red-400 focus:ring-red-300' : ''}`} />
          {phoneDuplicate && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertTriangle size={11} /> Este número ya pertenece a <span className="font-semibold">{phoneDuplicate.name}</span>
            </p>
          )}
        </div>
        {/* Estado solo visible al editar — al crear se calcula automáticamente */}
        {isEditing && (
          <div>
            <label className="label">Estado</label>
            <select className="input-field" value={form.status}
              onChange={e => set('status', e.target.value)}>
              {STATUSES.filter(s => s.value !== 'all').map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
        {!isEditing && (
          <div className="col-span-2 bg-emerald-50 rounded-xl px-3 py-2 text-xs text-emerald-700 font-medium">
            ✓ El estado se calculará automáticamente según los pedidos y abonos del cliente.
          </div>
        )}
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
          <CurrencyInput value={form.creditLimit ?? 0} min={0}
            onChange={v => set('creditLimit', v)} />
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
      <button type="submit" disabled={!!phoneDuplicate} className="btn-primary w-full justify-center">
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
  const { clients, addClient, updateClient, orders, payments, getClientDebt } = useAppStore();
  const { can, isAdmin } = usePermissions();
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState<ClientStatus | 'all'>('all');
  const [filterType, setFilterType]   = useState<'all' | 'internal' | 'external'>('all');
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<Client | null>(null);
  const [showAllCartera, setShowAllCartera] = useState(false);
  const [page, setPage]               = useState(1);

  useEffect(() => { setPage(1); }, [search, filterStatus, filterType]);

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
        <div className="flex gap-2">
          <button onClick={() => exportClientes(clients, orders, [])} className="btn-ghost" type="button">
            <Download size={15} /> Excel
          </button>
          {isAdmin && (
            <Link to="/clientes/importar" className="btn-ghost">
              <Upload size={15} /> Importar
            </Link>
          )}
          {can('clientes', 'crear') && (
            <button
              onClick={() => { setEditing(null); setModalOpen(true); }}
              className="btn-primary"
             type="button">
              <Plus size={16} /> Nuevo cliente
            </button>
          )}
        </div>
      </div>

      {/* Cartera vencida */}
      {carteraVencida.length > 0 && (() => {
        const totalCartera = carteraVencida.reduce((s, x) => s + x.debt, 0);
        const mayorDeuda   = carteraVencida[0];
        const masAntigua   = [...carteraVencida].sort((a, b) => b.days - a.days)[0];
        const visible      = showAllCartera ? carteraVencida : carteraVencida.slice(0, 5);
        return (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-3">
            {/* Encabezado */}
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              <h2 className="text-sm font-bold text-gray-900 flex-1 min-w-0">Cartera vencida</h2>
            </div>

            {/* Resumen en 2 columnas */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-red-50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-red-400 font-medium">Total vencido</p>
                <p className="text-sm font-bold text-red-700 mt-0.5">{formatCurrency(totalCartera)}</p>
              </div>
              <div className="bg-red-50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-red-400 font-medium">Clientes en mora</p>
                <p className="text-sm font-bold text-red-700 mt-0.5">{carteraVencida.length} cliente{carteraVencida.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="bg-orange-50 rounded-xl px-3 py-2 col-span-2 sm:col-span-1">
                <p className="text-[10px] text-orange-400 font-medium">Mayor deuda</p>
                <p className="text-xs font-bold text-orange-700 truncate mt-0.5">{mayorDeuda.client.name}</p>
                <p className="text-[10px] text-orange-500">{formatCurrency(mayorDeuda.debt)}</p>
              </div>
              <div className="bg-orange-50 rounded-xl px-3 py-2 col-span-2 sm:col-span-1">
                <p className="text-[10px] text-orange-400 font-medium">Más antigua</p>
                <p className="text-xs font-bold text-orange-700 truncate mt-0.5">{masAntigua.client.name}</p>
                <p className="text-[10px] text-orange-500">{masAntigua.days} días sin pagar</p>
              </div>
            </div>

            {/* Lista top 5 */}
            <div className="space-y-1.5">
              {visible.map(({ client, debt, days }) => {
                const sev = debtSeverity(days);
                return (
                  <Link
                    key={client.id}
                    to={`/clientes/${client.id}`}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 hover:brightness-95 transition-all ${sev.bg}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 bg-white bg-opacity-60 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className={`text-[10px] font-bold ${sev.text}`}>{client.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${sev.text}`}>{client.name}</p>
                        <p className={`text-[10px] ${sev.text} opacity-75`}>{sev.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-xs font-bold ${sev.text}`}>{formatCurrency(debt)}</span>
                      <ArrowRight size={11} className={sev.text} />
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Ver todos / Ver menos */}
            {carteraVencida.length > 5 && (
              <button
                onClick={() => setShowAllCartera(v => !v)}
                className="w-full text-xs text-red-600 font-semibold py-1.5 rounded-xl hover:bg-red-50 transition-colors"
               type="button">
                {showAllCartera ? 'Ver menos ↑' : `Ver todos (${carteraVencida.length}) ↓`}
              </button>
            )}
          </div>
        );
      })()}

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3.5 text-gray-400" />
          <input
            className="input-field pl-9"
            placeholder="Buscar por nombre o celular..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* Estado — scrollable horizontal */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`text-xs px-3 py-2 rounded-full font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                filterStatus === s.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
             type="button">
              {s.label}
            </button>
          ))}
        </div>
        {/* Tipo */}
        <div className="flex gap-2">
          {['all','external','internal'].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t as typeof filterType)}
              className={`text-xs px-3 py-2 rounded-full font-medium flex-1 transition-colors ${
                filterType === t
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
             type="button">
              {t === 'all' ? 'Todos' : t === 'internal' ? 'Internos' : 'Externos'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay clientes"
          description="Agrega el primer cliente para comenzar"
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary" type="button">
              <Plus size={14} /> Agregar cliente
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(client => {
            const debt = getClientDebt(client.id);
            const clientOrders = orders.filter(o => o.clientId === client.id);
            return (
              <div key={client.id} className="card !p-3 sm:!p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  {/* Avatar con color por estado */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${STATUS_AVATAR[client.status].bg}`}>
                      <span className={`font-bold text-sm ${STATUS_AVATAR[client.status].text}`}>
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${STATUS_AVATAR[client.status].dot}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm truncate">{client.name}</p>
                      <span className={clientStatusColor[client.status] + ' text-[10px]'}>
                        {clientStatusLabel[client.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Phone size={9} /> {client.phone}
                      </span>
                      <span>{clientOrders.length} pedido{clientOrders.length !== 1 ? 's' : ''}</span>
                    </div>
                    {/* Deuda — visible siempre en móvil */}
                    <div className="mt-1">
                      {debt > 0 ? (
                        <span className="text-xs font-bold text-red-600">{formatCurrency(debt)} pendiente</span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600">Al día ✓</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {client.phone && (
                      <button
                        onClick={() => {
                          const msg = debt > 0
                            ? buildDebtReminderMessage(client, debt, orders, payments.filter(p => p.clientId === client.id))
                            : '';
                          openWhatsApp(client.phone, msg);
                        }}
                        className="p-2 hover:bg-green-50 text-green-400 hover:text-green-600 rounded-xl transition-colors"
                        title={debt > 0 ? 'Enviar recordatorio de deuda' : 'WhatsApp'}
                        type="button"
                      >
                        <MessageCircle size={15} />
                      </button>
                    )}
                    {can('clientes', 'editar') && (
                      <button
                        onClick={() => { setEditing(client); setModalOpen(true); }}
                        className="text-xs text-gray-500 hover:text-gray-800 px-2 py-2 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                       type="button">
                        Editar
                      </button>
                    )}
                    <Link to={`/clientes/${client.id}`}
                      className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors">
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Pagination total={filtered.length} page={page} perPage={PER_PAGE} onChange={setPage} />

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
      >
        <ClientForm
          initial={editing ?? undefined}
          onSave={handleSave}
          existingClients={clients}
        />
      </Modal>
    </div>
  );
}
