import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, ArrowLeft, CheckCircle2, AlertTriangle,
  Phone, User, X, Check, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import {
  parseVCF, parseCSV, parseXLSX, matchContactsToClients,
  normalizePhone, isValidColombian,
} from '../utils/contactMatcher';
import type { ParsedContact, MatchResult, Confidence } from '../utils/contactMatcher';

// ── Helpers de UI ────────────────────────────────────────────────────────────

const CONF_LABEL: Record<Confidence, string> = {
  alta:    'Alta',
  media:   'Media',
  baja:    'Baja',
  ninguna: 'Sin coincidencia',
};

const CONF_COLOR: Record<Confidence, string> = {
  alta:    'bg-emerald-100 text-emerald-700',
  media:   'bg-amber-100   text-amber-700',
  baja:    'bg-red-100     text-red-700',
  ninguna: 'bg-gray-100   text-gray-500',
};

// ── Componente principal ─────────────────────────────────────────────────────

export function ContactImportPage() {
  const { clients, updateClient } = useAppStore();
  const { isAdmin } = usePermissions();

  const [contacts,  setContacts]  = useState<ParsedContact[]>([]);
  const [matches,   setMatches]   = useState<MatchResult[]>([]);
  const [confirmed, setConfirmed] = useState<Map<string, string>>(new Map());   // clientId → phone
  const [skipped,   setSkipped]   = useState<Set<string>>(new Set());           // clientId
  const [editPhone, setEditPhone] = useState<Map<string, string>>(new Map());   // clientId → phone manual
  const [filter,    setFilter]    = useState<Confidence | 'todos'>('todos');
  const [applying,  setApplying]  = useState(false);
  const [applied,   setApplied]   = useState(false);
  const [fileName,  setFileName]  = useState('');
  const [showAll,   setShowAll]   = useState(false);
  const [error,     setError]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Procesamiento de archivo ─────────────────────────────────────────────
  // useCallback declarado antes de cualquier return condicional (Rules of Hooks)

  const processFile = useCallback(async (file: File) => {
    setError('');
    setContacts([]);
    setMatches([]);
    setConfirmed(new Map());
    setSkipped(new Set());
    setEditPhone(new Map());
    setApplied(false);
    setFileName(file.name);

    try {
      let parsed: ParsedContact[] = [];
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

      if (ext === 'vcf') {
        const text = await file.text();
        parsed = parseVCF(text);
      } else if (ext === 'csv') {
        const text = await file.text();
        parsed = parseCSV(text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        parsed = await parseXLSX(buffer);
      } else if (ext === 'json') {
        const text = await file.text();
        const data = JSON.parse(text);
        parsed = (Array.isArray(data) ? data : []).map((r: Record<string, string>) => ({
          name:  String(r.name ?? r.nombre ?? r.Name ?? '').trim(),
          phone: normalizePhone(String(r.phone ?? r.celular ?? r.tel ?? r.Tel ?? '')),
        })).filter((c: ParsedContact) => c.name);
      } else {
        setError('Formato no soportado. Usa .vcf, .csv, .xlsx o .json');
        return;
      }

      if (parsed.length === 0) {
        setError('No se encontraron contactos en el archivo.');
        return;
      }

      // Solo contactos con teléfono para el matching
      const withPhone = parsed.filter(c => c.phone);
      const results   = matchContactsToClients(
        clients.map(c => ({ id: c.id, name: c.name, phone: c.phone ?? '' })),
        withPhone,
      );

      setContacts(parsed);
      setMatches(results);
    } catch (e) {
      setError(`Error al leer el archivo: ${e instanceof Error ? e.message : 'desconocido'}`);
    }
  }, [clients]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ── Acciones por fila ────────────────────────────────────────────────────

  const confirm = (clientId: string) => {
    const phone = editPhone.get(clientId) ?? matches.find(m => m.clientId === clientId)?.contact?.phone ?? '';
    const norm  = normalizePhone(phone);
    setConfirmed(prev => new Map(prev).set(clientId, norm));
    setSkipped(prev => { const s = new Set(prev); s.delete(clientId); return s; });
  };

  const skip = (clientId: string) => {
    setSkipped(prev => new Set(prev).add(clientId));
    setConfirmed(prev => { const m = new Map(prev); m.delete(clientId); return m; });
  };

  const setEdit = (clientId: string, phone: string) =>
    setEditPhone(prev => new Map(prev).set(clientId, phone));

  // Confirmar todos los de alta confianza de un golpe
  const confirmAll = () => {
    const newConfirmed = new Map(confirmed);
    for (const m of matches) {
      if (m.confidence === 'alta' && m.contact?.phone && !skipped.has(m.clientId)) {
        const phone = editPhone.get(m.clientId) ?? normalizePhone(m.contact.phone);
        newConfirmed.set(m.clientId, phone);
      }
    }
    setConfirmed(newConfirmed);
  };

  // Aplicar cambios confirmados
  const applyChanges = async () => {
    if (confirmed.size === 0) return;
    setApplying(true);
    for (const [clientId, phone] of confirmed) {
      await updateClient(clientId, { phone });
    }
    setApplying(false);
    setApplied(true);
    setConfirmed(new Map());
  };

  // ── Filtrado y stats ─────────────────────────────────────────────────────

  const visible = matches.filter(m => {
    if (!showAll && m.confidence === 'ninguna') return false;
    if (filter === 'todos') return true;
    return m.confidence === filter;
  });

  const stats = {
    alta:    matches.filter(m => m.confidence === 'alta').length,
    media:   matches.filter(m => m.confidence === 'media').length,
    baja:    matches.filter(m => m.confidence === 'baja').length,
    ninguna: matches.filter(m => m.confidence === 'ninguna').length,
  };

  const confirmable = matches.filter(m => m.confidence === 'alta' && m.contact?.phone && !skipped.has(m.clientId)).length;

  // Guard de acceso — después de todos los hooks
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle size={32} className="text-amber-400" />
        <p className="text-gray-500 text-sm">Solo el administrador puede importar contactos.</p>
        <Link to="/clientes" className="btn-primary">Volver a clientes</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/clientes" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="page-title">Importar contactos</h1>
          <p className="text-xs text-gray-400 mt-0.5">Compara contactos del celular con clientes de la app</p>
        </div>
      </div>

      {/* Zona de carga */}
      {matches.length === 0 && (
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="card border-2 border-dashed border-primary-200 hover:border-primary-400 cursor-pointer transition-colors !p-8 flex flex-col items-center gap-4 text-center"
        >
          <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center">
            <Upload size={24} className="text-primary-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Sube el archivo de contactos</p>
            <p className="text-xs text-gray-400 mt-1">
              Soporta <span className="font-medium">.vcf</span> (iPhone/Android),{' '}
              <span className="font-medium">.csv</span>,{' '}
              <span className="font-medium">.xlsx</span> y{' '}
              <span className="font-medium">.json</span>
            </p>
          </div>
          <p className="text-[11px] text-gray-400 bg-gray-50 rounded-xl px-4 py-2 max-w-xs">
            En iPhone: Contactos → Compartir → Exportar como vCard (.vcf)<br />
            En Android: Contactos → Importar/Exportar → Exportar a almacenamiento (.vcf o .csv)
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".vcf,.csv,.xlsx,.xls,.json"
            className="hidden"
            onChange={onFileInput}
          />
        </div>
      )}

      {error && (
        <div className="card border-red-200 !p-4 flex items-center gap-3 bg-red-50">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Estado: archivo cargado */}
      {matches.length > 0 && (
        <>
          {/* Resumen */}
          <div className="card !p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-bold text-gray-800">
                  📁 {fileName}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {contacts.length} contactos leídos · {contacts.filter(c => c.phone).length} con teléfono
                </p>
              </div>
              <button
                onClick={() => { setMatches([]); setContacts([]); setFileName(''); setApplied(false); }}
                className="btn-ghost text-xs"
              >
                <X size={13} /> Cambiar archivo
              </button>
            </div>

            {/* Stats de coincidencia */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['alta','media','baja','ninguna'] as Confidence[]).map(c => (
                <button
                  key={c}
                  onClick={() => setFilter(f => f === c ? 'todos' : c)}
                  className={`rounded-xl px-3 py-2 text-center transition-all border-2 ${
                    filter === c ? 'border-primary-400 shadow-sm' : 'border-transparent'
                  } ${CONF_COLOR[c]}`}
                >
                  <p className="text-base font-bold">{stats[c]}</p>
                  <p className="text-[10px] font-medium">{CONF_LABEL[c]}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Botón confirmar todos alta */}
          {confirmable > 0 && !applied && (
            <button onClick={confirmAll} className="btn-primary w-full justify-center gap-2">
              <CheckCircle2 size={15} />
              Confirmar las {confirmable} coincidencias de confianza alta
            </button>
          )}

          {/* Tabla de resultados */}
          <div className="space-y-2">
            {visible.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">
                {filter !== 'todos' ? 'No hay coincidencias en esta categoría.' : 'Nada que mostrar.'}
              </p>
            )}

            {visible.map(m => {
              const isConfirmed   = confirmed.has(m.clientId);
              const isSkipped     = skipped.has(m.clientId);
              const isApplied     = applied;
              const editedPhone   = editPhone.get(m.clientId) ?? '';
              const suggestedPhone= m.contact?.phone ? normalizePhone(m.contact.phone) : '';
              const displayPhone  = editedPhone || suggestedPhone;
              const validPhone    = isValidColombian(displayPhone);

              return (
                <div
                  key={m.clientId}
                  className={`card !p-3 sm:!p-4 transition-all ${
                    isConfirmed ? 'border border-emerald-300 bg-emerald-50' :
                    isSkipped   ? 'opacity-50 bg-gray-50' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">

                    {/* Cliente */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-8 h-8 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-primary-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{m.clientName}</p>
                        {m.clientPhone ? (
                          <p className="text-[10px] text-gray-400">Actual: {m.clientPhone}</p>
                        ) : (
                          <p className="text-[10px] text-amber-500">Sin teléfono</p>
                        )}
                      </div>
                    </div>

                    {/* Flecha + contacto encontrado */}
                    {m.contact ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="hidden sm:flex text-gray-300">→</div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone size={13} className="text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{m.contact.name}</p>
                            {/* Input editable del teléfono */}
                            <input
                              type="tel"
                              inputMode="numeric"
                              value={editedPhone || suggestedPhone}
                              onChange={e => setEdit(m.clientId, e.target.value)}
                              className={`text-xs font-bold mt-0.5 bg-transparent border-b outline-none w-32 ${
                                validPhone ? 'text-emerald-700 border-emerald-300' : 'text-amber-600 border-amber-300'
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic flex-1">Sin coincidencia</p>
                    )}

                    {/* Badge confianza */}
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${CONF_COLOR[m.confidence]}`}>
                      {CONF_LABEL[m.confidence]}
                    </span>

                    {/* Acciones */}
                    {m.contact && !isApplied && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        {isConfirmed ? (
                          <button
                            onClick={() => skip(m.clientId)}
                            className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                            title="Desmarcar"
                          >
                            <Check size={15} />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => confirm(m.clientId)}
                              disabled={!validPhone}
                              className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-40"
                              title="Confirmar número"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              onClick={() => skip(m.clientId)}
                              className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                              title="Omitir"
                            >
                              <X size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {isApplied && isConfirmed && (
                      <span className="text-xs text-emerald-600 font-semibold flex-shrink-0">✓ Guardado</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Ver clientes sin coincidencia */}
            {stats.ninguna > 0 && filter === 'todos' && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="w-full text-xs text-gray-400 py-2 hover:text-gray-600 flex items-center justify-center gap-1"
              >
                {showAll
                  ? <><ChevronUp size={13}/> Ocultar {stats.ninguna} sin coincidencia</>
                  : <><ChevronDown size={13}/> Ver {stats.ninguna} clientes sin coincidencia</>
                }
              </button>
            )}
          </div>

          {/* Botón aplicar */}
          {confirmed.size > 0 && !applied && (
            <div className="card !p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-emerald-50 border-emerald-200">
              <p className="text-sm font-semibold text-emerald-800">
                {confirmed.size} número{confirmed.size !== 1 ? 's' : ''} listos para guardar
              </p>
              <button
                onClick={applyChanges}
                disabled={applying}
                className="btn-primary bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto justify-center"
              >
                {applying ? 'Guardando...' : `Guardar ${confirmed.size} número${confirmed.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {applied && (
            <div className="card !p-4 bg-emerald-50 border-emerald-200 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-800">¡Importación completada!</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Los números confirmados fueron guardados en los clientes.
                </p>
              </div>
              <Link to="/clientes" className="btn-ghost ml-auto flex-shrink-0 text-emerald-700">
                Ver clientes
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
