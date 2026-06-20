import { useState } from 'react';
import { Target, Plus, Edit2, Trash2, TrendingUp, DollarSign, CheckCircle2, Clock } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, getDaysInMonth, getDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAppStore } from '../store';
import { useGoalsStore } from '../store/goals';
import { usePermissions } from '../hooks/usePermissions';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { formatCurrency } from '../utils/formatters';
import type { MonthlyGoal } from '../types';

function ProgressBar({ value, max, color, label = 'logrado' }: { value: number; max: number; color: string; label?: string }) {
  const pct      = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const faltante = Math.max(0, max - value);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{formatCurrency(value)} <span className="text-gray-400">{label}</span></span>
        <span className={`font-bold ${pct >= 100 ? 'text-emerald-600' : 'text-gray-700'}`}>{pct}%</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-gray-400">
        <span>Meta: {formatCurrency(max)}</span>
        {faltante > 0
          ? <span className="text-amber-600 font-medium">Faltan {formatCurrency(faltante)}</span>
          : <span className="text-emerald-600 font-semibold">¡Meta alcanzada! ✓</span>
        }
      </div>
    </div>
  );
}

function GoalForm({
  initial,
  onSave,
}: {
  initial?: Partial<MonthlyGoal>;
  onSave: (g: Omit<MonthlyGoal, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [month, setMonth]         = useState(initial?.month ?? format(new Date(), 'yyyy-MM'));
  const [salesTarget, setSales]   = useState(initial?.salesTarget ?? 0);
  const [collTarget, setColl]     = useState(initial?.collectionTarget ?? 0);
  const [notes, setNotes]         = useState(initial?.notes ?? '');

  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ month, salesTarget, collectionTarget: collTarget, notes }); }}
      className="space-y-4">
      <div>
        <label className="label">Mes *</label>
        <input type="month" className="input-field" required
          value={month} onChange={e => setMonth(e.target.value)} />
      </div>
      <div>
        <label className="label">Meta de ventas ($) *</label>
        <CurrencyInput required value={salesTarget} min={0} onChange={setSales} />
      </div>
      <div>
        <label className="label">Meta de recaudo ($) *</label>
        <CurrencyInput required value={collTarget} min={0} onChange={setColl} />
      </div>
      <div>
        <label className="label">Notas</label>
        <textarea className="input-field resize-none" rows={2} value={notes}
          onChange={e => setNotes(e.target.value)} />
      </div>
      <button type="submit" className="btn-primary w-full justify-center">
        Guardar meta
      </button>
    </form>
  );
}

