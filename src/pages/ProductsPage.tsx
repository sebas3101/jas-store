import { useState } from 'react';
import { Plus, Search, Package, Edit2, Trash2, ImagePlus } from 'lucide-react';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { uploadImage } from '../utils/storage';
import {
  formatCurrency,
  productStatusLabel,
  productStatusColor,
  categoryLabel,
  profitMargin,
} from '../utils/formatters';
import type { Product, ProductStatus, ProductCategory } from '../types';

const BUCKET = 'productos';
const uploadProductImage = (file: File) => uploadImage(file, BUCKET);

const CATEGORIES: ProductCategory[] = [
  'ropa_dama','ropa_caballero','deportivo','casual','locion','cosmetico','otro',
];
const STATUSES: ProductStatus[] = ['disponible','agotado','por_encargo','publicado'];

function ProductForm({
  initial,
  onSave,
}: {
  initial?: Partial<Product>;
  onSave: (p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const { users } = useAppStore();
  const [form, setForm] = useState<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>({
    name:          initial?.name ?? '',
    category:      initial?.category ?? 'otro',
    size:          initial?.size ?? '',
    color:         initial?.color ?? '',
    reference:     initial?.reference ?? '',
    salePrice:     initial?.salePrice ?? 0,
    costPrice:     initial?.costPrice ?? 0,
    status:        initial?.status ?? 'disponible',
    responsibleId: initial?.responsibleId ?? '',
    notes:         initial?.notes ?? '',
    imageUrl:      initial?.imageUrl ?? '',
  });
  const [imageFile,    setImageFile]    = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(initial?.imageUrl ?? '');
  const [uploading,    setUploading]    = useState(false);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const margin = profitMargin(form.salePrice, form.costPrice);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let imageUrl = form.imageUrl;
    if (imageFile) {
      setUploading(true);
      const url = await uploadProductImage(imageFile);
      setUploading(false);
      if (url) imageUrl = url;
    }
    onSave({ ...form, imageUrl: imageUrl || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Foto del producto */}
        <div className="col-span-2">
          <label className="label">Foto del producto</label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 group-hover:border-primary-400 transition-colors flex-shrink-0 flex items-center justify-center bg-gray-50">
              {imagePreview
                ? <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                : <ImagePlus size={20} className="text-gray-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600">
                {imagePreview ? 'Cambiar foto' : 'Subir foto'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG o WebP · máx. 5 MB</p>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </label>
        </div>
        <div className="col-span-2">
          <label className="label">Nombre del producto *</label>
          <input className="input-field" required value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="Ej: Conjunto Deportivo" />
        </div>
        <div>
          <label className="label">Categoría</label>
          <select className="input-field" value={form.category}
            onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{categoryLabel[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Estado</label>
          <select className="input-field" value={form.status}
            onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => (
              <option key={s} value={s}>{productStatusLabel[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Precio de venta *</label>
          <CurrencyInput required value={form.salePrice} min={0} onChange={v => set('salePrice', v)} />
        </div>
        <div>
          <label className="label">Precio de costo *</label>
          <CurrencyInput required value={form.costPrice} min={0} onChange={v => set('costPrice', v)} />
        </div>
        {form.salePrice > 0 && form.costPrice > 0 && (
          <div className="col-span-2">
            <div className="bg-emerald-50 rounded-xl px-4 py-2.5 flex justify-between text-sm">
              <span className="text-gray-600">Ganancia: {formatCurrency(form.salePrice - form.costPrice)}</span>
              <span className="font-semibold text-emerald-700">Margen: {margin}%</span>
            </div>
          </div>
        )}
        <div>
          <label className="label">Talla / Presentación</label>
          <input className="input-field" value={form.size ?? ''}
            onChange={e => set('size', e.target.value)} placeholder="S, M, L, 100ml..." />
        </div>
        <div>
          <label className="label">Color</label>
          <input className="input-field" value={form.color ?? ''}
            onChange={e => set('color', e.target.value)} placeholder="Azul, Rojo..." />
        </div>
        <div>
          <label className="label">Referencia</label>
          <input className="input-field" value={form.reference ?? ''}
            onChange={e => set('reference', e.target.value)} placeholder="CD-001" />
        </div>
        <div>
          <label className="label">Responsable</label>
          <select className="input-field" value={form.responsibleId ?? ''}
            onChange={e => set('responsibleId', e.target.value)}>
            <option value="">Sin asignar</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Notas</label>
          <textarea className="input-field resize-none" rows={2} value={form.notes ?? ''}
            onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
      <button type="submit" disabled={uploading} className="btn-primary w-full justify-center disabled:opacity-60">
        {uploading ? 'Subiendo foto...' : 'Guardar producto'}
      </button>
    </form>
  );
}

export function ProductsPage() {
  const { products, users, addProduct, updateProduct, deleteProduct } = useAppStore();
  const { can } = usePermissions();
  const [search, setSearch]           = useState('');
  const [filterCat, setFilterCat]     = useState<ProductCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ProductStatus | 'all'>('all');
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<Product | null>(null);
  const [deleting, setDeleting]       = useState<Product | null>(null);

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.reference ?? '').toLowerCase().includes(search.toLowerCase());
    const matchCat    = filterCat === 'all' || p.category === filterCat;
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const handleSave = (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    // Supabase rechaza strings vacíos en campos UUID — convertir a undefined
    const clean: typeof data = {
      ...data,
      responsibleId: data.responsibleId || undefined,
      size:      data.size?.trim()      || undefined,
      color:     data.color?.trim()     || undefined,
      reference: data.reference?.trim() || undefined,
      notes:     data.notes?.trim()     || undefined,
      imageUrl:  data.imageUrl?.trim()  || undefined,
    };
    if (editing) {
      updateProduct(editing.id, clean);
    } else {
      addProduct(clean);
    }
    setModalOpen(false);
    setEditing(null);
  };

  const categoryColors: Record<ProductCategory, string> = {
    ropa_dama:       'bg-pink-50 text-pink-700',
    ropa_caballero:  'bg-blue-50 text-blue-700',
    deportivo:       'bg-green-50 text-green-700',
    casual:          'bg-orange-50 text-orange-700',
    locion:          'bg-purple-50 text-purple-700',
    cosmetico:       'bg-rose-50 text-rose-700',
    otro:            'bg-gray-50 text-gray-600',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Productos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} productos en catálogo</p>
        </div>
        {can('productos', 'crear') && (
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary" type="button">
            <Plus size={16} /> Nuevo producto
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input-field pl-9" placeholder="Buscar por nombre o referencia..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setFilterCat('all')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
              filterCat === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
           type="button">
            Todas
          </button>
          {CATEGORIES.map(c => (
            <button key={c}
              onClick={() => setFilterCat(c)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
                filterCat === c ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
             type="button">
              {categoryLabel[c]}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setFilterStatus('all')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
              filterStatus === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
           type="button">
            Todos
          </button>
          {STATUSES.map(s => (
            <button key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
                filterStatus === s ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
             type="button">
              {productStatusLabel[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No hay productos"
          description="Agrega productos al catálogo"
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary" type="button">
              <Plus size={14} /> Agregar producto
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(product => {
            const responsible = users.find(u => u.id === product.responsibleId);
            const profit = product.salePrice - product.costPrice;
            return (
              <div key={product.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-primary-50 flex items-center justify-center">
                    {product.imageUrl
                      ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      : <Package size={16} className="text-primary-600" />
                    }
                  </div>
                  <div className="flex items-center gap-1">
                    {can('productos', 'editar') && (
                      <button
                        onClick={() => { setEditing(product); setModalOpen(true); }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                       type="button">
                        <Edit2 size={13} />
                      </button>
                    )}
                    {can('productos', 'eliminar') && (
                      <button
                        onClick={() => setDeleting(product)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                       type="button">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-bold text-gray-900 mb-1 line-clamp-2">
                  {product.name}
                </h3>

                <div className="flex flex-wrap gap-1 mb-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${categoryColors[product.category]}`}>
                    {categoryLabel[product.category]}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${productStatusColor[product.status]}`}>
                    {productStatusLabel[product.status]}
                  </span>
                  {product.size && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {product.size}
                    </span>
                  )}
                </div>

                <div className="border-t border-gray-50 pt-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Precio venta</span>
                    <span className="font-bold text-gray-900">{formatCurrency(product.salePrice)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Costo</span>
                    <span className="text-gray-600">{formatCurrency(product.costPrice)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Ganancia</span>
                    <span className="font-semibold text-emerald-600">
                      {formatCurrency(profit)} ({profitMargin(product.salePrice, product.costPrice)}%)
                    </span>
                  </div>
                  {responsible && (
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-400">Responsable</span>
                      <span className="text-gray-600">{responsible.name}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
      >
        <ProductForm initial={editing ?? undefined} onSave={handleSave} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) deleteProduct(deleting.id); setDeleting(null); }}
        title="Eliminar producto"
        message={`¿Eliminar "${deleting?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
