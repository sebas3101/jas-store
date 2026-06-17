export type PaymentMethod = 'transferencia' | 'efectivo' | 'credito' | 'fiado' | 'abono';
export type OrderStatus =
  | 'tomado'
  | 'por_recoger'
  | 'recogido'
  | 'entregado'
  | 'pagado'
  | 'pendiente_pago'
  | 'cancelado';
export type ClientStatus = 'al_dia' | 'pendiente' | 'mora' | 'credito_cerrado';
export type ProductStatus = 'disponible' | 'agotado' | 'por_encargo' | 'publicado';
export type ProductCategory =
  | 'ropa_dama'
  | 'ropa_caballero'
  | 'deportivo'
  | 'casual'
  | 'locion'
  | 'cosmetico'
  | 'otro';
export type UserRole = 'admin' | 'jennifer' | 'alexis' | 'vendedor' | 'consulta';
export type SupplierPurchaseStatus = 'pendiente' | 'recogido' | 'pagado' | 'cancelado';
export type PublicationChannel =
  | 'whatsapp'
  | 'facebook'
  | 'instagram'
  | 'marketplace'
  | 'otro';

// ─── Sistema de permisos por usuario ─────────────────────────────────────────

/** Módulos de la aplicación */
export type PermModule =
  | 'dashboard'
  | 'clientes'
  | 'pedidos'
  | 'productos'
  | 'publicaciones'
  | 'pagos'
  | 'proveedores'
  | 'entregas'
  | 'reportes'
  | 'configuracion';

/** Acciones posibles por módulo */
export type PermAction =
  | 'ver'
  | 'crear'
  | 'editar'
  | 'eliminar'
  | 'exportar'
  | 'registrar_pago'
  | 'registrar_abono'
  | 'ver_financiero'
  | 'cambiar_estado'
  | 'administrar_accesos';

export type ModulePerms = Partial<Record<PermAction, boolean>>;
export type UserPermissions = Partial<Record<PermModule, ModulePerms>>;

// ─── Entidades ────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  active: boolean;
  createdAt: string;
  permissions?: UserPermissions;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  address?: string;
  company?: string;
  reference?: string;
  status: ClientStatus;
  isInternal: boolean;
  notes?: string;
  creditLimit?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  size?: string;
  color?: string;
  reference?: string;
  salePrice: number;
  costPrice: number;
  status: ProductStatus;
  imageUrl?: string;
  responsibleId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  quantity: number;
  salePrice: number;
  costPrice: number;
  size?: string;
  color?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  clientId: string;
  items: OrderItem[];
  totalAmount: number;
  totalCost: number;
  amountPaid: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  sellerId: string;
  deliveryPersonId?: string;
  orderDate: string;
  estimatedDeliveryDate?: string;
  deliveredAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  clientId: string;
  orderIds: string[];
  amount: number;
  method: PaymentMethod;
  date: string;
  proofUrl?: string;
  notes?: string;
  registeredById: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  products?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPurchase {
  id: string;
  supplierId: string;
  description: string;
  cost: number;
  status: SupplierPurchaseStatus;
  purchaseDate: string;
  receivedDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Publication {
  id: string;
  productId: string;
  productName: string;
  channel: PublicationChannel;
  publishedById?: string;
  publishedAt?: string;
  isPublished: boolean;
  notes?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalSales: number;
  totalPending: number;
  totalPaid: number;
  totalProfit: number;
  clientsWithDebt: number;
  clientsUpToDate: number;
  pendingOrders: number;
  deliveredOrders: number;
  ordersToPickup: number;
  weeklyPayments: number;
}