export function GoalsPage() {
  const { orders, payments } = useAppStore();
  const { goals, addGoal, updateGoal, deleteGoal } = useGoalsStore();
  const { can } = usePermissions();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<MonthlyGoal | null>(null);
  const [deleting, setDeleting]   = useState<MonthlyGoal | null>(null);

  const sorted = [...goals].sort((a, b) => b.month.localeCompare(a.month));

  // Days remaining in current month
  const today      = new Date();
  const totalDays  = getDaysInMonth(today);
  const currentDay = getDate(today);
  const daysLeft   = totalDays - currentDay;

  // Compute actual values for a given month
  const monthActuals = (month: string) => {
    const d    = parseISO(`${month}-01`);
    const from = startOfMonth(d);
    const to   = endOfMonth(d);
    const inRange = (dateStr: string) =>
      isWithinInterval(parseISO(dateStr), { start: from, end: to });

    const sales     = orders
      .filter(o => inRange(o.orderDate) && o.status !== 'cancelado')
      .reduce((s, o) => s + o.totalAmount, 0);
    const collected = payments
      .filter(p => inRange(p.date))
      .reduce((s, p) => s + p.amount, 0);
    return { sales, collected };
  };

  const handleSave = (data: Omit<MonthlyGoal, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing) {
      updateGoal(editing.id, data);
    } else {
      addGoal(data);
    }
    setModalOpen(false);
    setEditing(null);
  };

  // Current month summary
  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentGoal  = goals.find(g => g.month === currentMonth);
  const currentActuals = monthActuals(currentMonth);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Metas mensuales</h1>
          <p className="text-sm text-gray-500 mt-0.5">Seguimiento de ventas y recaudo por mes</p>
        </div>
        {can('metas', 'crear') && (
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary" type="button">
            <Plus size={16} /> Nueva meta
          </button>
        )}
      </div>

      {/* Mes actual */}
      {currentGoal ? (
        <div className="card border-l-4 border-primary-400 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="section-title flex items-center gap-2">
              <Target size={16} className="text-primary-600" />
              {format(parseISO(`${currentMonth}-01`), 'MMMM yyyy', { locale: es })}
            </h2>
            <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
              daysLeft <= 5 ? 'bg-red-50 text-red-600' : daysLeft <= 10 ? 'bg-amber-50 text-amber-700' : 'bg-primary-50 text-primary-600'
            }`}>
              <Clock size={11} />
              {daysLeft === 0 ? 'Último día' : `${daysLeft} día${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`}
            </span>
            {can('metas', 'editar') && (
              <button onClick={() => { setEditing(currentGoal); setModalOpen(true); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors" type="button">
                <Edit2 size={14} />
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                <TrendingUp size={12} /> Ventas
              </p>
              <ProgressBar
                value={currentActuals.sales}
                max={currentGoal.salesTarget}
                color={currentActuals.sales >= currentGoal.salesTarget ? 'bg-emerald-500' : 'bg-primary-500'}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                <DollarSign size={12} /> Recaudo
              </p>
              <ProgressBar
                value={currentActuals.collected}
                max={currentGoal.collectionTarget}
                color={currentActuals.collected >= currentGoal.collectionTarget ? 'bg-emerald-500' : 'bg-blue-500'}
              />
            </div>
          </div>
          {currentGoal.notes && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{currentGoal.notes}</p>
          )}
        </div>
      ) : (
        <div className="card border-dashed border-2 border-primary-200 text-center py-6 space-y-2">
          <Target size={32} className="text-primary-300 mx-auto" />
          <p className="text-sm font-semibold text-gray-600">Sin meta para este mes</p>
          {can('metas', 'crear') && (
            <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary mx-auto" type="button">
              <Plus size={14} /> Crear meta del mes
            </button>
          )}
        </div>
      )}

      {/* Historial */}
      {sorted.filter(g => g.month !== currentMonth).length > 0 && (
        <div className="space-y-3">
          <h2 className="section-title">Historial de metas</h2>
          {sorted.filter(g => g.month !== currentMonth).map(goal => {
            const { sales, collected } = monthActuals(goal.month);
            const salesPct  = goal.salesTarget > 0 ? Math.round((sales / goal.salesTarget) * 100) : 0;
            const collPct   = goal.collectionTarget > 0 ? Math.round((collected / goal.collectionTarget) * 100) : 0;
            const salesOk   = salesPct >= 100;
            const collOk    = collPct  >= 100;
            return (
              <div key={goal.id} className="card !p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {salesOk && collOk
                      ? <CheckCircle2 size={15} className="text-emerald-500" />
                      : <Target size={15} className="text-gray-400" />
                    }
                    <span className="text-sm font-bold text-gray-800">
                      {format(parseISO(`${goal.month}-01`), 'MMMM yyyy', { locale: es })}
                    </span>
                  </div>
                  {(can('metas', 'editar') || can('metas', 'eliminar')) && (
                    <div className="flex gap-1">
                      {can('metas', 'editar') && (
                        <button onClick={() => { setEditing(goal); setModalOpen(true); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors" type="button">
                          <Edit2 size={13} />
                        </button>
                      )}
                      {can('metas', 'eliminar') && (
                        <button onClick={() => setDeleting(goal)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors" type="button">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-500 mb-0.5">Ventas {salesOk ? '✅' : `${salesPct}%`}</p>
                    <p className="font-bold text-gray-800 tabular-nums">{formatCurrency(sales)}</p>
                    <p className="text-gray-400 text-[10px]">Meta: {formatCurrency(goal.salesTarget)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-0.5">Recaudo {collOk ? '✅' : `${collPct}%`}</p>
                    <p className="font-bold text-gray-800 tabular-nums">{formatCurrency(collected)}</p>
                    <p className="text-gray-400 text-[10px]">Meta: {formatCurrency(goal.collectionTarget)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sorted.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Target size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay metas registradas todavía</p>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? 'Editar meta' : 'Nueva meta mensual'}>
        <GoalForm initial={editing ?? undefined} onSave={handleSave} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) deleteGoal(deleting.id); setDeleting(null); }}
        title="Eliminar meta"
        message={`¿Eliminar la meta de ${deleting ? format(parseISO(`${deleting.month}-01`), 'MMMM yyyy', { locale: es }) : ''}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
