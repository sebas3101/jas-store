import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Trash2, Edit2, Receipt, Download,
  Utensils, Fuel, Package, Truck, Box, MoreHorizontal,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Pagination } from '../components/ui/Pagination';

const PER_PAGE = 25;
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { formatCurrency, formatDate } from '../utils/formatters';
import { aoaToCSV, downloadCSV } from '../utils/csvExport';
import type { Expense, ExpenseType } from '../types';

const EXPENSE_TYPES: { value: ExpenseType; label: string; icon: typeof Receipt }[] = [
  { value: 'comida',      label: 'Comida',      icon: Utensils      },
  { value: 'gasolina',    label: 'Gasolina',    icon: Fuel          },
  { value: 'logistica',   label: 'Logística',   icon: Package       },
  { value: 'transporte',  label: 'Transporte',  icon: Truck         },
  { value: 'empaques',    label: 'Empaques',    icon: Box           },
  { value: 'otro',        label: 'Otro',        icon: MoreHorizontal },
];

const TYPE_COLORS: Record<ExpenseType, string> = {
  comida:     'bg-orange-50 text-orange-700',
  gasolina:   'bg-amber-50 text-amber-700',
  logistica:  'bg-blue-50 text-blue-700',
  transporte: 'bg-indigo-50 text-indigo-700',
  empaques:   'bg-emerald-50 text-emerald-700',
  otro:       'bg-gray-100 text-gray-600',
};

function expenseTypeLabel(t: ExpenseType) {
  return EXPENSE_TYPES.find(e => e.value === t)?.label ?? t;
}

// ─── Formulario ───────────────────────────────────────────────────────────────

