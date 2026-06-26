import { useState, useCallback, useEffect } from 'react';
import {
  Bell, LogOut, X, AlertTriangle, Package, CreditCard,
  BellOff, ShieldCheck, Target, ArrowRight,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { formatCurrency } from '../../utils/formatters';
import { getReminderLog, daysSinceReminder } from '../../utils/reminders';
import { differenceInDays, parseISO } from 'date-fns';
import logoUrl from '../../assets/logo.jpeg';

const PAGE_TITLES: Record<string, string> = {
  '/':               'Inicio',
  '/clientes':       'Clientes',
  '/pedidos':        'Pedidos',
  '/pagos':          'Pagos y abonos',
  '/productos':      'Productos',
  '/proveedores':    'Proveedores',
  '/entregas':       'Entregas',
  '/recordatorios':  'Recordatorios',
  '/publicaciones':  'Publicaciones',
  '/reportes':       'Reportes',
  '/finanzas':       'Finanzas',
  '/metas':          'Metas',
  '/garantias':      'Garantías',
  '/comprobantes':   'Comprobantes',
  '/gastos':         'Gastos Operativos',
  '/configuracion':  'Configuración',
};

type NotifSeverity = 'high' | 'medium' | 'low';

interface AppNotification {
  id:          string;
  title:       string;
  description: string;
  severity:    NotifSeverity;
  link:        string;
  icon:        typeof AlertTriangle;
}

const DISMISSED_KEY = 'jas_notif_dismissed';
const READ_KEY      = 'jas_notif_read';

function getDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')); }
  catch { return new Set(); }
}
function getRead(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]')); }
  catch { return new Set(); }
}
function saveDismissed(s: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s]));
}
function saveRead(s: Set<string>) {
  localStorage.setItem(READ_KEY, JSON.stringify([...s]));
}

const severityColors: Record<NotifSeverity, string> = {
  high:   'bg-red-50 border-red-200',
  medium: 'bg-amber-50 border-amber-200',
  low:    'bg-blue-50 border-blue-200',
};
const severityIconColors: Record<NotifSeverity, string> = {
  high:   'text-red-500',
  medium: 'text-amber-500',
  low:    'text-blue-500',
};
const severityDotColors: Record<NotifSeverity, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-blue-400',
};

