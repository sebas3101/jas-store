import { useState } from 'react';
import { ShieldCheck, Plus, Search, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate } from '../utils/formatters';
import type { Warranty, WarrantyType, WarrantyStatus } from '../types';

const WARRANTY_TYPE_LABEL: Record<WarrantyType, string> = {
  imperfecto:      'Imperfecto en la prenda',
  cambio_talla:    'Cambio de talla',
  cambio_producto: 'Cambio de producto',
  otro:            'Otro',
};

const WARRANTY_STATUS_LABEL: Record<WarrantyStatus, string> = {
  solicitada:   'Solicitada',
  en_revision:  'En revisión',
  aprobada:     'Aprobada',
  rechazada:    'Rechazada',
  en_cambio:    'En cambio',
  solucionada:  'Solucionada',
  cancelada:    'Cancelada',
};

const WARRANTY_STATUS_COLOR: Record<WarrantyStatus, string> = {
  solicitada:   'bg-blue-50 text-blue-700',
  en_revision:  'bg-amber-50 text-amber-700',
  aprobada:     'bg-green-50 text-green-700',
  rechazada:    'bg-red-50 text-red-700',
  en_cambio:    'bg-purple-50 text-purple-700',
  solucionada:  'bg-emerald-50 text-emerald-700',
  cancelada:    'bg-gray-50 text-gray-500',
};

const WARRANTY_TYPES: WarrantyType[] = ['imperfecto', 'cambio_talla', 'cambio_producto', 'otro'];
const WARRANTY_STATUSES: WarrantyStatus[] = [
  'solicitada', 'en_revision', 'aprobada', 'rechazada', 'en_cambio', 'solucionada', 'cancelada',
];

