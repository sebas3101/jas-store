import { useState } from 'react';
import { Plus, Megaphone, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { formatDate, channelLabel } from '../utils/formatters';
import type { Publication, PublicationChannel } from '../types';

const CHANNELS: PublicationChannel[] = ['whatsapp','facebook','instagram','marketplace','otro'];

const CHANNEL_COLORS: Record<PublicationChannel, string> = {
  whatsapp:    'bg-green-50 text-green-700',
  facebook:    'bg-blue-50 text-blue-700',
  instagram:   'bg-pink-50 text-pink-700',
  marketplace: 'bg-orange-50 text-orange-700',
  otro:        'bg-gray-50 text-gray-600',
};

const CHANNEL_ICONS: Record<PublicationChannel, string> = {
  whatsapp:    '💬',
  facebook:    '📘',
  instagram:   '📸',
  marketplace: '🛒',
  otro:        '📢',
};

function PublicationForm({ onSave }: {
  onSave: (p: Omit<Publication, 'id' | 'createdAt'>) => void;
}) {
  const { products, users, currentUser } = useAppStore();
  const [productId, setProductId]   = useState('');
  const [channel, setChannel]       = useState<PublicationChannel>('instagram');
  const [publishedById, setPublishedById] = useState(currentUser?.id ?? '');
  const [isPublished, setIsPublished] = useState(false);
  const [notes, setNotes]           = useState('');

  const selectedProduct = products.find(p => p.id === productId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      productId,
      productName: selectedProduct?.name ?? 'Producto',
      channel,
      publishedById: publishedById || undefined,
      publishedAt: isPublished ? new Date().toISOString() : undefined,
      isPublished,
      notes,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Producto *</label>
        <select className="input-field" required value={productId}
          onChange={e => setProductId(e.target.value)}>
          <option value="">Seleccionar producto...</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Canal</label>
          <select className="input-field" value={channel}
            onChange={e => setChannel(e.target.value as PublicationChannel)}>
            {CHANNELS.map(c => (
              <option key={c} value={c}>{channelLabel[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Responsable</label>
          <select className="input-field" value={publishedById}
            onChange={e => setPublishedById(e.target.value)}>
            <option value="">Sin asignar</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Notas</label>
        <textarea className="input-field resize-none" rows={2} value={notes}
          onChange={e => setNotes(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={isPublished}
          onChange={e => setIsPublished(e.target.checked)}
          className="w-4 h-4 rounded accent-primary-600" />
        <span className="text-sm text-gray-700 font-medium">Ya fue publicado</span>
      </label>
      <button type="submit" className="btn-primary w-full justify-center">
        Guardar publicación
      </button>
    </form>
  );
}

export function PublicationsPage() {
  const { publications, users, addPublication, updatePublication, deletePublication } = useAppStore();
  const [modalOpen, setModal]   = useState(false);
  const [filter, setFilter]     = useState<'all' | 'pending' | 'published'>('all');

  const filtered = publications.filter(p => {
    if (filter === 'pending')   return !p.isPublished;
    if (filter === 'published') return p.isPublished;
    return true;
  });

  const pendingCount   = publications.filter(p => !p.isPublished).length;
  const publishedCount = publications.filter(p => p.isPublished).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Publicaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">Seguimiento de publicaciones en canales</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary" type="button">
          <Plus size={16} /> Nueva publicación
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Pendientes"  value={pendingCount}   icon={Clock}        color="yellow" />
        <StatCard title="Publicados"  value={publishedCount} icon={CheckCircle2} color="green" />
        <StatCard title="Total"       value={publications.length} icon={Megaphone} color="purple" />
      </div>

      <div className="flex gap-2">
        {[
          { v: 'all',       l: 'Todas'       },
          { v: 'pending',   l: 'Pendientes'  },
          { v: 'published', l: 'Publicadas'  },
        ].map(tab => (
          <button key={tab.v}
            onClick={() => setFilter(tab.v as typeof filter)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              filter === tab.v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`} type="button">
            {tab.l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Megaphone} title="No hay publicaciones" description="Registra los productos que debes publicar"
          action={<button onClick={() => setModal(true)} className="btn-primary" type="button"><Plus size={14} /> Nueva</button>} />
      ) : (
        <div className="space-y-2">
          {filtered.map(pub => {
            const responsible = users.find(u => u.id === pub.publishedById);
            return (
              <div key={pub.id} className={`card !p-4 ${!pub.isPublished ? 'border-l-4 border-amber-300' : 'border-l-4 border-emerald-400'}`}>
                <div className="flex items-center gap-3">
                  <div className="text-2xl flex-shrink-0">
                    {CHANNEL_ICONS[pub.channel]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{pub.productName}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CHANNEL_COLORS[pub.channel]}`}>
                        {channelLabel[pub.channel]}
                      </span>
                      {responsible && (
                        <span className="text-[10px] text-gray-400">{responsible.name}</span>
                      )}
                      {pub.publishedAt && (
                        <span className="text-[10px] text-gray-400">{formatDate(pub.publishedAt)}</span>
                      )}
                    </div>
                    {pub.notes && (
                      <p className="text-xs text-gray-500 mt-1">{pub.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!pub.isPublished ? (
                      <button
                        onClick={() => updatePublication(pub.id, {
                          isPublished: true,
                          publishedAt: new Date().toISOString(),
                        })}
                        className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors font-medium"
                       type="button">
                        <CheckCircle2 size={12} /> Marcar publicado
                      </button>
                    ) : (
                      <span className="badge-green text-[10px]">
                        <CheckCircle2 size={10} /> Publicado
                      </span>
                    )}
                    <button onClick={() => deletePublication(pub.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500" type="button">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModal(false)} title="Nueva publicación" size="sm">
        <PublicationForm onSave={data => { addPublication(data); setModal(false); }} />
      </Modal>
    </div>
  );
}
