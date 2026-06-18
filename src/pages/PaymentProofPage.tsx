import { useState, useRef } from 'react';
import {
  FileImage, CheckCircle2, XCircle, Clock, Plus, Search, Eye,
  Upload, Camera, Sparkles, AlertTriangle, User as UserIcon,
} from 'lucide-react';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, formatDate } from '../utils/formatters';
import { extractPaymentData, compressImageToBase64 } from '../utils/ocr';
import type { PaymentProof, PaymentProofStatus } from '../types';

const HAS_AI = !!(import.meta.env.VITE_ANTHROPIC_KEY as string | undefined);

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
  duplicado:          'bg-gray-100 text-gray-500',
};

const STATUS_ICON = {
  pendiente_revision: Clock,
  confirmado:         CheckCircle2,
  rechazado:          XCircle,
  duplicado:          FileImage,
};

// ─── Formulario de registro / edición ─────────────────────────────────────────

function ProofForm({
  initial,
  onSave,
}: {
  initial?: Partial<PaymentProof>;
  onSave:  (p: Omit<PaymentProof, 'id' | 'createdAt'>) => void;
}) {
  const { clients, paymentProofs } = useAppStore();

  const [clientId,   setClientId]   = useState(initial?.clientId ?? '');
  const [amount,     setAmount]     = useState(initial?.amount ?? 0);
  const [date,       setDate]       = useState(
    initial?.date ? initial.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [bank,       setBank]       = useState(initial?.bank ?? '');
  const [reference,  setReference]  = useState(initial?.reference ?? '');
  const [senderName, setSenderName] = useState(initial?.senderName ?? '');
  const [notes,      setNotes]      = useState(initial?.notes ?? '');

  // Imagen
  const [imagePreview, setImagePreview] = useState<string>('');   // data URL completo
  const [imageBase64,  setImageBase64]  = useState<string>('');   // solo la parte base64

  // Estado IA
  const [extracting,   setExtracting]   = useState(false);
  const [extractError, setExtractError] = useState('');
  const [confidence,   setConfidence]   = useState('');

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);

  // Detección de duplicado (misma referencia O mismo monto+fecha+cliente)
  const isDuplicate =
    !!(reference && paymentProofs.some(p =>
      p.id !== initial?.id &&
      p.reference?.trim() === reference.trim() &&
      p.status !== 'rechazado'
    )) ||
    !!(amount > 0 && date && clientId && paymentProofs.some(p =>
      p.id !== initial?.id &&
      p.amount === amount &&
      p.date?.slice(0, 10) === date &&
      p.clientId === clientId &&
      p.status !== 'rechazado'
    ));

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    // Preview inmediato
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string ?? '');
    reader.readAsDataURL(file);
    // Comprimir para IA
    try {
      const b64 = await compressImageToBase64(file);
      setImageBase64(b64);
    } catch {
      // sin IA si falla la compresión
    }
  };

  const handleAIExtract = async () => {
    if (!imageBase64) return;
    setExtracting(true);
    setExtractError('');
    setConfidence('');
    const result = await extractPaymentData(imageBase64);
    setExtracting(false);
    if (!result) {
      setExtractError('No se pudo leer el comprobante. Verifica que la imagen sea clara o ingresa los datos manualmente.');
      return;
    }
    if (result.amount)     setAmount(result.amount);
    if (result.date)       setDate(result.date);
    if (result.bank)       setBank(result.bank);
    if (result.reference)  setReference(result.reference);
    if (result.senderName) setSenderName(result.senderName);
    if (result.notes)      setNotes(prev => prev || result.notes || '');
    setConfidence(result.confidence);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      clientId:    clientId   || undefined,
      orderIds:    undefined,
      amount:      amount     || undefined,
      date:        date ? new Date(date).toISOString() : undefined,
      bank:        bank.trim()       || undefined,
      reference:   reference.trim()  || undefined,
      senderName:  senderName.trim() || undefined,
      imageUrl:    undefined,
      rawText:     undefined,
      status:      'pendiente_revision',
      reviewedById: undefined,
      confirmedAt:     undefined,
      rejectionReason: undefined,
      notes:       notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Aviso de seguridad */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 flex gap-2">
        <Clock size={14} className="flex-shrink-0 mt-0.5" />
        <span>
          Todo comprobante queda como <strong>Pendiente de revisión</strong>.
          Solo Jennifer o el administrador puede confirmar el pago y actualizar la deuda.
        </span>
      </div>

      {/* Imagen */}
      <div className={`border-2 border-dashed rounded-xl p-4 transition-colors ${
        imagePreview ? 'border-primary-200 bg-primary-50/30' : 'border-gray-200'
      }`}>
        {imagePreview ? (
          <div className="space-y-3">
            <img
              src={imagePreview}
              alt="Comprobante"
              className="w-full max-h-52 object-contain rounded-lg bg-white shadow-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setImagePreview(''); setImageBase64(''); setConfidence(''); setExtractError(''); }}
                className="btn-ghost text-xs flex-1 justify-center text-red-500 hover:bg-red-50"
              >
                Quitar imagen
              </button>
              {HAS_AI && imageBase64 && (
                <button
                  type="button"
                  onClick={handleAIExtract}
                  disabled={extracting}
                  className="btn-primary text-xs flex-1 justify-center disabled:opacity-60"
                >
                  <Sparkles size={12} />
                  {extracting ? 'Analizando...' : 'Analizar con IA'}
                </button>
              )}
              {!HAS_AI && (
                <p className="text-xs text-gray-400 self-center">
                  Ingresa los datos manualmente
                </p>
              )}
            </div>
            {confidence && (
              <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 ${
                confidence === 'alta'  ? 'bg-emerald-50 text-emerald-700' :
                confidence === 'media' ? 'bg-amber-50   text-amber-700' :
                                         'bg-red-50     text-red-700'
              }`}>
                <Sparkles size={11} />
                Confianza: <strong>{confidence}</strong>
                {confidence !== 'alta' && ' — Verifica los datos extraídos antes de guardar'}
              </div>
            )}
            {extractError && (
              <div className="text-xs bg-red-50 text-red-600 px-3 py-2 rounded-lg">{extractError}</div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-3 py-2">
            <FileImage size={32} className="mx-auto text-gray-300" />
            <p className="text-sm text-gray-500">Adjunta el pantallazo del comprobante</p>
            <div className="flex gap-2 justify-center">
              <button type="button" onClick={() => galleryRef.current?.click()}
                className="btn-ghost text-sm">
                <Upload size={14} /> Desde galería
              </button>
              <button type="button" onClick={() => cameraRef.current?.click()}
                className="btn-ghost text-sm">
                <Camera size={14} /> Cámara
              </button>
            </div>
            <p className="text-[11px] text-gray-400">Opcional — puedes guardar sin imagen</p>
          </div>
        )}
        <input ref={galleryRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e.target.files?.[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => handleFile(e.target.files?.[0])} />
      </div>

      {/* Aviso de duplicado */}
      {isDuplicate && (
        <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-orange-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-700">
            <strong>Posible duplicado detectado:</strong> ya existe un comprobante con la misma
            referencia, monto, fecha y cliente que no ha sido rechazado.
            Verifica antes de guardar.
          </p>
        </div>
      )}

      {/* Campos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Cliente</label>
          <select className="input-field" value={clientId}
            onChange={e => setClientId(e.target.value)}>
            <option value="">Seleccionar cliente...</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

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
          <label className="label">Banco / Billetera</label>
          <input className="input-field" value={bank}
            onChange={e => setBank(e.target.value)}
            placeholder="Nequi, Bancolombia..." />
        </div>
        <div>
          <label className="label">Nombre del remitente</label>
          <input className="input-field" value={senderName}
            onChange={e => setSenderName(e.target.value)}
            placeholder="Nombre completo" />
        </div>

        <div className="col-span-2">
          <label className="label">Referencia / Nro. transacción</label>
          <input className="input-field" value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="Número de referencia o aprobación..." />
        </div>

        <div className="col-span-2">
          <label className="label">Notas</label>
          <textarea className="input-field resize-none" rows={2} value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Observaciones adicionales..." />
        </div>
      </div>

      <button type="submit" className="btn-primary w-full justify-center">
        Guardar como pendiente de revisión
      </button>
    </form>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export function PaymentProofPage() {
  const {
    paymentProofs, clients, users,
    addPaymentProof, updatePaymentProof, deletePaymentProof,
    confirmPaymentProof, rejectPaymentProof,
  } = useAppStore();
  const { can } = usePermissions();

  const [search,      setSearch]    = useState('');
  const [filterStatus, setFilter]  = useState<PaymentProofStatus | 'all'>('all');
  const [modalOpen,   setModalOpen] = useState(false);
  const [editing,     setEditing]   = useState<PaymentProof | null>(null);
  const [deleting,    setDeleting]  = useState<PaymentProof | null>(null);
  const [viewImage,   setViewImage] = useState('');

  // Flujo de confirmación
  const [confirming, setConfirming] = useState<PaymentProof | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Flujo de rechazo
  const [rejecting,     setRejecting]     = useState<PaymentProof | null>(null);
  const [rejectReason,  setRejectReason]  = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // Flujo de marcar duplicado
  const [duplicating, setDuplicating] = useState<PaymentProof | null>(null);

  const filtered = paymentProofs.filter(p => {
    const client = clients.find(c => c.id === p.clientId);
    const matchSearch =
      (client?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.senderName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.reference  ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pendingCount   = paymentProofs.filter(p => p.status === 'pendiente_revision').length;
  const confirmedCount = paymentProofs.filter(p => p.status === 'confirmado').length;

  const handleSave = (data: Omit<PaymentProof, 'id' | 'createdAt'>) => {
    if (editing) {
      updatePaymentProof(editing.id, data);
    } else {
      addPaymentProof(data);
    }
    setModalOpen(false);
    setEditing(null);
  };

  const handleConfirm = async () => {
    if (!confirming) return;
    setConfirmLoading(true);
    await confirmPaymentProof(confirming.id);
    setConfirmLoading(false);
    setConfirming(null);
  };

  const handleReject = async () => {
    if (!rejecting) return;
    setRejectLoading(true);
    await rejectPaymentProof(rejecting.id, rejectReason);
    setRejectLoading(false);
    setRejecting(null);
    setRejectReason('');
  };

  const handleMarkDuplicate = async () => {
    if (!duplicating) return;
    await updatePaymentProof(duplicating.id, { status: 'duplicado' });
    setDuplicating(null);
  };

  const canConfirm = can('comprobantes', 'confirmar_comprobante') || can('comprobantes', 'crear');
  const canReject  = can('comprobantes', 'rechazar_comprobante')  || can('comprobantes', 'crear');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Comprobantes de pago</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pendingCount > 0
              ? <>{pendingCount} por revisar · {confirmedCount} confirmados</>
              : <>{confirmedCount} confirmados · al día</>
            }
          </p>
        </div>
        {can('comprobantes', 'crear') && (
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="btn-primary"
          >
            <Plus size={16} /> Registrar
          </button>
        )}
      </div>

      {/* Banner de pendientes */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <Clock size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">
              {pendingCount} comprobante{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de revisión
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Revisa y confirma para registrar el pago y actualizar la deuda del cliente.
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card !p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="input-field pl-9"
            placeholder="Buscar por cliente, remitente o referencia..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(['all', 'pendiente_revision', 'confirmado', 'rechazado', 'duplicado'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                filterStatus === s
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'Todos' : STATUS_LABEL[s]}
              {s === 'pendiente_revision' && pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileImage}
          title="Sin comprobantes"
          description={
            filterStatus !== 'all'
              ? `No hay comprobantes con estado "${STATUS_LABEL[filterStatus as PaymentProofStatus]}"`
              : 'Registra comprobantes de pago recibidos por WhatsApp'
          }
          action={
            can('comprobantes', 'crear') ? (
              <button onClick={() => setModalOpen(true)} className="btn-primary">
                <Plus size={14} /> Registrar comprobante
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(proof => {
            const client     = clients.find(c => c.id === proof.clientId);
            const reviewer   = users.find(u => u.id === proof.reviewedById);
            const Icon       = STATUS_ICON[proof.status];
            const isPending  = proof.status === 'pendiente_revision';

            return (
              <div
                key={proof.id}
                className={`card !p-0 overflow-hidden transition-shadow hover:shadow-md ${
                  isPending ? 'border-amber-200' : ''
                }`}
              >
                {/* Barra de estado superior */}
                {isPending && (
                  <div className="h-1 bg-amber-400 w-full" />
                )}

                <div className="p-4 space-y-3">
                  {/* Fila principal */}
                  <div className="flex items-start gap-3">
                    {/* Icono */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      proof.status === 'confirmado'         ? 'bg-emerald-50' :
                      proof.status === 'rechazado'          ? 'bg-red-50' :
                      proof.status === 'pendiente_revision' ? 'bg-amber-50' : 'bg-gray-100'
                    }`}>
                      <Icon size={16} className={
                        proof.status === 'confirmado'         ? 'text-emerald-600' :
                        proof.status === 'rechazado'          ? 'text-red-500' :
                        proof.status === 'pendiente_revision' ? 'text-amber-600' : 'text-gray-500'
                      } />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-gray-900">
                          {proof.amount ? formatCurrency(proof.amount) : '$ —'}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[proof.status]}`}>
                          {STATUS_LABEL[proof.status]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <UserIcon size={10} className="inline mr-1" />
                        {client?.name ?? 'Sin cliente asignar'}
                        {proof.date && <> · {formatDate(proof.date)}</>}
                        {proof.bank && <> · {proof.bank}</>}
                      </p>
                      {proof.senderName && (
                        <p className="text-xs text-gray-400 mt-0.5">Remitente: {proof.senderName}</p>
                      )}
                      {proof.reference && (
                        <p className="text-xs text-gray-400 font-mono">Ref: {proof.reference}</p>
                      )}
                      {proof.notes && (
                        <p className="text-xs text-gray-400 italic mt-0.5">{proof.notes}</p>
                      )}
                      {proof.status === 'rechazado' && proof.rejectionReason && (
                        <p className="text-xs text-red-500 mt-0.5">Motivo: {proof.rejectionReason}</p>
                      )}
                      {proof.status !== 'pendiente_revision' && reviewer && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {proof.status === 'confirmado' ? 'Confirmado' : 'Revisado'} por {reviewer.name}
                          {proof.confirmedAt && <> · {formatDate(proof.confirmedAt)}</>}
                        </p>
                      )}
                    </div>

                    {/* Acciones secundarias */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {proof.imageUrl && (
                        <button
                          onClick={() => setViewImage(proof.imageUrl!)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                          title="Ver imagen"
                        >
                          <Eye size={13} />
                        </button>
                      )}
                      {isPending && can('comprobantes', 'crear') && (
                        <button
                          onClick={() => { setEditing(proof); setModalOpen(true); }}
                          className="text-xs px-2 py-1 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          Editar
                        </button>
                      )}
                      {can('comprobantes', 'eliminar') && (
                        <button
                          onClick={() => setDeleting(proof)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition-colors"
                          title="Eliminar"
                        >
                          <XCircle size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Botones de acción para pendientes */}
                  {isPending && (
                    <div className="flex gap-2 pt-1 border-t border-gray-100">
                      {canConfirm && (
                        <button
                          onClick={() => setConfirming(proof)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                        >
                          <CheckCircle2 size={13} /> Confirmar pago
                        </button>
                      )}
                      {canReject && (
                        <button
                          onClick={() => { setRejecting(proof); setRejectReason(''); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
                        >
                          <XCircle size={13} /> Rechazar
                        </button>
                      )}
                      {canConfirm && (
                        <button
                          onClick={() => setDuplicating(proof)}
                          className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-gray-100 text-gray-500 text-xs font-medium hover:bg-gray-200 transition-colors"
                          title="Marcar como duplicado"
                        >
                          <FileImage size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Registrar / Editar */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? 'Editar comprobante' : 'Registrar comprobante'}
        size="lg"
      >
        <ProofForm initial={editing ?? undefined} onSave={handleSave} />
      </Modal>

      {/* Modal: Ver imagen */}
      <Modal isOpen={!!viewImage} onClose={() => setViewImage('')} title="Imagen del comprobante" size="lg">
        <img src={viewImage} alt="Comprobante" className="w-full rounded-xl" />
      </Modal>

      {/* Confirmar pago */}
      <Modal
        isOpen={!!confirming}
        onClose={() => setConfirming(null)}
        title="Confirmar pago"
        size="sm"
      >
        {confirming && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-1">
              <p className="text-sm font-bold text-emerald-800">
                {confirming.amount ? formatCurrency(confirming.amount) : '$ —'}
              </p>
              <p className="text-xs text-emerald-600">
                {clients.find(c => c.id === confirming.clientId)?.name ?? 'Sin cliente'}
                {confirming.bank && <> · {confirming.bank}</>}
              </p>
              {confirming.reference && (
                <p className="text-xs text-emerald-600 font-mono">Ref: {confirming.reference}</p>
              )}
            </div>
            <p className="text-sm text-gray-600">
              Al confirmar, se registrará el pago y se distribuirá automáticamente
              entre los pedidos pendientes del cliente (del más antiguo al más reciente).
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(null)}
                className="btn-ghost flex-1 justify-center"
                disabled={confirmLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirmLoading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {confirmLoading ? 'Confirmando...' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Rechazar comprobante */}
      <Modal
        isOpen={!!rejecting}
        onClose={() => { setRejecting(null); setRejectReason(''); }}
        title="Rechazar comprobante"
        size="sm"
      >
        {rejecting && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Indica el motivo del rechazo para que quede registrado:
            </p>
            <textarea
              className="input-field resize-none w-full"
              rows={3}
              placeholder="Ej: Imagen borrosa, monto no coincide, transferencia no recibida..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setRejecting(null); setRejectReason(''); }}
                className="btn-ghost flex-1 justify-center"
                disabled={rejectLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={rejectLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {rejectLoading ? 'Rechazando...' : 'Rechazar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Marcar como duplicado */}
      <ConfirmDialog
        isOpen={!!duplicating}
        onClose={() => setDuplicating(null)}
        onConfirm={handleMarkDuplicate}
        title="Marcar como duplicado"
        message="¿Este comprobante ya fue registrado anteriormente? Se marcará como duplicado y no afectará la deuda del cliente."
        confirmLabel="Marcar duplicado"
        danger
      />

      {/* Eliminar */}
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
