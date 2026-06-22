import { useState } from 'react';
import { Plus, Store, Phone, Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import {
  formatCurrency,
  formatDate,
  supplierPurchaseStatusLabel,
  supplierPurchaseStatusColor,
} from '../utils/formatters';
import type { Supplier, SupplierPurchase, SupplierPurchaseStatus } from '../types';

function SupplierForm({ initial, onSave }: {
  initial?: Partial<Supplier>;
  onSave: (s: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [form, setForm] = useState({
    name:     initial?.name ?? '',
    phone:    initial?.phone ?? '',
    address:  initial?.address ?? '',
    products: initial?.products ?? '',
    notes:    initial?.notes ?? '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Nombre del proveedor *</label>
          <input className="input-field" required value={form.name}
            onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label className="label">Teléfono</label>
          <input className="input-field" value={form.phone}
            onChange={e => set('phone', e.target.value)} />
        </div>
        <div>
          <label className="label">Dirección</label>
          <input className="input-field" value={form.address}
            onChange={e => set('address', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Productos que ofrece</label>
          <input className="input-field" value={form.products}
            onChange={e => set('products', e.target.value)} placeholder="Ropa, lociones..." />
        </div>
        <div className="col-span-2">
          <label className="label">Notas</label>
          <textarea className="input-field resize-none" rows={2} value={form.notes}
            onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
      <button type="submit" className="btn-primary w-full justify-center">
        Guardar proveedor
      </button>
    </form>
  );
}

function PurchaseForm({ supplierId, onSave }: {
  supplierId: string;
  onSave: (p: Omit<SupplierPurchase, 'id' | 'createdAt'>) => void;
}) {
  const [form, setForm] = useState<Omit<SupplierPurchase, 'id' | 'createdAt'>>({
    supplierId,
    description:  '',
    cost:         0,
    status:       'pendiente',
    purchaseDate: new Date().toISOString().slice(0, 10),
    notes:        '',
  });
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ ...form, purchaseDate: new Date(form.purchaseDate).toISOString() }); }} className="space-y-4">
      <div>
        <label className="label">Descripción de la compra *</label>
        <textarea className="input-field resize-none" rows={2} required value={form.description}
          onChange={e => set('description', e.target.value)} placeholder="Ej: 10 conjuntos deportivos, 5 camisas..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Costo total ($) *</label>
          <CurrencyInput required min={0} value={form.cost} onChange={v => set('cost', v)} />
        </div>
        <div>
          <label className="label">Estado</label>
          <select className="input-field" value={form.status}
            onChange={e => set('status', e.target.value as SupplierPurchaseStatus)}>
            {(['pendiente','recogido','pagado','cancelado'] as SupplierPurchaseStatus[]).map(s => (
              <option key={s} value={s}>{supplierPurchaseStatusLabel[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Fecha compra</label>
          <input type="date" className="input-field" value={form.purchaseDate}
            onChange={e => set('purchaseDate', e.target.value)} />
        </div>
        <div>
          <label className="label">Notas</label>
          <input className="input-field" value={form.notes ?? ''}
            onChange={e => set('notes', e.target.value)} placeholder="Factura, referencia..." />
        </div>
      </div>
      <button type="submit" className="btn-primary w-full justify-center">
        Registrar compra
      </button>
    </form>
  );
}

export function SuppliersPage() {
  const { suppliers, purchases, addSupplier, updateSupplier, deleteSupplier, addPurchase, updatePurchase } = useAppStore();
  const { can } = usePermissions();
  const [modalOpen, setModalOpen]       = useState(false);
  const [purchaseModal, setPurchaseModal] = useState<string | null>(null);
  const [editing, setEditing]           = useState<Supplier | null>(null);
  const [deleting, setDeleting]         = useState<Supplier | null>(null);
  const [expanded, setExpanded]         = useState<string | null>(null);

  const totalInvestment = purchases.filter(p => p.status !== 'cancelado')
    .reduce((s, p) => s + p.cost, 0);
  const pendingPickup = purchases.filter(p => p.status === 'pendiente').length;

  const handleSave = (data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing) { updateSupplier(editing.id, data); }
    else { addSupplier(data); }
    setModalOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Proveedores</h1>
          <p className="text-sm text-gray-500 mt-0.5">{suppliers.length} proveedores</p>
        </div>
        {can('proveedores', 'crear') && (
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary" type="button">
            <Plus size={16} /> Nuevo proveedor
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard title="Inversión total" value={formatCurrency(totalInvestment)} icon={Store} color="purple" />
        <StatCard title="Compras por recoger" value={pendingPickup} icon={Store} color="yellow" />
        <StatCard title="Proveedores activos" value={suppliers.length} icon={Store} color="blue" />
      </div>

      {suppliers.length === 0 ? (
        <EmptyState icon={Store} title="No hay proveedores" description="Agrega tus proveedores principales"
          action={<button onClick={() => setModalOpen(true)} className="btn-primary" type="button"><Plus size={14} /> Agregar</button>} />
      ) : (
        <div className="space-y-3">
          {suppliers.map(supplier => {
            const supplierPurchases = purchases.filter(p => p.supplierId === supplier.id)
              .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
            const totalSpent = supplierPurchases.filter(p => p.status !== 'cancelado')
              .reduce((s, p) => s + p.cost, 0);
            const isExpanded = expanded === supplier.id;

            return (
              <div key={supplier.id} className="card">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Store size={16} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900">{supplier.name}</h3>
                    {supplier.phone && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {supplier.phone}
                      </p>
                    )}
                    {supplier.products && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{supplier.products}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(totalSpent)}</p>
                    <p className="text-xs text-gray-400">{supplierPurchases.length} compras</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {can('proveedores', 'editar') && (
                      <button onClick={() => { setEditing(supplier); setModalOpen(true); }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600" type="button">
                        <Edit2 size={13} />
                      </button>
                    )}
                    {can('proveedores', 'eliminar') && (
                      <button onClick={() => setDeleting(supplier)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500" type="button">
                        <Trash2 size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : supplier.id)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400" type="button">
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Historial de compras
                      </h4>
                      <button onClick={() => setPurchaseModal(supplier.id)}
                        className="btn-primary !text-xs !px-3 !py-1.5" type="button">
                        <Plus size={12} /> Nueva compra
                      </button>
                    </div>
                    {supplierPurchases.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">Sin compras registradas</p>
                    ) : (
                      <div className="space-y-2">
                        {supplierPurchases.map(purchase => {
                          const sepIdx = purchase.description.indexOf(' — ');
                          const orderRef = sepIdx > 0 && sepIdx < 25 ? purchase.description.slice(0, sepIdx) : null;
                          const mainDesc = orderRef ? purchase.description.slice(sepIdx + 3) : purchase.description;
                          return (
                            <div key={purchase.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                              <div>
                                {orderRef && (
                                  <span className="inline-block text-[10px] font-bold text-primary-700 bg-primary-50 border border-primary-100 px-2 py-0.5 rounded-full mb-1.5">
                                    {orderRef}
                                  </span>
                                )}
                                <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">{mainDesc}</p>
                                <p className="text-[10px] text-gray-500 mt-1">
                                  {formatDate(purchase.purchaseDate)}
                                  {purchase.notes && ` · ${purchase.notes}`}
                                </p>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${supplierPurchaseStatusColor[purchase.status]}`}>
                                    {supplierPurchaseStatusLabel[purchase.status]}
                                  </span>
                                  <select
                                    value={purchase.status}
                                    onChange={e => updatePurchase(purchase.id, { status: e.target.value as SupplierPurchaseStatus })}
                                    className="text-[10px] border border-gray-200 rounded-lg px-1.5 py-0.5 bg-white text-gray-500 focus:outline-none"
                                  >
                                    {(['pendiente','recogido','pagado','cancelado'] as SupplierPurchaseStatus[]).map(s => (
                                      <option key={s} value={s}>{supplierPurchaseStatusLabel[s]}</option>
                                    ))}
                                  </select>
                                </div>
                                <span className="text-sm font-bold text-gray-900">{formatCurrency(purchase.cost)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}>
        <SupplierForm initial={editing ?? undefined} onSave={handleSave} />
      </Modal>

      <Modal isOpen={!!purchaseModal} onClose={() => setPurchaseModal(null)}
        title="Registrar compra" size="sm">
        {purchaseModal && (
          <PurchaseForm supplierId={purchaseModal}
            onSave={data => { addPurchase(data); setPurchaseModal(null); }} />
        )}
      </Modal>

      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) deleteSupplier(deleting.id); setDeleting(null); }}
        title="Eliminar proveedor"
        message={`¿Eliminar proveedor "${deleting?.name}"?`}
        confirmLabel="Eliminar" danger />
    </div>
  );
}
