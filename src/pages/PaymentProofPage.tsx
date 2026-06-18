import { useState } from 'react';
import { FileImage, CheckCircle2, XCircle, Clock, Plus, Search, Eye } from 'lucide-react';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, formatDate } from '../utils/formatters';
import type { PaymentProof, PaymentProofStatus } from '../types';

const STATUS_LABEL: Record<PaymentProofStatus, string> = {
  pendiente_revision: 'Pendiente revisión',
  confirmado:         'Confirmado',
  rechazado:          'Rechazado',
  duplicado:          'Duplicado',
};

const STATUS_COLOR: Record<PaymentProofStatus, string> = {
  pendiente_revision: 'bg-amber-50 text-amber-700',
  confirmado:         'bg-emerald-50 text-emerald-700',
  rechazado:          'bg-red-50 text-red-700',
  duplicado:          'bg-gray-50 text-gray-600',
};

const STATUS_ICON = {
  pendiente_revision: Clock,
  confirmado:         CheckCircle2,
  rechazado:          XCircle,
  duplicado:          FileImage,
};

function ProofForm({
  initial,
  onSave,
}: {
  initial?: Partial<PaymentProof>;
  onSave: (p: Omit<PaymentProof, 'id' | 'createdAt'>) => void;
}) {
  const { clients, orders, currentUser } = useAppStore();

  const [clientId, setClientId]       = useState(initial?.clientId ?? '');
  const [amount, setAmount]           = useState(initial?.amount ?? 0);
  const [date, setDate]               = useState(
    initial?.date ? initial.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [bank, setBank]               = useState(initial?.bank ?? '');
  const [reference, setReference]     = useState(initial?.reference ?? '');
  const [senderName, setSenderName]   = useState(initial?.senderName ?? '');
  const [rawText, setRawText]         = useState(initial?.rawText ?? '');
  const [selectedOrderIds, setOrderIds] = useState<string[]>(initial?.orderIds ?? []);
  const [notes, setNotes]             = useState(initial?.notes ?? '');
  const [status, setStatus]           = useState<PaymentProofStatus>(
    initial?.status ?? 'pendiente_revision'
  );

  const clientOrders = clientId
    ? orders.filter(o =>
        o.clientId === clientId &&
        o.status !== 'pagado' &&
        o.status !== 'cancelado'
      )
    : [];

  const toggleOrder = (id: string) => {
    setOrderIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      clientId:     clientId   || undefined,
      orderIds:     selectedOrderIds.length > 0 ? selectedOrderIds : undefined,
      amount:       amount     || undefined,
      date:         date ? new Date(date).toISOString() : undefined,
      bank:         bank.trim()       || undefined,
      reference:    reference.trim()  || undefined,
      senderName:   senderName.trim() || undefined,
      rawText:      rawText.trim()    || undefined,
      status,
      reviewedById: status !== 'pendiente_revision' ? (currentUser?.id ?? undefined) : undefined,
      notes:        notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Aviso */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
        ⚠️ Todo pago detectado debe quedar como <strong>Pendiente de revisión</strong> hasta que
        sea confirmado manualmente por Jennifer o el administrador.
      </div>

      {/* Texto pegado del comprobante */}
      <div>
        <label className="label">Pegar texto del comprobante (opcional)</label>
        <textarea
          className="input-field resize-none text-xs font-mono"
          rows={4}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder="Pega aquí el texto copiado de WhatsApp o del comprobante bancario..."
        />
        <p className="text-[11px] text-gray-400 mt-1">
          El sistema no extrae datos automáticamente. Completa los campos a continuación.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Cliente</label>
          <select className="input-field" value={clientId}
            onChange={e => { setClientId(e.target.value); setOrderIds([]); }}>
            <option value="">Seleccionar cliente...</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {clientOrders.length > 0 && (
          <div className="col-span-2">
            <label className="label">Pedidos que cubre este pago</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {clientOrders.map(o => (
                <label key={o.id} className="flex items-center gap-2 cursor-pointer px-2 py-1.5 hover:bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.includes(o.id)}
                    onChange={() => toggleOrder(o.id)}
                    className="w-4 h-4 accent-primary-600"
                  />
                  <span className="text-xs text-gray-700">
                    {o.orderNumber} — Pendiente: {formatCurrency(o.totalAmount - o.amountPaid)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label">Valor del pago *</label>
          <CurrencyInput required value={amount} min={0} onChange={setAmount} />
        </div>
        <div>
          <label className="label">Fecha del pago</label>
          <input type="date" className="input-field" value={date}
            onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Nombre del remitente</label>
          <input className="input-field" value={senderName}
            onChange={e => setSenderName(e.target.value)} placeholder="Nombre en la transferencia" />
        </div>
        <div>
          <label className="label">Banco / Medio</label>
          <input className="input-field" value={bank}
            onChange={e => setBank(e.target.value)} placeholder="Nequi, Bancolombia..." />
        </div>
        <div className="col-span-2">
          <label className="label">Referencia / Número de transacción</label>
          <input className="input-field" value={reference}
            onChange={e => setReference(e.target.value)} placeholder="Número de referencia..." />
        </div>
        <div className="col-span-2">
          <label className="label">Estado de revisión</label>
          <select className="input-field" value={status}
            onChange={e => setStatus(e.target.value as PaymentProofStatus)}>
            <option value="pendiente_revision">Pendiente revisión</option>
            <option value="confirmado">Confirmado</option>
            <option value="rechazado">Rechazado</option>
            <option value="duplicado">Duplicado</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Notas</label>
          <textarea className="input-field resize-none" rows={2} value={notes}
            onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      <button type="submit" className="btn-primary w-full justify-center">
        Guardar comprobante
      </button>
    </form>
  );
}

export function PaymentProofPage() {
  const { paymentProofs, addPaymentProof, updatePaymentProof, deletePaymentProof, clients } = useAppStore();
  const { can } = usePermissions();
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState<PaymentProofStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<PaymentProof | null>(null);
  const [deleting, setDeleting]   = useState<PaymentProof | null>(null);
  const [viewRaw, setViewRaw]     = useState<PaymentProof | null>(null);

  const filtered = paymentProofs.filter(p => {
    const client = clients.find(c => c.id === p.clientId);
    const matchSearch =
      (client?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.senderName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.reference ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleSave = (data: Omit<PaymentProof, 'id' | 'createdAt'>) => {
    if (editing) {
      updatePaymentProof(editing.id, data);
    } else {
      addPaymentProof(data);
    }
    setModalOpen(false);
    setEditing(null);
  };

  const pendingCount  = paymentProofs.filter(p => p.status === 'pendiente_revision').length;
  const confirmedCount = paymentProofs.filter(p => p.status === 'confirmado').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Comprobantes de pago</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pendingCount} por revisar · {confirmedCount} confirmados
          </p>
        </div>
        {can('comprobantes', 'crear') && (
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary">
            <Plus size={16} /> Registrar
          </button>
        )}
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Clock size={16} className="text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">{pendingCount} comprobante{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de revisión</p>
            <p className="text-xs text-amber-600">Revisa y confirma antes de registrar los pagos.</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card !p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input-field pl-9" placeholder="Buscar por cliente, remitente o referencia..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(['all', 'pendiente_revision', 'confirmado', 'rechazado', 'duplicado'] as const).map(s => (
            <button key={s}
              onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                filterStatus === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {s === 'all' ? 'Todos' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileImage}
          title="Sin comprobantes"
          description="Registra comprobantes de pago recibidos por WhatsApp"
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <Plus size={14} /> Registrar comprobante
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(proof => {
            const client = clients.find(c => c.id === proof.clientId);
            const Icon   = STATUS_ICON[proof.status];
            return (
              <div key={proof.id} className="card !p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    proof.status === 'confirmado' ? 'bg-emerald-50' :
                    proof.status === 'rechazado'  ? 'bg-red-50' : 'bg-amber-50'
                  }`}>
                    <Icon size={14} className={
                      proof.status === 'confirmado' ? 'text-emerald-600' :
                      proof.status === 'rechazado'  ? 'text-red-600' : 'text-amber-600'
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">
                        {proof.amount ? formatCurrency(proof.amount) : '$ —'}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[proof.status]}`}>
                        {STATUS_LABEL[proof.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {client?.name ?? 'Sin cliente'} · {proof.date ? formatDate(proof.date) : '—'}
                      {proof.bank && ` · ${proof.bank}`}
                    </p>
                    {proof.senderName && (
                      <p className="text-xs text-gray-400">Remitente: {proof.senderName}</p>
                    )}
                    {proof.reference && (
                      <p className="text-xs text-gray-400">Ref: {proof.reference}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {proof.rawText && (
                      <button
                        onClick={() => setViewRaw(proof)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Eye size={13} />
                      </button>
                    )}
                    {can('comprobantes', 'crear') && (
                      <button
                        onClick={() => { setEditing(proof); setModalOpen(true); }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors text-xs font-medium"
                      >
                        Editar
                      </button>
                    )}
                    {can('comprobantes', 'eliminar') && (
                      <button
                        onClick={() => setDeleting(proof)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <XCircle size={13} />
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
        title={editing ? 'Editar comprobante' : 'Registrar comprobante'}
        size="lg"
      >
        <ProofForm initial={editing ?? undefined} onSave={handleSave} />
      </Modal>

      {/* Ver texto raw */}
      <Modal isOpen={!!viewRaw} onClose={() => setViewRaw(null)} title="Texto del comprobante" size="sm">
        <div className="bg-gray-50 rounded-xl p-3">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
            {viewRaw?.rawText}
          </pre>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) deletePaymentProof(deleting.id); setDeleting(null); }}
        title="Eliminar comprobante"
        message="¿Eliminar este comprobante? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