export function Header() {
  const { currentUser, orders, clients, payments, paymentProofs, warranties, logout } = useAppStore();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen]   = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);
  const [read, setRead]           = useState<Set<string>>(getRead);

  const basePath = '/' + (pathname.split('/')[1] ?? '');
  const pageTitle = PAGE_TITLES[basePath] ?? 'JAS Store';

  // ── Construir notificaciones ────────────────────────────────────────────────
  const all: AppNotification[] = [];

  clients.filter(c => c.status === 'mora').forEach(c => {
    const debt = orders
      .filter(o => o.clientId === c.id && !['pagado', 'cancelado'].includes(o.status))
      .reduce((s, o) => s + (o.totalAmount - o.amountPaid), 0);
    if (debt > 0) all.push({
      id: `mora_${c.id}`,
      title: 'Cliente en mora',
      description: `${c.name} — debe ${formatCurrency(debt)}`,
      severity: 'high',
      link: `/clientes/${c.id}`,
      icon: AlertTriangle,
    });
  });

  clients.filter(c => c.status === 'credito_excedido').forEach(c => {
    const debt = orders
      .filter(o => o.clientId === c.id && !['pagado', 'cancelado'].includes(o.status))
      .reduce((s, o) => s + (o.totalAmount - o.amountPaid), 0);
    if (debt > 0) all.push({
      id: `cupo_${c.id}`,
      title: 'Cupo excedido',
      description: `${c.name} — debe ${formatCurrency(debt)} (supera su cupo)`,
      severity: 'medium',
      link: `/clientes/${c.id}`,
      icon: AlertTriangle,
    });
  });

  const porRecoger = orders.filter(o => o.status === 'por_recoger').length;
  if (porRecoger > 0) all.push({
    id: 'por_recoger',
    title: 'Pedidos por recoger',
    description: `${porRecoger} pedido${porRecoger > 1 ? 's' : ''} esperando recogida`,
    severity: 'medium',
    link: '/entregas',
    icon: Package,
  });

  const enCamino = orders.filter(o => o.status === 'recogido').length;
  if (enCamino > 0) all.push({
    id: 'en_camino',
    title: 'Entregas en camino',
    description: `${enCamino} pedido${enCamino > 1 ? 's' : ''} por entregar al cliente`,
    severity: 'medium',
    link: '/entregas',
    icon: Package,
  });

  const pendientePago = orders.filter(o => o.status === 'pendiente_pago').length;
  if (pendientePago > 0) all.push({
    id: 'pendiente_pago',
    title: 'Pagos pendientes',
    description: `${pendientePago} pedido${pendientePago > 1 ? 's' : ''} con pago pendiente`,
    severity: 'medium',
    link: '/pagos',
    icon: CreditCard,
  });

  const compPendientes = (paymentProofs ?? []).filter(p => p.status === 'pendiente_revision').length;
  if (compPendientes > 0) all.push({
    id: 'comprobantes',
    title: 'Comprobantes por revisar',
    description: `${compPendientes} comprobante${compPendientes > 1 ? 's' : ''} pendiente${compPendientes > 1 ? 's' : ''} de confirmación`,
    severity: 'high',
    link: '/comprobantes',
    icon: CreditCard,
  });

  const garantiasPendientes = (warranties ?? []).filter(w => ['solicitada','en_revision','en_cambio'].includes(w.status)).length;
  if (garantiasPendientes > 0) all.push({
    id: 'garantias',
    title: 'Garantías pendientes',
    description: `${garantiasPendientes} garantía${garantiasPendientes > 1 ? 's' : ''} sin resolver`,
    severity: 'medium',
    link: '/garantias',
    icon: ShieldCheck,
  });

  // Clientes urgentes para recordatorio
  const [reminderLog, setReminderLog] = useState<import('../../utils/reminders').ReminderLog>({});
  useEffect(() => { getReminderLog().then(setReminderLog); }, []);
  const urgentCount = clients.filter(c => {
    const pendingOrds = orders.filter(o => o.clientId === c.id && !['pagado','cancelado'].includes(o.status));
    const debt = pendingOrds.reduce((s, o) => s + (o.totalAmount - o.amountPaid), 0);
    if (debt <= 0) return false;
    const lp = payments
      .filter(p => p.clientId === c.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const days = lp ? differenceInDays(new Date(), parseISO(lp.date)) : 999;
    const dr = daysSinceReminder(c.id, reminderLog);
    return days >= 15 && (dr === null || dr >= 7);
  }).length;

  if (urgentCount > 0) all.push({
    id: 'recordatorios_urgentes',
    title: 'Recordatorios urgentes',
    description: `${urgentCount} cliente${urgentCount > 1 ? 's' : ''} sin abonar hace 15+ días`,
    severity: 'high',
    link: '/recordatorios',
    icon: Target,
  });

  // Filtrar descartadas
  const notifications = all.filter(n => !dismissed.has(n.id));
  const unread = notifications.filter(n => !read.has(n.id)).length;
  const alertCount = notifications.length;

  const handleDismiss = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(dismissed); next.add(id);
    setDismissed(next); saveDismissed(next);
    const r = new Set(read); r.add(id);
    setRead(r); saveRead(r);
  }, [dismissed, read]);

  const handleOpen = useCallback((n: AppNotification) => {
    const r = new Set(read); r.add(n.id);
    setRead(r); saveRead(r);
    setNotifOpen(false);
    navigate(n.link);
  }, [navigate, read]);

  const markAllRead = useCallback(() => {
    const r = new Set(read);
    notifications.forEach(n => r.add(n.id));
    setRead(r); saveRead(r);
  }, [notifications, read]);

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100/80 px-4 py-3 flex items-center gap-3">
        <img src={logoUrl} alt="JAS" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
        <p className="font-bold text-gray-900 text-sm flex-1 truncate">{pageTitle}</p>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => { setNotifOpen(true); }}
            className="p-2 rounded-xl hover:bg-gray-100 relative"
            aria-label={`Notificaciones${alertCount > 0 ? ` (${alertCount})` : ''}`}
           type="button">
            <Bell size={18} className={alertCount > 0 ? 'text-red-500' : 'text-gray-500'} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="w-8 h-8 bg-primary-100 rounded-xl flex items-center justify-center"
           type="button">
            <span className="text-primary-700 font-bold text-xs">
              {currentUser?.name.charAt(0).toUpperCase()}
            </span>
          </button>
        </div>
      </header>

      {/* Notification sheet */}
      {notifOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setNotifOpen(false)} />
          <div className="relative w-full bg-white rounded-t-2xl shadow-2xl pb-safe max-h-[80vh] flex flex-col overflow-x-hidden" style={{ touchAction: 'pan-y' }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-gray-600" />
                <h2 className="font-bold text-gray-900 text-sm">Notificaciones</h2>
                {alertCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {alertCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead}
                    className="text-[11px] text-primary-600 font-medium hover:underline" type="button">
                    Marcar todas leídas
                  </button>
                )}
                <button onClick={() => setNotifOpen(false)}
                  className="p-2 rounded-xl hover:bg-gray-100 text-gray-400" type="button">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <BellOff size={24} className="text-gray-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600">Sin notificaciones</p>
                  <p className="text-xs text-gray-400 text-center">No hay alertas pendientes.</p>
                </div>
              ) : (
                notifications.map(n => {
                  const Icon   = n.icon;
                  const isRead = read.has(n.id);
                  return (
                    <div key={n.id}
                      onClick={() => handleOpen(n)}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer hover:brightness-95 transition-all ${severityColors[n.severity]} ${isRead ? 'opacity-60' : ''}`}
                    >
                      <div className={`mt-0.5 flex-shrink-0 ${severityIconColors[n.severity]}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!isRead && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${severityDotColors[n.severity]}`} />}
                          <p className="text-xs font-bold text-gray-800">{n.title}</p>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">{n.description}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <ArrowRight size={12} className="text-gray-400" />
                        <button
                          onClick={e => handleDismiss(n.id, e)}
                          className="p-1 rounded-lg hover:bg-white/60 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Descartar"
                         type="button">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              {notifications.length > 0 && (
                <p className="text-[10px] text-gray-400 text-center pb-2">
                  Toca una notificación para ir a la sección
                </p>
              )}
            </div>

            {/* Estado vacío con notificaciones descartadas */}
            {all.length > 0 && notifications.length === 0 && (
              <div className="px-4 pb-4 flex-shrink-0">
                <button
                  onClick={() => {
                    const next = new Set<string>();
                    setDismissed(next); saveDismissed(next);
                    const r = new Set<string>();
                    setRead(r); saveRead(r);
                  }}
                  className="w-full text-xs text-gray-400 hover:text-primary-600 py-2 transition-colors"
                 type="button">
                  Restaurar notificaciones descartadas
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User menu */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <div className="relative w-full bg-white rounded-t-2xl shadow-2xl p-5 pb-safe space-y-4 overflow-x-hidden" style={{ touchAction: 'pan-y' }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1 mb-2" />
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-primary-100 rounded-2xl flex items-center justify-center">
                <span className="text-primary-700 font-bold text-lg">
                  {currentUser?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm truncate">{currentUser?.name}</p>
                <p className="text-xs text-gray-400 truncate">{currentUser?.email}</p>
              </div>
              <button onClick={() => setMenuOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400" type="button">
                <X size={18} />
              </button>
            </div>
            <button
              onClick={() => { logout(); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold text-sm transition-colors"
             type="button">
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </>
  );
}
