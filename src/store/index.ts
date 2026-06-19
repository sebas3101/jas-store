import { create } from 'zustand';
import { supabase, toCamel, toSnake } from '../lib/supabase';
import type {
  User, Client, Product, Order, OrderItem,
  Payment, Supplier, SupplierPurchase, Publication,
  Warranty, PaymentProof, Expense, OrderHistory,
} from '../types';
import { deriveClientStatus } from '../utils/businessLogic';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cam = (rows: any[]) => rows.map(toCamel) as any[];

const genOrderNumber = (orders: Order[]) =>
  `JAS-${String(orders.length + 1).padStart(3, '0')}`;


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
  addOrder:    (o: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>) => Promise<void>;
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

  // Computed helpers
  getClientDebt:     (clientId: string) => number;
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
    } catch (err) {
      set({ error: 'Error al conectar con la base de datos', isLoading: false });
      console.error('initialize error:', err);
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
      localStorage.setItem('jas_user', JSON.stringify(user));
      set({ currentUser: user });
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
    if (error) { console.error('addUser:', error); return; }
    set(s => ({ users: [...s.users, toCamel(data) as User] }));
  },

  updateUser: async (id, u) => {
    const { error } = await supabase.from('app_users').update(toSnake(u)).eq('id', id);
    if (error) { console.error('updateUser:', error); return; }
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
    if (error) { console.error('deleteUser:', error); return; }
    set(s => ({ users: s.users.filter(x => x.id !== id) }));
  },

  // ── Clients ───────────────────────────────────────────────────────────────
  clients: [],

  addClient: async (c) => {
    const now = new Date().toISOString();
    const row = toSnake({ ...c, createdAt: now, updatedAt: now });
    const { data, error } = await supabase.from('clients').insert(row).select().single();
    if (error) { console.error('addClient:', error); return; }
    set(s => ({ clients: [...s.clients, toCamel(data) as Client] }));
  },

  updateClient: async (id, c) => {
    const row = toSnake({ ...c, updatedAt: new Date().toISOString() });
    const { error } = await supabase.from('clients').update(row).eq('id', id);
    if (error) { console.error('updateClient:', error); return; }
    set(s => ({
      clients: s.clients.map(x =>
        x.id === id ? { ...x, ...c, updatedAt: new Date().toISOString() } : x
      ),
    }));
  },

  deleteClient: async (id) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) { console.error('deleteClient:', error); return; }
    set(s => ({ clients: s.clients.filter(x => x.id !== id) }));
  },

  // ── Products ──────────────────────────────────────────────────────────────
  products: [],

  addProduct: async (p) => {
    const now = new Date().toISOString();
    const row = toSnake({ ...p, createdAt: now, updatedAt: now });
    const { data, error } = await supabase.from('products').insert(row).select().single();
    if (error) { console.error('addProduct:', error); return; }
    set(s => ({ products: [...s.products, toCamel(data) as Product] }));
  },

  updateProduct: async (id, p) => {
    const row = toSnake({ ...p, updatedAt: new Date().toISOString() });
    const { error } = await supabase.from('products').update(row).eq('id', id);
    if (error) { console.error('updateProduct:', error); return; }
    set(s => ({
      products: s.products.map(x =>
        x.id === id ? { ...x, ...p, updatedAt: new Date().toISOString() } : x
      ),
    }));
  },

  deleteProduct: async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { console.error('deleteProduct:', error); return; }
    set(s => ({ products: s.products.filter(x => x.id !== id) }));
  },

  // ── Orders ────────────────────────────────────────────────────────────────
  orders: [],

  addOrder: async (o) => {
    const now = new Date().toISOString();
    const orderNumber = genOrderNumber(get().orders);
    const row = toSnake({ ...o, orderNumber, createdAt: now, updatedAt: now });
    const { data, error } = await supabase.from('orders').insert(row).select().single();
    if (error) { console.error('addOrder:', error); return; }
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
    if (error) { console.error('updateOrder:', error); return; }
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
    if (error) { console.error('deleteOrder:', error); return; }
    set(s => ({ orders: s.orders.filter(x => x.id !== id) }));
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
    if (error) { console.error('addPayment:', error); return; }
    set(s => ({ payments: [...s.payments, toCamel(data) as Payment] }));
    // Re-sincronizar estado del cliente: un abono puede sacar de mora
    const { clients, orders, payments: updatedPayments } = get();
    await syncOneClientStatus(p.clientId, clients, orders, updatedPayments, set);
  },

  updatePayment: async (id, p) => {
    const { error } = await supabase.from('payments').update(toSnake(p)).eq('id', id);
    if (error) { console.error('updatePayment:', error); return; }
    set(s => ({ payments: s.payments.map(x => x.id === id ? { ...x, ...p } : x) }));
  },

  deletePayment: async (id) => {
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) { console.error('deletePayment:', error); return; }
    set(s => ({ payments: s.payments.filter(x => x.id !== id) }));
  },

  // ── Suppliers ─────────────────────────────────────────────────────────────
  suppliers: [],

  addSupplier: async (s) => {
    const now = new Date().toISOString();
    const row = toSnake({ ...s, createdAt: now, updatedAt: now });
    const { data, error } = await supabase.from('suppliers').insert(row).select().single();
    if (error) { console.error('addSupplier:', error); return; }
    set(st => ({ suppliers: [...st.suppliers, toCamel(data) as Supplier] }));
  },

  updateSupplier: async (id, s) => {
    const row = toSnake({ ...s, updatedAt: new Date().toISOString() });
    const { error } = await supabase.from('suppliers').update(row).eq('id', id);
    if (error) { console.error('updateSupplier:', error); return; }
    set(st => ({
      suppliers: st.suppliers.map(x =>
        x.id === id ? { ...x, ...s, updatedAt: new Date().toISOString() } : x
      ),
    }));
  },

  deleteSupplier: async (id) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) { console.error('deleteSupplier:', error); return; }
    set(s => ({ suppliers: s.suppliers.filter(x => x.id !== id) }));
  },

  // ── Purchases ─────────────────────────────────────────────────────────────
  purchases: [],

  addPurchase: async (p) => {
    const row = toSnake({ ...p, createdAt: new Date().toISOString() });
    const { data, error } = await supabase.from('supplier_purchases').insert(row).select().single();
    if (error) { console.error('addPurchase:', error); return; }
    set(s => ({ purchases: [...s.purchases, toCamel(data) as SupplierPurchase] }));
  },

  updatePurchase: async (id, p) => {
    const { error } = await supabase.from('supplier_purchases').update(toSnake(p)).eq('id', id);
    if (error) { console.error('updatePurchase:', error); return; }
    set(s => ({ purchases: s.purchases.map(x => x.id === id ? { ...x, ...p } : x) }));
  },

  deletePurchase: async (id) => {
    const { error } = await supabase.from('supplier_purchases').delete().eq('id', id);
    if (error) { console.error('deletePurchase:', error); return; }
    set(s => ({ purchases: s.purchases.filter(x => x.id !== id) }));
  },

  // ── Publications ──────────────────────────────────────────────────────────
  publications: [],

  addPublication: async (p) => {
    const row = toSnake({ ...p, createdAt: new Date().toISOString() });
    const { data, error } = await supabase.from('publications').insert(row).select().single();
    if (error) { console.error('addPublication:', error); return; }
    set(s => ({ publications: [...s.publications, toCamel(data) as Publication] }));
  },

  updatePublication: async (id, p) => {
    const { error } = await supabase.from('publications').update(toSnake(p)).eq('id', id);
    if (error) { console.error('updatePublication:', error); return; }
    set(s => ({ publications: s.publications.map(x => x.id === id ? { ...x, ...p } : x) }));
  },

  deletePublication: async (id) => {
    const { error } = await supabase.from('publications').delete().eq('id', id);
    if (error) { console.error('deletePublication:', error); return; }
    set(s => ({ publications: s.publications.filter(x => x.id !== id) }));
  },

  // ── Warranties ────────────────────────────────────────────────────────────
  warranties: [],

  addWarranty: async (w) => {
    const now = new Date().toISOString();
    const row = toSnake({ ...w, createdAt: now, updatedAt: now });
    const { data, error } = await supabase.from('warranties').insert(row).select().single();
    if (error) { console.error('addWarranty:', error); return; }
    set(s => ({ warranties: [...s.warranties, toCamel(data) as Warranty] }));
  },

  updateWarranty: async (id, w) => {
    const row = toSnake({ ...w, updatedAt: new Date().toISOString() });
    const { error } = await supabase.from('warranties').update(row).eq('id', id);
    if (error) { console.error('updateWarranty:', error); return; }
    set(s => ({ warranties: s.warranties.map(x => x.id === id ? { ...x, ...w, updatedAt: new Date().toISOString() } : x) }));
  },

  deleteWarranty: async (id) => {
    const { error } = await supabase.from('warranties').delete().eq('id', id);
    if (error) { console.error('deleteWarranty:', error); return; }
    set(s => ({ warranties: s.warranties.filter(x => x.id !== id) }));
  },

  // ── Payment Proofs ────────────────────────────────────────────────────────
  paymentProofs: [],

  addPaymentProof: async (p) => {
    const row = toSnake({ ...p, createdAt: new Date().toISOString() });
    const { data, error } = await supabase.from('payment_proofs').insert(row).select().single();
    if (error) { console.error('addPaymentProof:', error); return; }
    set(s => ({ paymentProofs: [...s.paymentProofs, toCamel(data) as PaymentProof] }));
  },

  updatePaymentProof: async (id, p) => {
    const { error } = await supabase.from('payment_proofs').update(toSnake(p)).eq('id', id);
    if (error) { console.error('updatePaymentProof:', error); return; }
    set(s => ({ paymentProofs: s.paymentProofs.map(x => x.id === id ? { ...x, ...p } : x) }));
  },

  deletePaymentProof: async (id) => {
    const { error } = await supabase.from('payment_proofs').delete().eq('id', id);
    if (error) { console.error('deletePaymentProof:', error); return; }
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
        o.status !== 'pagado' &&
        o.status !== 'cancelado'
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
    if (error) { console.error('addExpense:', error); return; }
    set(s => ({ expenses: [...s.expenses, toCamel(data) as Expense] }));
  },

  updateExpense: async (id, e) => {
    const row = toSnake({ ...e, updatedAt: new Date().toISOString() });
    const { error } = await supabase.from('expenses').update(row).eq('id', id);
    if (error) { console.error('updateExpense:', error); return; }
    set(s => ({
      expenses: s.expenses.map(x => x.id === id ? { ...x, ...e, updatedAt: new Date().toISOString() } : x),
    }));
  },

  deleteExpense: async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { console.error('deleteExpense:', error); return; }
    set(s => ({ expenses: s.expenses.filter(x => x.id !== id) }));
  },

  // ── Computed helpers ──────────────────────────────────────────────────────
  getClientDebt: (clientId) =>
    get().orders
      .filter(o =>
        o.clientId === clientId &&
        (o.status === 'entregado' || o.status === 'pendiente_pago')
      )
      .reduce((sum, o) => sum + Math.max(0, o.totalAmount - o.amountPaid), 0),

  getClientTotalPaid: (clientId) =>
    get().payments
      .filter(p => p.clientId === clientId)
      .reduce((sum, p) => sum + p.amount, 0),

  getClientOrders:   (clientId) => get().orders.filter(o => o.clientId === clientId),
  getClientPayments: (clientId) => get().payments.filter(p => p.clientId === clientId),
  getOrderItems:     (orderId)  => get().orders.find(o => o.id === orderId)?.items ?? [],
}));
