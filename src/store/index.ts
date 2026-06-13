import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  User,
  Client,
  Product,
  Order,
  OrderItem,
  Payment,
  Supplier,
  SupplierPurchase,
  Publication,
} from '../types';
import {
  sampleUsers,
  sampleClients,
  sampleProducts,
  sampleOrders,
  samplePayments,
  sampleSuppliers,
  samplePurchases,
  samplePublications,
} from './sampleData';

let counter = 1000;
const genId = (prefix: string) => `${prefix}${++counter}_${Date.now()}`;
const genOrderNumber = (orders: Order[]) => {
  const next = orders.length + 1;
  return `JAS-${String(next).padStart(3, '0')}`;
};

interface AppStore {
  // Auth
  currentUser: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;

  // Users
  users: User[];
  addUser: (u: Omit<User, 'id' | 'createdAt'>) => void;
  updateUser: (id: string, u: Partial<User>) => void;
  deleteUser: (id: string) => void;

  // Clients
  clients: Client[];
  addClient: (c: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateClient: (id: string, c: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Products
  products: Product[];
  addProduct: (p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, p: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // Orders
  orders: Order[];
  addOrder: (o: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>) => void;
  updateOrder: (id: string, o: Partial<Order>) => void;
  deleteOrder: (id: string) => void;

  // Payments
  payments: Payment[];
  addPayment: (p: Omit<Payment, 'id' | 'createdAt'>) => void;
  updatePayment: (id: string, p: Partial<Payment>) => void;
  deletePayment: (id: string) => void;

  // Suppliers
  suppliers: Supplier[];
  addSupplier: (s: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSupplier: (id: string, s: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;

  // Purchases
  purchases: SupplierPurchase[];
  addPurchase: (p: Omit<SupplierPurchase, 'id' | 'createdAt'>) => void;
  updatePurchase: (id: string, p: Partial<SupplierPurchase>) => void;
  deletePurchase: (id: string) => void;

  // Publications
  publications: Publication[];
  addPublication: (p: Omit<Publication, 'id' | 'createdAt'>) => void;
  updatePublication: (id: string, p: Partial<Publication>) => void;
  deletePublication: (id: string) => void;

  // Computed helpers
  getClientDebt: (clientId: string) => number;
  getClientTotalPaid: (clientId: string) => number;
  getClientOrders: (clientId: string) => Order[];
  getClientPayments: (clientId: string) => Payment[];
  getOrderItems: (orderId: string) => OrderItem[];
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      currentUser: null,

      login: (email, password) => {
        const user = get().users.find(
          (u) => u.email === email && u.password === password && u.active
        );
        if (user) {
          set({ currentUser: user });
          return true;
        }
        return false;
      },

      logout: () => set({ currentUser: null }),

      users: sampleUsers,
      addUser: (u) =>
        set((s) => ({
          users: [
            ...s.users,
            { ...u, id: genId('u'), createdAt: new Date().toISOString() },
          ],
        })),
      updateUser: (id, u) =>
        set((s) => ({ users: s.users.map((x) => (x.id === id ? { ...x, ...u } : x)) })),
      deleteUser: (id) => set((s) => ({ users: s.users.filter((x) => x.id !== id) })),

      clients: sampleClients,
      addClient: (c) =>
        set((s) => ({
          clients: [
            ...s.clients,
            {
              ...c,
              id: genId('c'),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        })),
      updateClient: (id, c) =>
        set((s) => ({
          clients: s.clients.map((x) =>
            x.id === id ? { ...x, ...c, updatedAt: new Date().toISOString() } : x
          ),
        })),
      deleteClient: (id) => set((s) => ({ clients: s.clients.filter((x) => x.id !== id) })),

      products: sampleProducts,
      addProduct: (p) =>
        set((s) => ({
          products: [
            ...s.products,
            {
              ...p,
              id: genId('p'),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        })),
      updateProduct: (id, p) =>
        set((s) => ({
          products: s.products.map((x) =>
            x.id === id ? { ...x, ...p, updatedAt: new Date().toISOString() } : x
          ),
        })),
      deleteProduct: (id) =>
        set((s) => ({ products: s.products.filter((x) => x.id !== id) })),

      orders: sampleOrders,
      addOrder: (o) =>
        set((s) => ({
          orders: [
            ...s.orders,
            {
              ...o,
              id: genId('o'),
              orderNumber: genOrderNumber(s.orders),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        })),
      updateOrder: (id, o) =>
        set((s) => ({
          orders: s.orders.map((x) =>
            x.id === id ? { ...x, ...o, updatedAt: new Date().toISOString() } : x
          ),
        })),
      deleteOrder: (id) => set((s) => ({ orders: s.orders.filter((x) => x.id !== id) })),

      payments: samplePayments,
      addPayment: (p) =>
        set((s) => ({
          payments: [
            ...s.payments,
            { ...p, id: genId('pay'), createdAt: new Date().toISOString() },
          ],
        })),
      updatePayment: (id, p) =>
        set((s) => ({
          payments: s.payments.map((x) => (x.id === id ? { ...x, ...p } : x)),
        })),
      deletePayment: (id) =>
        set((s) => ({ payments: s.payments.filter((x) => x.id !== id) })),

      suppliers: sampleSuppliers,
      addSupplier: (s) =>
        set((st) => ({
          suppliers: [
            ...st.suppliers,
            {
              ...s,
              id: genId('s'),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        })),
      updateSupplier: (id, s) =>
        set((st) => ({
          suppliers: st.suppliers.map((x) =>
            x.id === id ? { ...x, ...s, updatedAt: new Date().toISOString() } : x
          ),
        })),
      deleteSupplier: (id) =>
        set((s) => ({ suppliers: s.suppliers.filter((x) => x.id !== id) })),

      purchases: samplePurchases,
      addPurchase: (p) =>
        set((s) => ({
          purchases: [
            ...s.purchases,
            { ...p, id: genId('sp'), createdAt: new Date().toISOString() },
          ],
        })),
      updatePurchase: (id, p) =>
        set((s) => ({
          purchases: s.purchases.map((x) => (x.id === id ? { ...x, ...p } : x)),
        })),
      deletePurchase: (id) =>
        set((s) => ({ purchases: s.purchases.filter((x) => x.id !== id) })),

      publications: samplePublications,
      addPublication: (p) =>
        set((s) => ({
          publications: [
            ...s.publications,
            { ...p, id: genId('pub'), createdAt: new Date().toISOString() },
          ],
        })),
      updatePublication: (id, p) =>
        set((s) => ({
          publications: s.publications.map((x) => (x.id === id ? { ...x, ...p } : x)),
        })),
      deletePublication: (id) =>
        set((s) => ({ publications: s.publications.filter((x) => x.id !== id) })),

      getClientDebt: (clientId) => {
        const { orders } = get();
        return orders
          .filter(
            (o) =>
              o.clientId === clientId &&
              o.status !== 'cancelado' &&
              o.status !== 'pagado'
          )
          .reduce((sum, o) => sum + (o.totalAmount - o.amountPaid), 0);
      },

      getClientTotalPaid: (clientId) => {
        const { payments } = get();
        return payments
          .filter((p) => p.clientId === clientId)
          .reduce((sum, p) => sum + p.amount, 0);
      },

      getClientOrders: (clientId) => {
        return get().orders.filter((o) => o.clientId === clientId);
      },

      getClientPayments: (clientId) => {
        return get().payments.filter((p) => p.clientId === clientId);
      },

      getOrderItems: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId);
        return order?.items ?? [];
      },
    }),
    {
      name: 'jas-store-data',
      version: 1,
    }
  )
);