function WarrantyForm({
  initial,
  onSave,
  defaultOrderId,
}: {
  initial?: Partial<Warranty>;
  onSave: (w: Omit<Warranty, 'id' | 'createdAt' | 'updatedAt'>) => void;
  defaultOrderId?: string;
}) {
  const { orders, clients, suppliers } = useAppStore();

  // Solo pedidos entregados
  const deliveredOrders = orders.filter(o => o.status === 'entregado' || o.status === 'pagado' || o.status === 'pendiente_pago');

  const [orderId, setOrderId]         = useState(initial?.orderId ?? defaultOrderId ?? '');
  const [warrantyType, setType]       = useState<WarrantyType>(initial?.warrantyType ?? 'imperfecto');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus]           = useState<WarrantyStatus>(initial?.status ?? 'solicitada');
  const [supplierId, setSupplierId]   = useState(initial?.supplierId ?? '');
  const [newProductName, setNewProduct] = useState(initial?.newProductName ?? '');
  const [newSize, setNewSize]         = useState(initial?.newSize ?? '');
  const [requestDate, setRequestDate] = useState(
    initial?.requestDate ? initial.requestDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [resolvedDate, setResolvedDate] = useState(initial?.resolvedDate?.slice(0, 10) ?? '');
  const [notes, setNotes]             = useState(initial?.notes ?? '');

  const selectedOrder = orders.find(o => o.id === orderId);
  const clientId      = selectedOrder?.clientId ?? initial?.clientId ?? '';
  const productName   = selectedOrder?.items[0]?.productName ?? initial?.productName ?? '';
  const originalSize  = selectedOrder?.items[0]?.size ?? initial?.originalSize ?? '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !clientId) return;
    onSave({
      orderId,
      clientId,
      productName,
      originalSize:   originalSize || undefined,
      warrantyType,
      description,
      status,
      supplierId:     supplierId || undefined,
      newProductName: newProductName.trim() || undefined,
      newSize:        newSize.trim() || undefined,
      requestDate:    new Date(requestDate).toISOString(),
      resolvedDate:   resolvedDate ? new Date(resolvedDate).toISOString() : undefined,
      notes:          notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Pedido entregado *</label>
          <select className="input-field" required value={orderId}
            onChange={e => setOrderId(e.target.value)}>
            <option value="">Seleccionar pedido...</option>
            {deliveredOrders.map(o => {
              const c = clients.find(c => c.id === o.clientId);
              return (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} — {c?.name ?? '?'} — {o.items[0]?.productName ?? ''}
                </option>
              );
            })}
          </select>
          {selectedOrder && (
            <p className="text-xs text-gray-500 mt-1">
              Producto: <strong>{productName}</strong>
              {originalSize && ` · Talla: ${originalSize}`}
            </p>
          )}
        </div>

        <div className="col-span-2">
          <label className="label">Tipo de garantía *</label>
          <select className="input-field" required value={warrantyType}
            onChange={e => setType(e.target.value as WarrantyType)}>
            {WARRANTY_TYPES.map(t => (
              <option key={t} value={t}>{WARRANTY_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className="label">Descripción del problema *</label>
          <textarea className="input-field resize-none" rows={2} required
            value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Describe el defecto o motivo de garantía..." />
        </div>

        <div>
          <label className="label">Estado</label>
          <select className="input-field" value={status}
            onChange={e => setStatus(e.target.value as WarrantyStatus)}>
            {WARRANTY_STATUSES.map(s => (
              <option key={s} value={s}>{WARRANTY_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Fecha solicitud</label>
          <input type="date" className="input-field" value={requestDate}
            onChange={e => setRequestDate(e.target.value)} />
        </div>

        {(warrantyType === 'cambio_producto' || warrantyType === 'cambio_talla') && (
          <>
            <div>
              <label className="label">Nueva talla</label>
              <input className="input-field" value={newSize}
                onChange={e => setNewSize(e.target.value)} placeholder="S, M, L, XL..." />
            </div>
            <div>
              <label className="label">Nuevo producto (si aplica)</label>
              <input className="input-field" value={newProductName}
                onChange={e => setNewProduct(e.target.value)} placeholder="Nombre del producto" />
            </div>
          </>
        )}

        <div className="col-span-2">
          <label className="label">Proveedor involucrado</label>
          <select className="input-field" value={supplierId}
            onChange={e => setSupplierId(e.target.value)}>
            <option value="">Sin proveedor / mismo proveedor</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {(status === 'solucionada' || status === 'rechazada') && (
          <div className="col-span-2">
            <label className="label">Fecha de solución</label>
            <input type="date" className="input-field" value={resolvedDate}
              onChange={e => setResolvedDate(e.target.value)} />
          </div>
        )}

        <div className="col-span-2">
          <label className="label">Observaciones</label>
          <textarea className="input-field resize-none" rows={2}
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Información adicional..." />
        </div>
      </div>
      <button type="submit" className="btn-primary w-full justify-center">
        Guardar garantía
      </button>
    </form>
  );
}

export function WarrantiesPage() {
  const { warranties, addWarranty, updateWarranty, deleteWarranty, orders, clients } = useAppStore();
  const { can } = usePermissions();
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilter]   = useState<WarrantyStatus | 'all'>('all');
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<Warranty | null>(null);
  const [deleting, setDeleting]     = useState<Warranty | null>(null);

  const filtered = warranties.filter(w => {
    const order  = orders.find(o => o.id === w.orderId);
    const client = clients.find(c => c.id === w.clientId);
    const matchSearch = w.productName.toLowerCase().includes(search.toLowerCase()) ||
      (client?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (order?.orderNumber ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || w.status === filterStatus;
    return matchSearch && matchStatus;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleSave = (data: Omit<Warranty, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing) {
      updateWarranty(editing.id, data);
    } else {
      addWarranty(data);
    }
    setModalOpen(false);
    setEditing(null);
  };

  const activeCount    = warranties.filter(w => !['solucionada','cancelada','rechazada'].includes(w.status)).length;
  const solvedCount    = warranties.filter(w => w.status === 'solucionada').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Garantías</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCount} activa{activeCount !== 1 ? 's' : ''} · {solvedCount} solucionada{solvedCount !== 1 ? 's' : ''}
          </p>
        </div>
        {can('garantias', 'crear') && (
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary">
            <Plus size={16} /> Nueva garantía
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card !p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input-field pl-9" placeholder="Buscar por producto, cliente o pedido..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              filterStatus === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Todas
          </button>
          {WARRANTY_STATUSES.map(s => (
            <button key={s}
              onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                filterStatus === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {WARRANTY_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Sin garantías"
          description="Las garantías se registran desde pedidos entregados"
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <Plus size={14} /> Registrar garantía
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(w => {
            const order  = orders.find(o => o.id === w.orderId);
            const client = clients.find(c => c.id === w.clientId);
            return (
              <div key={w.id} className="card !p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    w.status === 'solucionada' ? 'bg-emerald-50' : 'bg-amber-50'
                  }`}>
                    {w.status === 'solucionada'
                      ? <CheckCircle2 size={14} className="text-emerald-600" />
                      : <ShieldCheck size={14} className="text-amber-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{w.productName}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${WARRANTY_STATUS_COLOR[w.status]}`}>
                        {WARRANTY_STATUS_LABEL[w.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {client?.name ?? '—'} · {order?.orderNumber ?? '—'} · {formatDate(w.requestDate)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {WARRANTY_TYPE_LABEL[w.warrantyType]}
                      {w.originalSize && ` · Talla orig.: ${w.originalSize}`}
                      {w.newSize && ` → ${w.newSize}`}
                    </p>
                    {w.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{w.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {can('garantias', 'editar') && (
                      <button
                        onClick={() => { setEditing(w); setModalOpen(true); }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                    {can('garantias', 'eliminar') && (
                      <button
                        onClick={() => setDeleting(w)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? 'Editar garantía' : 'Nueva garantía'}
        size="lg"
      >
        <WarrantyForm initial={editing ?? undefined} onSave={handleSave} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) deleteWarranty(deleting.id); setDeleting(null); }}
        title="Eliminar garantía"
        message="¿Eliminar esta garantía? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