function ExpenseForm({
  initial,
  onSave,
}: {
  initial?: Partial<Expense>;
  onSave: (e: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const { currentUser } = useAppStore();
  const [form, setForm] = useState<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>>({
    date:          initial?.date          ?? format(new Date(), 'yyyy-MM-dd'),
    type:          initial?.type          ?? 'otro',
    description:   initial?.description  ?? '',
    amount:        initial?.amount        ?? 0,
    responsible:   initial?.responsible  ?? currentUser?.name ?? '',
    paymentMethod: initial?.paymentMethod ?? 'efectivo',
    notes:         initial?.notes        ?? '',
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Fecha *</label>
          <input type="date" className="input-field" required
            value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div>
          <label className="label">Tipo *</label>
          <select className="input-field" value={form.type}
            onChange={e => set('type', e.target.value as ExpenseType)}>
            {EXPENSE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Descripción</label>
          <input className="input-field"
            value={form.description ?? ''}
            onChange={e => set('description', e.target.value)}
            placeholder="ej: Almuerzo entrega zona norte" />
        </div>
        <div>
          <label className="label">Valor *</label>
          <CurrencyInput required value={form.amount} onChange={v => set('amount', v)} />
        </div>
        <div>
          <label className="label">Método de pago</label>
          <select className="input-field" value={form.paymentMethod}
            onChange={e => set('paymentMethod', e.target.value)}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
        </div>
        <div>
          <label className="label">Responsable</label>
          <input className="input-field"
            value={form.responsible ?? ''}
            onChange={e => set('responsible', e.target.value)} />
        </div>
        <div>
          <label className="label">Observaciones</label>
          <input className="input-field"
            value={form.notes ?? ''}
            onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
      <button type="submit" className="btn-primary w-full justify-center">
        Guardar gasto
      </button>
    </form>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function ExpensesPage() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useAppStore();
  const { can } = usePermissions();

  const [modalOpen,  setModal]   = useState(false);
  const [editing,    setEditing] = useState<Expense | null>(null);
  const [deleting,   setDeleting]= useState<Expense | null>(null);
  const [viewMode,   setViewMode]= useState<'month' | 'range'>('month');
  const [selMonth,   setSelMonth]= useState(format(new Date(), 'yyyy-MM'));
  const [dateFrom,   setDateFrom]= useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo,     setDateTo]  = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterType, setFilterType] = useState<ExpenseType | 'all'>('all');
  const [page, setPage]             = useState(1);

  useEffect(() => { setPage(1); }, [viewMode, selMonth, dateFrom, dateTo, filterType]);

  const { from, to } = useMemo(() => {
    if (viewMode === 'month') {
      const d = parseISO(`${selMonth}-01`);
      return { from: startOfMonth(d), to: endOfMonth(d) };
    }
    return { from: parseISO(dateFrom), to: parseISO(dateTo) };
  }, [viewMode, selMonth, dateFrom, dateTo]);

  const rangeExpenses = useMemo(() =>
    expenses.filter(e =>
      isWithinInterval(parseISO(e.date), { start: from, end: to }) &&
      (filterType === 'all' || e.type === filterType)
    ).sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, from, to, filterType]
  );

  const totalAmount = rangeExpenses.reduce((s, e) => s + e.amount, 0);

  const byType = useMemo(() =>
    EXPENSE_TYPES.map(t => ({
      ...t,
      total: rangeExpenses.filter(e => e.type === t.value).reduce((s, e) => s + e.amount, 0),
    })).filter(t => t.total > 0),
    [rangeExpenses]
  );

  const handleSave = (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing) {
      updateExpense(editing.id, data);
    } else {
      addExpense(data);
    }
    setModal(false);
    setEditing(null);
  };

  const handleExport = () => {
    const label = viewMode === 'month'
      ? format(from, 'yyyy-MM')
      : `${format(from, 'yyyyMMdd')}-${format(to, 'yyyyMMdd')}`;
    const rows = [
      ['Fecha', 'Tipo', 'Descripción', 'Responsable', 'Método', 'Valor', 'Observaciones'],
      ...rangeExpenses.map(e => [
        formatDate(e.date),
        expenseTypeLabel(e.type),
        e.description ?? '',
        e.responsible ?? '',
        e.paymentMethod,
        e.amount,
        e.notes ?? '',
      ]),
      [],
      ['TOTAL', '', '', '', '', totalAmount, ''],
    ];
    downloadCSV(aoaToCSV(rows), `JAS-Gastos-${label}.csv`);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Gastos Operativos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Control de gastos de operación y logística</p>
        </div>
        <div className="flex gap-2">
          {can('gastos', 'exportar') && (
            <button onClick={handleExport} className="btn-ghost" type="button">
              <Download size={15} /> Excel
            </button>
          )}
          {can('gastos', 'crear') && (
            <button onClick={() => { setEditing(null); setModal(true); }} className="btn-primary" type="button">
              <Plus size={16} /> Nuevo gasto
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card !p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {(['month', 'range'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                viewMode === m ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
             type="button">
              {m === 'month' ? 'Por mes' : 'Rango de fechas'}
            </button>
          ))}
        </div>
        {viewMode === 'month' ? (
          <div>
            <label className="label">Mes</label>
            <input type="month" className="input-field sm:max-w-[200px]"
              value={selMonth} onChange={e => setSelMonth(e.target.value)} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Desde</label>
              <input type="date" className="input-field"
                value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Hasta</label>
              <input type="date" className="input-field"
                value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
        )}
        {/* Filtro por tipo */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterType('all')}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
              filterType === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
            }`}
           type="button">
            Todos
          </button>
          {EXPENSE_TYPES.map(t => (
            <button key={t.value} onClick={() => setFilterType(t.value)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                filterType === t.value ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
              }`}
             type="button">
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen por tipo */}
      {byType.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {byType.map(t => {
            const Icon = t.icon;
            return (
              <div key={t.value} className="card !p-3 text-center">
                <Icon size={18} className="mx-auto mb-1 text-gray-500" />
                <p className="text-[10px] text-gray-400 font-medium">{t.label}</p>
                <p className="text-sm font-bold text-gray-900">{formatCurrency(t.total)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Total */}
      <div className="card !p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Receipt size={18} className="text-red-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700 truncate">
            Total — {viewMode === 'month' ? format(from, 'MMMM yyyy', { locale: es }) : `${formatDate(dateFrom)} al ${formatDate(dateTo)}`}
          </span>
        </div>
        <span className="text-lg font-bold text-red-600 flex-shrink-0">{formatCurrency(totalAmount)}</span>
      </div>

      {/* Lista */}
      <div className="card space-y-2">
        <h2 className="section-title mb-3">Gastos registrados ({rangeExpenses.length})</h2>
        {rangeExpenses.length === 0 ? (
          <div className="text-center py-10">
            <Receipt size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">Sin gastos en el período</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rangeExpenses.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(expense => {
              const TypeIcon = EXPENSE_TYPES.find(t => t.value === expense.type)?.icon ?? Receipt;
              return (
                <div key={expense.id}
                  className="flex items-center gap-2 sm:gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[expense.type]}`}>
                    <TypeIcon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {expense.description || expenseTypeLabel(expense.type)}
                      </p>
                      <span className={`hidden sm:inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${TYPE_COLORS[expense.type]}`}>
                        {expenseTypeLabel(expense.type)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {formatDate(expense.date)}
                      {expense.responsible ? ` · ${expense.responsible}` : ''}
                      <span className="sm:hidden"> · {expenseTypeLabel(expense.type)}</span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-red-600 whitespace-nowrap">{formatCurrency(expense.amount)}</p>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {can('gastos', 'editar') && (
                      <button
                        onClick={() => { setEditing(expense); setModal(true); }}
                        className="p-1.5 hover:bg-white rounded-xl text-gray-500 hover:text-gray-700 transition-colors"
                       type="button">
                        <Edit2 size={14} />
                      </button>
                    )}
                    {can('gastos', 'eliminar') && (
                      <button
                        onClick={() => setDeleting(expense)}
                        className="p-1.5 hover:bg-red-50 rounded-xl text-gray-500 hover:text-red-500 transition-colors"
                       type="button">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Pagination total={rangeExpenses.length} page={page} perPage={PER_PAGE} onChange={setPage} />

      {/* Modal crear/editar */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModal(false); setEditing(null); }}
        title={editing ? 'Editar gasto' : 'Nuevo gasto operativo'}
      >
        <ExpenseForm initial={editing ?? undefined} onSave={handleSave} />
      </Modal>

      {/* Confirmar eliminar */}
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) deleteExpense(deleting.id); setDeleting(null); }}
        title="Eliminar gasto"
        message={`¿Eliminar el gasto de ${formatCurrency(deleting?.amount ?? 0)}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
