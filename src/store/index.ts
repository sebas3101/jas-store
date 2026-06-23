import { create } from 'zustand';
import { supabase, toCamel, toSnake } from '../lib/supabase';
import type {
  User, Client, Product, Order, OrderItem,
  Payment, Supplier, SupplierPurchase, Publication,
  Warranty, PaymentProof, Expense, OrderHistory, MonthlyGoal,
} from '../types';
import { deriveClientStatus } from '../utils/businessLogic';

// ─── Realtime channel (módulo) ────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _realtimeChannel: any = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _onStoreError: ((msg: string) => void) | null = null;
export function registerStoreErrorHandler(fn: (msg: string) => void) { _onStoreError = fn; }
function notifyError(op: string) {
  const msg = `Error al guardar (${op}). Intenta de nuevo.`;
  _onStoreError?.(msg);
  console.error(msg);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cam = (rows: any[]) => rows.map(toCamel) as any[];

const genOrderNumber = (orders: Order[]) => {
  const maxNum = orders.reduce((max, o) => {
    const n = parseInt(o.orderNumber?.replace('JAS-', '') ?? '0', 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `JAS-${String(maxNum + 1).padStart(3, '0')}`;
};


// Sincroniza el status de UN cliente contra Supabase si cambió.
// Actualiza el estado local inmediatamente; la llamada a Supabase es fire-and-forget.
async function syncOneClientStatus(
  clientId: string,
  clients: Client[],
  orders: Order[],
  payments: Payment[],
  setStore: (fn: (s: { clients: Client[] }) => Partial<{ clients: Client[] }>) => void
) {
  const client = clients.find(c => c.id === clientId);
  if (!client) return;
  const newStatus = deriveClientStatus(client, orders, payments);
  if (newStatus === client.status) return;
  const now = new Date().toISOString();
  // Actualizar UI de inmediato (sin esperar a Supabase)
  setStore(s => ({
    clients: s.clients.map(c =>
      c.id === clientId ? { ...c, status: newStatus, updatedAt: now } : c
    ),
  }));
  // Persistir en Supabase en segundo plano
  supabase
    .from('clients')
    .update(toSnake({ status: newStatus, updatedAt: now }))
    .eq('id', clientId)
    .then(({ error }) => {
      if (error) console.error('syncOneClientStatus:', error);
    });
}

// ─── Tipo del store ───────────────────────────────────────────────────────────
interface AppStore {
  // Inicialización
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;

  // Auth
  currentUser: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;

  // Users
  users: User[];
  addUser:    (u: Omit<User, 'id' | 'createdAt'>) => Promise<void>;
  updateUser: (id: string, u: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  // Clients
  clients: Client[];
  addClient:    (c: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateClient: (id: string, c: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  // Products
  products: Product[];
  addProduct:    (p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (id: string, p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  // Orders
  orders: Order[];
  addOrder:    (o: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>, supplierPayments?: { supplierId: string; paidAmount: number; paymentMethod: 'efectivo' | 'transferencia' }[]) => Promise<void>;
  updateOrder: (id: string, o: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;

  // Payments
  payments: Payment[];
  addPayment:    (p: Omit<Payment, 'id' | 'createdAt'>) => Promise<void>;
  updatePayment: (id: string, p: Partial<Payment>) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;

  // Suppliers
  suppliers: Supplier[];
  addSupplier:    (s: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateSupplier: (id: string, s: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;

  // Purchases
  purchases: SupplierPurchase[];
  addPurchase:    (p: Omit<SupplierPurchase, 'id' | 'createdAt'>) => Promise<void>;
  updatePurchase: (id: string, p: Partial<SupplierPurchase>) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;

  // Publications
  publications: Publication[];
  addPublication:    (p: Omit<Publication, 'id' | 'createdAt'>) => Promise<void>;
  updatePublication: (id: string, p: Partial<Publication>) => Promise<void>;
  deletePublication: (id: string) => Promise<void>;

  // Warranties
  warranties: Warranty[];
  addWarranty:    (w: Omit<Warranty, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateWarranty: (id: string, w: Partial<Warranty>) => Promise<void>;
  deleteWarranty: (id: string) => Promise<void>;

  // Payment Proofs
  paymentProofs: PaymentProof[];
  addPaymentProof:       (p: Omit<PaymentProof, 'id' | 'createdAt'>) => Promise<void>;
  updatePaymentProof:    (id: string, p: Partial<PaymentProof>) => Promise<void>;
  deletePaymentProof:    (id: string) => Promise<void>;
  confirmPaymentProof:   (id: string) => Promise<void>;
  rejectPaymentProof:    (id: string, reason: string) => Promise<void>;

  // Expenses
  expenses: Expense[];
  addExpense:    (e: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateExpense: (id: string, e: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  // Order history
  orderHistory: OrderHistory[];
  getOrderHistory: (orderId: string) => OrderHistory[];

  // Goals (antes en localStorage, ahora en Supabase — compartidas entre dispositivos)
  goals: MonthlyGoal[];
  addGoal:    (g: Omit<MonthlyGoal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateGoal: (id: string, g: Partial<Omit<MonthlyGoal, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  // Manual refresh (pull-to-refresh)
  refreshData: () => Promise<void>;

  // Computed helpers
  getClientDebt:     (clientId: string) => number;
  getClientBalance:  (clientId: string) => number; // positive = credit, negative = debt (net)
  getClientTotalPaid:(clientId: string) => number;
  getClientOrders:   (clientId: string) => Order[];
  getClientPayments: (clientId: string) => Payment[];
  getOrderItems:     (orderId: string)  => OrderItem[];
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAppStore = create<AppStore>()((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,

  // ── Inicialización: carga todos los datos desde Supabase ─────────────────
  initialize: async () => {
    if (get().initialized) return;
    set({ isLoading: true, error: null });
    try {
      const [
        { data: users },
        { data: clients },
        { data: products },
        { data: orders },
        { data: payments },
        { data: suppliers },
        { data: purchases },
        { data: publications },
        { data: warranties },
        { data: paymentProofs },
        { data: expenses },
        { data: orderHistory },
        { data: goals },
      ] = await Promise.all([
        supabase.from('app_users').select('*').order('created_at'),
        supabase.from('clients').select('*').order('created_at'),
        supabase.from('products').select('*').order('created_at'),
        supabase.from('orders').select('*').order('created_at'),
        supabase.from('payments').select('*').order('created_at'),
        supabase.from('suppliers').select('*').order('created_at'),
        supabase.from('supplier_purchases').select('*').order('created_at'),
        supabase.from('publications').select('*').order('created_at'),
        supabase.from('warranties').select('*').order('created_at'),
        supabase.from('payment_proofs').select('*').order('created_at'),
        supabase.from('expenses').select('*').order('created_at'),
        supabase.from('order_history').select('*').order('created_at'),
        supabase.from('monthly_goals').select('*').order('created_at'),
      ]);

      const loadedClients  = cam(clients  ?? []) as Client[];
      const loadedOrders   = cam(orders   ?? []) as Order[];
      const loadedPayments = cam(payments ?? []) as Payment[];

      // Corregir estados de clientes al arrancar, usando la deuda real y los pagos
      const syncedClients = loadedClients.map(c => {
        const correct = deriveClientStatus(c, loadedOrders, loadedPayments);
        return correct !== c.status ? { ...c, status: correct } : c;
      });
      const changedClients = syncedClients.filter(
        (c, i) => c.status !== loadedClients[i].status
      );

      set({
        users:         cam(users         ?? []) as User[],
        clients:       syncedClients,
        products:      cam(products      ?? []) as Product[],
        orders:        loadedOrders,
        payments:      loadedPayments,
        suppliers:     cam(suppliers     ?? []) as Supplier[],
        purchases:     cam(purchases     ?? []) as SupplierPurchase[],
        publications:  cam(publications  ?? []) as Publication[],
        warranties:    cam(warranties    ?? []) as Warranty[],
        paymentProofs: cam(paymentProofs ?? []) as PaymentProof[],
        expenses:      cam(expenses      ?? []) as Expense[],
        orderHistory:  cam(orderHistory  ?? []) as OrderHistory[],
        goals:         cam(goals         ?? []) as MonthlyGoal[],
        initialized: true,
        isLoading: false,
      });

      // Persistir cambios de status en Supabase (fire-and-forget)
      if (changedClients.length > 0) {
        const now = new Date().toISOString();
        for (const c of changedClients) {
          supabase
            .from('clients')
            .update(toSnake({ status: c.status, updatedAt: now }))
            .eq('id', c.id)
            .then(({ error }) => {
              if (error) console.error('syncClientStatus (init):', error);
            });
        }
      }

      // ── Supabase Realtime: auto-actualizar cuando el bot registra datos ──────
      if (_realtimeChannel) {
        supabase.removeChannel(_realtimeChannel);
      }

      const refetchPaymentProofs = async () => {
        const { data } = await supabase.from('payment_proofs').select('*').order('created_at');
        if (data) set({ paymentProofs: cam(data) as PaymentProof[] });
      };

      const refetchOrders = async () => {
        const { data } = await supabase.from('orders').select('*').order('created_at');
        if (data) set({ orders: cam(data) as Order[] });
      };

      const refetchPayments = async () => {
        const { data } = await supabase.from('payments').select('*').order('created_at');
        if (data) set({ payments: cam(data) as Payment[] });
      };

      const refetchClients = async () => {
        const { data } = await supabase.from('clients').select('*').order('created_at');
        if (data) set({ clients: cam(data) as Client[] });
      };

      const refetchWarranties = async () => {
        const { data } = await supabase.from('warranties').select('*').order('created_at');
        if (data) set({ warranties: cam(data) as Warranty[] });
      };

      const refetchExpenses = async () => {
        const { data } = await supabase.from('expenses').select('*').order('created_at');
        if (data) set({ expenses: cam(data) as Expense[] });
      };

      const refetchPurchases = async () => {
        const { data } = await supabase.from('supplier_purchases').select('*').order('created_at');
        if (data) set({ purchases: cam(data) as SupplierPurchase[] });
      };

      const refetchSuppliers = async () => {
        const { data } = await supabase.from('suppliers').select('*').order('created_at');
        if (data) set({ suppliers: cam(data) as Supplier[] });
      };

      const refetchProducts = async () => {
        const { data } = await supabase.from('products').select('*').order('created_at');
        if (data) set({ products: cam(data) as Product[] });
      };

      const refetchPublications = async () => {
        const { data } = await supabase.from('publications').select('*').order('created_at');
        if (data) set({ publications: cam(data) as Publication[] });
      };

      const refetchGoals = async () => {
        const { data } = await supabase.from('monthly_goals').select('*').order('created_at');
        if (data) set({ goals: cam(data) as MonthlyGoal[] });
      };

      _realtimeChannel = supabase
        .channel('jas-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_proofs' },    refetchPaymentProofs)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },            refetchOrders)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },          refetchPayments)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' },           refetchClients)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'warranties' },        refetchWarranties)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' },          refetchExpenses)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_purchases' },refetchPurchases)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' },         refetchSuppliers)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' },          refetchProducts)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'publications' },      refetchPublications)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_goals' },     refetchGoals)
        .subscribe();

    } catch (err) {
      set({ error: 'Error al conectar con la base de datos', isLoading: false });
      console.error('initialize error:', err);
    }
  },

  // ── Manual refresh (pull-to-refresh) ─────────────────────────────────────
  refreshData: async () => {
    try {
      const [
        { data: orders },
        { data: payments },
        { data: paymentProofs },
        { data: clients },
        { data: expenses },
        { data: purchases },
        { data: suppliers },
        { data: products },
        { data: publications },
        { data: warranties },
        { data: goals },
        { data: freshUsers },
      ] = await Promise.all([
        supabase.from('orders').select('*').order('created_at'),
        supabase.from('payments').select('*').order('created_at'),
        supabase.from('payment_proofs').select('*').order('created_at'),
        supabase.from('clients').select('*').order('created_at'),
        supabase.from('expenses').select('*').order('created_at'),
        supabase.from('supplier_purchases').select('*').order('created_at'),
        supabase.from('suppliers').select('*').order('created_at'),
        supabase.from('products').select('*').order('created_at'),
        supabase.from('publications').select('*').order('created_at'),
        supabase.from('warranties').select('*').order('created_at'),
        supabase.from('monthly_goals').select('*').order('created_at'),
        supabase.from('app_users').select('*').order('created_at'),
      ]);
      const update: Partial<AppStore> = {};
      if (orders)        update.orders        = cam(orders)        as Order[];
      if (payments)      update.payments      = cam(payments)      as Payment[];
      if (paymentProofs) update.paymentProofs = cam(paymentProofs) as PaymentProof[];
      if (clients)       update.clients       = cam(clients)       as Client[];
      if (expenses)      update.expenses      = cam(expenses)      as Expense[];
      if (purchases)     update.purchases     = cam(purchases)     as SupplierPurchase[];
      if (suppliers)     update.suppliers     = cam(suppliers)     as Supplier[];
      if (products)      update.products      = cam(products)      as Product[];
      if (publications)  update.publications  = cam(publications)  as Publication[];
      if (warranties)    update.warranties    = cam(warranties)    as Warranty[];
      if (goals)         update.goals         = cam(goals)         as MonthlyGoal[];
      if (freshUsers)    update.users         = cam(freshUsers)    as User[];
      set(update);
    } catch (err) {
      console.error('refreshData error:', err);
    }
  },

  // ── Auth ─────────────────────────────────────────────────────────────────
  currentUser: (() => {
    try { return JSON.parse(localStorage.getItem('jas_user') ?? 'null'); } catch { return null; }
  })(),

  login: async (email, password) => {
    const { data } = await supabase.rpc('login_user', {
      p_email: email,
      p_password: password,
    });
    if (data) {
      const user = toCamel(data as Record<string, unknown>) as User;
      // Nunca guardar la contraseña en el cliente
      const { password: _pw, ...safeUser } = user as User & { password?: string };
      localStorage.setItem('jas_user', JSON.stringify(safeUser));
      set({ currentUser: safeUser as User });
      return true;
    }
    return false;
  },

  logout: () => {
    localStorage.removeItem('jas_user');
    set({ currentUser: null });
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  users: [],

  addUser: async (u) => {
    const row = toSnake({ ...u, createdAt: new Date().toISOString() });
    const { data, error } = await supabase.from('app_users').insert(row).select().single();
    if (error) { notifyError('addUser'); return; }
    set(s => ({ users: [...s.users, toCamel(data) as User] }));
  },

  updateUser: async (id, u) => {
    const { error } = await supabase.from('app_users').update(toSnake(u)).eq('id', id);
    if (error) { notifyError('updateUser'); return; }
    set(s => {
      const updatedUsers = s.users.map(x => x.id === id ? { ...x, ...u } : x);
      // Si se actualizan los permisos del usuario activo, sincronizar la sesión
      const updatedCurrent = s.currentUser?.id === id
        ? { ...s.currentUser, ...u }
        : s.currentUser;
      if (s.currentUser?.id === id) {
        localStorage.setItem('jas_user', JSON.stringify(updatedCurrent));
      }
      return { users: updatedUsers, currentUser: updatedCurrent };
    });
  },

  deleteUser: async (id) => {
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) { notifyError('deleteUser'); return; }
    set(s => ({ users: s.users.filter(x => x.id !== id) }));
  },

  // ── Clients ───────────────────────────────────────────────────────────────
  clients: [],

  addClient: async (c) => {
    const now = new Date().toISOString();
    const row = toSnake({ ...c, createdAt: now, updatedAt: now });
    const { data, error } = await supabase.from('clients').insert(row).select().single();
    if (error) { notifyError('addClient'); return; }
    set(s => ({ clients: [...s.clients, toCamel(data) as Client] }));
  },

  updateClient: async (id, c) => {
    const row = toSnake({ ...c, updatedAt: new Date().toISOString() });
    const { error } = await supabase.from('clients').update(row).eq('id', id);
    if (error) { notifyError('updateClient'); return; }
    set(s => ({
      clients: s.clients.map(x =>
        x.id === id ? { ...x, ...c, updatedAt: new Date().toISOString() } : x
      ),
    }));
  },

  deleteClient: async (id) => {
    // Eliminar registros relacionados antes de borrar el cliente (FK constraints)
    const clientOrders = get().orders.filter(o => o.clientId === id).map(o => o.id);
    if (clientOrders.length > 0) {
      await supabase.from('order_history').delete().in('order_id', clientOrders);
      await supabase.from('warranties').delete().in('order_id', clientOrders);
      await supabase.from('orders').delete().in('id', clientOrders);
    }
    await supabase.from('payment_proofs').delete().eq('client_id', id);
    await supabase.from('payments').delete().eq('client_id', id);
    await supabase.from('reminder_logs').delete().eq('client_id', id);
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) { notifyError('deleteClient'); return; }
    const clientOrderIds = new Set(clientOrders);
    set(s => ({
      clients:   s.clients.filter(x => x.id !== id),
      orders:    s.orders.filter(o => o.clientId !== id),
      payments:  s.payments.filter(p => p.clientId !== id),
      purchases: s.purchases.filter(p => !clientOrderIds.has(p.orderId ?? '')),
    }));
  },

  // ── Products ──────────────────────────────────────────────────────────────
  products: [],

  addProduct: async (p) => {
    const now = new Date().toISOString();
    const row = toSnake({ ...p, createdAt: now, updatedAt: now });
    const { data, error } = await supabase.from('products').insert(row).select().single();
    if (error) { notifyError('addProduct'); return; }
    set(s => ({ products: [...s.products, toCamel(data) as Product] }));
  },

  updateProduct: async (id, p) => {
    const row = toSnake({ ...p, updatedAt: new Date().toISOString() });
    const { error } = await supabase.from('products').update(row).eq('id', id);
    if (error) { notifyError('updateProduct'); return; }
    set(s => ({
      products: s.products.map(x =>
        x.id === id ? { ...x, ...p, updatedAt: new Date().toISOString() } : x
      ),
    }));
  },

  deleteProduct: async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { notifyError('deleteProduct'); return; }
    set(s => ({ products: s.products.filter(x => x.id !== id) }));
  },

  // ── Orders ────────────────────────────────────────────────────────────────
  orders: [],

  addOrder: async (o, supplierPayments) => {
    const now = new Date().toISOString();
    const orderNumber = genOrderNumber(get().orders);
    const row = toSnake({ ...o, orderNumber, createdAt: now, updatedAt: now });
    const { data, error } = await supabase.from('orders').insert(row).select().single();
    if (error) { notifyError('addOrder'); return; }
    const newOrder = toCamel(data) as Order;
    set(s => ({ orders: [...s.orders, newOrder] }));
    // Log history
    const userName = get().currentUser?.name ?? 'sistema';
    supabase.from('order_history').insert(toSnake({
      orderId: newOrder.id, userName, action: 'creado',
      changes: { orderNumber: newOrder.orderNumber, total: newOrder.totalAmount },
    })).select().single().then(({ data: hd, error: he }) => {
      if (he) { console.error('orderHistory insert:', he); return; }
      if (hd) set(s => ({ orderHistory: [...s.orderHistory, toCamel(hd) as OrderHistory] }));
    });
    // Auto-crear compras al proveedor, una por cada proveedor presente en los ítems.
    // Un pedido puede tener productos de varios proveedores → una compra por cada uno.
    const client = get().clients.find(c => c.id === o.clientId);
    const bySupplier = new Map<string, OrderItem[]>();
    for (const it of o.items) {
      if (!it.supplierId) continue;
      const arr = bySupplier.get(it.supplierId) ?? [];
      arr.push(it as OrderItem);
      bySupplier.set(it.supplierId, arr);
    }
    // Compatibilidad: pedidos viejos con un solo proveedor a nivel de pedido
    if (bySupplier.size === 0 && o.supplierId) {
      bySupplier.set(o.supplierId, o.items as OrderItem[]);
    }
    for (const [supplierId, its] of bySupplier) {
      const itemNames = its.map(i => i.productName).filter(Boolean).join(', ');
      const description = itemNames
        ? `${newOrder.orderNumber} — ${itemNames}`
        : `Pedido ${newOrder.orderNumber}${client ? ` — ${client.name}` : ''}`;
      const cost = its.reduce((s, i) => s + (i.costPrice ?? 0) * i.quantity, 0);
      const pay  = supplierPayments?.find(p => p.supplierId === supplierId);
      await get().addPurchase({
        supplierId,
        orderId:       newOrder.id,
        description,
        cost,
        paidAmount:    pay?.paidAmount ?? 0,
        paymentMethod: pay?.paymentMethod ?? 'efectivo',
        status: 'pendiente',
        purchaseDate: o.orderDate || now,
      });
    }
    // Resincronizar status del cliente tras agregar un pedido (genera deuda)
    const { clients, orders, payments } = get();
    await syncOneClientStatus(o.clientId, clients, orders, payments, set);
  },

  updateOrder: async (id, o) => {
    // Obtener clientId antes de actualizar para la sincronización
    const prev = get().orders.find(x => x.id === id);
    const clientId = prev?.clientId;
    const row = toSnake({ ...o, updatedAt: new Date().toISOString() });
    const { error } = await supabase.from('orders').update(row).eq('id', id);
    if (error) { console.error('[updateOrder] Supabase error:', error.code, error.message, error.details, '\nRow:', JSON.stringify(row)); notifyError('updateOrder'); return; }
    set(s => ({
      orders: s.orders.map(x =>
        x.id === id ? { ...x, ...o, updatedAt: new Date().toISOString() } : x
      ),
    }));
    // Log history
    const userName = get().currentUser?.name ?? 'sistema';
    const action = o.status !== undefined && o.status !== prev?.status
      ? 'estado_cambiado'
      : o.amountPaid !== undefined
        ? 'abono_registrado'
        : 'actualizado';
    const changes: Record<string, unknown> = {};
    if (o.status !== undefined && o.status !== prev?.status)   changes.estado = { antes: prev?.status, despues: o.status };
    if (o.amountPaid !== undefined && o.amountPaid !== prev?.amountPaid) changes.abono = o.amountPaid - (prev?.amountPaid ?? 0);
    supabase.from('order_history').insert(toSnake({ orderId: id, userName, action, changes }))
      .select().single().then(({ data: hd, error: he }) => {
        if (he) { console.error('orderHistory insert:', he); return; }
        if (hd) set(s => ({ orderHistory: [...s.orderHistory, toCamel(hd) as OrderHistory] }));
      });
    // Al pasar el pedido a recogido, marcar todas sus compras como recogidas.
    // (un pedido puede tener varias compras, una por proveedor)
    if (o.status === 'recogido' && prev?.status !== 'recogido') {
      const linked = get().purchases.filter(p =>
        (p.orderId ? p.orderId === id : !!prev?.orderNumber && p.description.startsWith(`${prev.orderNumber} —`)) &&
        p.status !== 'recogido' &&
        p.status !== 'cancelado' &&
        p.status !== 'no_disponible'   // no pisar ítems sin stock, siguen pendientes
      );
      for (const p of linked) await get().updatePurchase(p.id, { status: 'recogido' });
    }
    // Al revertir el pedido a por_recoger, resetear sus compras a pendiente
    // para que vuelvan a aparecer en la vista de Recogidas de Proveedores.
    if (o.status === 'por_recoger' && prev?.status === 'recogido') {
      const linked = get().purchases.filter(p =>
        (p.orderId ? p.orderId === id : !!prev?.orderNumber && p.description.startsWith(`${prev.orderNumber} —`)) &&
        p.status === 'recogido'
      );
      for (const p of linked) {
        await supabase.from('supplier_purchases').update({ status: 'pendiente' }).eq('id', p.id);
        set(s => ({ purchases: s.purchases.map(x => x.id === p.id ? { ...x, status: 'pendiente' } : x) }));
      }
    }
    // Resincronizar status del cliente si cambia amountPaid o status del pedido
    if (clientId && (o.amountPaid !== undefined || o.status !== undefined)) {
      const { clients, orders, payments } = get();
      await syncOneClientStatus(clientId, clients, orders, payments, set);
    }
  },

  deleteOrder: async (id) => {
    // Obtener clientId antes de eliminar
    const clientId = get().orders.find(x => x.id === id)?.clientId;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) { notifyError('deleteOrder'); return; }
    // Limpiar también las compras asociadas del estado local
    // (en BD se borran por CASCADE, pero el estado local no lo sabe)
    set(s => ({
      orders: s.orders.filter(x => x.id !== id),
      purchases: s.purchases.filter(p => p.orderId !== id),
    }));
    // Resincronizar: eliminar un pedido puede reducir la deuda del cliente
    if (clientId) {
      const { clients, orders, payments } = get();
      await syncOneClientStatus(clientId, clients, orders, payments, set);
    }
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  payments: [],

  addPayment: async (p) => {
    const row = toSnake({ ...p, createdAt: new Date().toISOString() });
    const { data, error } = await supabase.from('payments').insert(row).select().single();
    if (error) { notifyError('addPayment'); return; }
    set(s => ({ payments: [...s.payments, toCamel(data) as Payment] }));
    // Re-sincronizar estado del cliente: un abono puede sacar de mora
    const { clients, orders, payments: updatedPayments } = get();
    await syncOneClientStatus(p.clientId, clients, orders, updatedPayments, set);
  },

  updatePayment: async (id, p) => {
    const { error } = await supabase.from('payments').update(toSnake(p)).eq('id', id);
    if (error) { notifyError('updatePayment'); return; }
    set(s => ({ payments: s.payments.map(x => x.id === id ? { ...x, ...p } : x) }));
  },

  deletePayment: async (id) => {
    const clientId = get().payments.find(x => x.id === id)?.clientId;
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) { notifyError('deletePayment'); return; }
    set(s => ({ payments: s.payments.filter(x => x.id !== id) }));
    if (clientId) {
      const { clients, orders, payments } = get();
      await syncOneClientStatus(clientId, clients, orders, payments, set);
    }
  },

  // ── Suppliers ─────────────────────────────────────────────────────────────
  suppliers: [],

  addSupplier: async (s) => {
    const now = new Date().toISOString();
    const row = toSnake({ ...s, createdAt: now, updatedAt: now });
    const { data, error } = await supabase.from('suppliers').insert(row).select().single();
    if (error) { notifyError('addSupplier'); return; }
    set(st => ({ suppliers: [...st.suppliers, toCamel(data) as Supplier] }));
  },

  updateSupplier: async (id, s) => {
    const row = toSnake({ ...s, updatedAt: new Date().toISOString() });
    const { error } = await supabase.from('suppliers').update(row).eq('id', id);
    if (error) { notifyError('updateSupplier'); return; }
    set(st => ({
      suppliers: st.suppliers.map(x =>
        x.id === id ? { ...x, ...s, updatedAt: new Date().toISOString() } : x
      ),
    }));
  },

  deleteSupplier: async (id) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) { notifyError('deleteSupplier'); return; }
    set(s => ({ suppliers: s.suppliers.filter(x => x.id !== id) }));
  },

  // ── Purchases ─────────────────────────────────────────────────────────────
  purchases: [],

  addPurchase: async (p) => {
    const row = toSnake({ ...p, createdAt: new Date().toISOString() });
    const { data, error } = await supabase.from('supplier_purchases').insert(row).select().single();
    if (error) { notifyError('addPurchase'); return; }
    set(s => ({ purchases: [...s.purchases, toCamel(data) as SupplierPurchase] }));
  },

  updatePurchase: async (id, p) => {
    const { error } = await supabase.from('supplier_purchases').update(toSnake(p)).eq('id', id);
    if (error) { notifyError('updatePurchase'); return; }
    set(s => ({ purchases: s.purchases.map(x => x.id === id ? { ...x, ...p } : x) }));
    // Si la compra pasa a recogido y TODAS las compras del pedido ya están
    // resueltas (recogido, cancelado, o sin stock), avanzar el pedido a recogido.
    // no_disponible = el proveedor no tiene stock; el pedido igual avanza y se
    // entrega lo que sí hay. El ítem sin stock queda pendiente en Recogidas.
    if (p.status === 'recogido') {
      const purchase = get().purchases.find(x => x.id === id);
      const orderId  = purchase?.orderId;
      if (orderId) {
        const order = get().orders.find(o => o.id === orderId);
        if (order && order.status !== 'recogido') {
          const sibs = get().purchases.filter(x => x.orderId === orderId);
          const allDone = sibs.every(x =>
            x.status === 'recogido' || x.status === 'cancelado' || x.status === 'no_disponible'
          );
          if (allDone) await get().updateOrder(orderId, { status: 'recogido' });
        }
      }
    }
  },

  deletePurchase: async (id) => {
    const { error } = await supabase.from('supplier_purchases').delete().eq('id', id);
    if (error) { notifyError('deletePurchase'); return; }
    set(s => ({ purchases: s.purchases.filter(x => x.id !== id) }));
  },

  // ── Publications ──────────────────────────────────────────────────────────
  publications: [],

  addPublication: async (p) => {
    const row = toSnake({ ...p, createdAt: new Date().toISOString() });
    const { data, error } = await supabase.from('publications').insert(row).select().single();
    if (error) { notifyError('addPublication'); return; }
    set(s => ({ publications: [...s.publications, toCamel(data) as Publication] }));
  },

  updatePublication: async (id, p) => {
    const { error } = await supabase.from('publications').update(toSnake(p)).eq('id', id);
    if (error) { notifyError('updatePublication'); return; }
    set(s => ({ publications: s.publications.map(x => x.id === id ? { ...x, ...p } : x) }));
  },

  deletePublication: async (id) => {
    const { error } = await supabase.from('publications').delete().eq('id', id);
    if (error) { notifyError('deletePublication'); return; }
    set(s => ({ publications: s.publications.filter(x => x.id !== id) }));
  },

  // ── Warranties ────────────────────────────────────────────────────────────
  warranties: [],

  addWarranty: async (w) => {
    const now = new Date().toISOString();
    const row = toSnake({ ...w, createdAt: now, updatedAt: now });
    const { data, error } = await supabase.from('warranties').insert(row).select().single();
    if (error) {
      console.error('[addWarranty] Supabase error:', error.code, error.message, error.details, '\nRow:', JSON.stringify(row));
      notifyError('addWarranty');
      return;
    }
    set(s => ({ warranties: [...s.warranties, toCamel(data) as Warranty] }));
  },

  updateWarranty: async (id, w) => {
    const row = toSnake({ ...w, updatedAt: new Date().toISOString() });
    const { error } = await supabase.from('warranties').update(row).eq('id', id);
    if (error) { notifyError('updateWarranty'); return; }
    set(s => ({ warranties: s.warranties.map(x => x.id === id ? { ...x, ...w, updatedAt: new Date().toISOString() } : x) }));
  },

  deleteWarranty: async (id) => {
    const { error } = await supabase.from('warranties').delete().eq('id', id);
    if (error) { notifyError('deleteWarranty'); return; }
    set(s => ({ warranties: s.warranties.filter(x => x.id !== id) }));
  },

  // ── Payment Proofs ────────────────────────────────────────────────────────
  paymentProofs: [],

  addPaymentProof: async (p) => {
    const row = toSnake({ ...p, createdAt: new Date().toISOString() });
    const { data, error } = await supabase.from('payment_proofs').insert(row).select().single();
    if (error) { notifyError('addPaymentProof'); return; }
    set(s => ({ paymentProofs: [...s.paymentProofs, toCamel(data) as PaymentProof] }));
  },

  updatePaymentProof: async (id, p) => {
    const { error } = await supabase.from('payment_proofs').update(toSnake(p)).eq('id', id);
    if (error) { notifyError('updatePaymentProof'); return; }
    set(s => ({ paymentProofs: s.paymentProofs.map(x => x.id === id ? { ...x, ...p } : x) }));
  },

  deletePaymentProof: async (id) => {
    const { error } = await supabase.from('payment_proofs').delete().eq('id', id);
    if (error) { notifyError('deletePaymentProof'); return; }
    set(s => ({ paymentProofs: s.paymentProofs.filter(x => x.id !== id) }));
  },

  confirmPaymentProof: async (id) => {
    const { paymentProofs, orders, currentUser } = get();
    const proof = paymentProofs.find(p => p.id === id);
    if (!proof || !proof.clientId || !proof.amount) return;

    // Pedidos pendientes del cliente, ordenados FIFO
    const pendingOrders = orders
      .filter(o =>
        o.clientId === proof.clientId &&
        (o.status === 'entregado' || o.status === 'pendiente_pago')
      )
      .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

    // 1. Registrar pago real (el addPayment ya sincroniza estado del cliente)
    await get().addPayment({
      clientId:       proof.clientId,
      orderIds:       pendingOrders.map(o => o.id),
      amount:         proof.amount,
      method:         'transferencia',
      date:           proof.date ?? new Date().toISOString(),
      notes:          proof.notes,
      registeredById: currentUser?.id ?? '',
    });

    // 2. Distribuir FIFO entre pedidos pendientes
    let remaining = proof.amount;
    for (const order of pendingOrders) {
      if (remaining <= 0) break;
      const pendiente = order.totalAmount - order.amountPaid;
      if (pendiente <= 0) continue;
      const toApply = Math.min(remaining, pendiente);
      await get().updateOrder(order.id, {
        amountPaid: order.amountPaid + toApply,
        status: order.amountPaid + toApply >= order.totalAmount ? 'pagado' : order.status,
      });
      remaining -= toApply;
    }

    // 2b. Refrescar orders desde BD para asegurar consistencia tras el FIFO
    // (si algún updateOrder falla parcialmente, la UI queda sincronizada con lo real)
    const { data: freshOrders } = await supabase.from('orders').select('*').order('created_at');
    if (freshOrders) set({ orders: cam(freshOrders) as Order[] });

    // 3. Marcar comprobante como confirmado — solo columnas garantizadas en DB
    const confirmedAt = new Date().toISOString();
    const { error } = await supabase
      .from('payment_proofs')
      .update(toSnake({ status: 'confirmado', reviewedById: currentUser?.id ?? null, updatedAt: confirmedAt }))
      .eq('id', id);
    if (!error) {
      // Intentar guardar confirmed_at si la migración v1.7 ya se ejecutó
      supabase.from('payment_proofs').update({ confirmed_at: confirmedAt }).eq('id', id).then(() => {});
    }
    // Siempre actualizar estado local (funciona aunque falle la columna en DB)
    set(s => ({
      paymentProofs: s.paymentProofs.map(p =>
        p.id === id
          ? { ...p, status: 'confirmado', reviewedById: currentUser?.id, confirmedAt }
          : p
      ),
    }));
  },

  rejectPaymentProof: async (id, reason) => {
    const { currentUser, paymentProofs } = get();
    const proof = paymentProofs.find(p => p.id === id);
    const now   = new Date().toISOString();

    // Guardar motivo en notes como fallback hasta que exista la columna rejection_reason
    const existingNotes  = proof?.notes ?? '';
    const notesWithReason = reason
      ? (existingNotes ? `${existingNotes} | Rechazado: ${reason}` : `Rechazado: ${reason}`)
      : existingNotes;

    const { error } = await supabase
      .from('payment_proofs')
      .update(toSnake({ status: 'rechazado', reviewedById: currentUser?.id ?? null, notes: notesWithReason, updatedAt: now }))
      .eq('id', id);
    if (!error) {
      // Intentar guardar rejection_reason si la migración v1.7 ya se ejecutó
      supabase.from('payment_proofs').update({ rejection_reason: reason || null }).eq('id', id).then(() => {});
    }
    set(s => ({
      paymentProofs: s.paymentProofs.map(p =>
        p.id === id
          ? { ...p, status: 'rechazado', reviewedById: currentUser?.id, rejectionReason: reason, notes: notesWithReason }
          : p
      ),
    }));
  },

  // ── Order history ─────────────────────────────────────────────────────────
  orderHistory: [],
  getOrderHistory: (orderId) => get().orderHistory.filter(h => h.orderId === orderId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

  // ── Expenses ──────────────────────────────────────────────────────────────
  expenses: [],

  addExpense: async (e) => {
    const now = new Date().toISOString();
    const row = toSnake({ ...e, createdAt: now, updatedAt: now });
    const { data, error } = await supabase.from('expenses').insert(row).select().single();
    if (error) { notifyError('addExpense'); return; }
    set(s => ({ expenses: [...s.expenses, toCamel(data) as Expense] }));
  },

  updateExpense: async (id, e) => {
    const row = toSnake({ ...e, updatedAt: new Date().toISOString() });
    const { error } = await supabase.from('expenses').update(row).eq('id', id);
    if (error) { notifyError('updateExpense'); return; }
    set(s => ({
      expenses: s.expenses.map(x => x.id === id ? { ...x, ...e, updatedAt: new Date().toISOString() } : x),
    }));
  },

  deleteExpense: async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { notifyError('deleteExpense'); return; }
    set(s => ({ expenses: s.expenses.filter(x => x.id !== id) }));
  },

  // ── Goals ─────────────────────────────────────────────────────────────────
  goals: [],

  addGoal: async (g) => {
    const now = new Date().toISOString();
    const row = toSnake({ ...g, createdAt: now });
    const { data, error } = await supabase.from('monthly_goals').insert(row).select().single();
    if (error) { notifyError('addGoal'); return; }
    set(s => ({ goals: [...s.goals, toCamel(data) as MonthlyGoal] }));
  },

  updateGoal: async (id, g) => {
    const row = toSnake({ ...g, updatedAt: new Date().toISOString() });
    const { error } = await supabase.from('monthly_goals').update(row).eq('id', id);
    if (error) { notifyError('updateGoal'); return; }
    set(s => ({
      goals: s.goals.map(x => x.id === id ? { ...x, ...g, updatedAt: new Date().toISOString() } : x),
    }));
  },

  deleteGoal: async (id) => {
    const { error } = await supabase.from('monthly_goals').delete().eq('id', id);
    if (error) { notifyError('deleteGoal'); return; }
    set(s => ({ goals: s.goals.filter(x => x.id !== id) }));
  },

  // ── Computed helpers ──────────────────────────────────────────────────────
  getClientDebt: (clientId) =>
    get().orders
      .filter(o =>
        o.clientId === clientId &&
        (o.status === 'entregado' || o.status === 'pendiente_pago')
      )
      .reduce((sum, o) => sum + Math.max(0, o.totalAmount - o.amountPaid), 0),

  getClientBalance: (clientId) =>
    get().orders
      .filter(o => o.clientId === clientId && o.status !== 'cancelado')
      .reduce((sum, o) => sum + (o.amountPaid - o.totalAmount), 0),

  getClientTotalPaid: (clientId) =>
    get().payments
      .filter(p => p.clientId === clientId)
      .reduce((sum, p) => sum + p.amount, 0),

  getClientOrders:   (clientId) => get().orders.filter(o => o.clientId === clientId),
  getClientPayments: (clientId) => get().payments.filter(p => p.clientId === clientId),
  getOrderItems:     (orderId)  => get().orders.find(o => o.id === orderId)?.items ?? [],
}));
