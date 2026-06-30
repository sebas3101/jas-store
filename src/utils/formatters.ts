import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  OrderStatus,
  ClientStatus,
  ProductStatus,
  ProductCategory,
  PaymentMethod,
  SupplierPurchaseStatus,
  PublicationChannel,
  UserRole,
} from '../types';

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

export const formatDate = (dateStr: string) => {
  try {
    // Normalizar al mediodía local para evitar que UTC desplace al día anterior
    // en Colombia (UTC-5). Aplica tanto a "YYYY-MM-DD" como a timestamps ISO
    // con esa fecha (ej. "2026-06-30T00:00:00+00:00" que guarda Supabase).
    const datePart = dateStr.slice(0, 10);
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? `${datePart}T12:00:00` : dateStr;
    return format(parseISO(normalized), 'dd/MM/yyyy', { locale: es });
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr: string) => {
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy 'a las' HH:mm", { locale: es });
  } catch {
    return dateStr;
  }
};

export const formatRelative = (dateStr: string) => {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: es });
  } catch {
    return dateStr;
  }
};

export const orderStatusLabel: Record<OrderStatus, string> = {
  tomado: 'Pedido tomado',
  por_recoger: 'Por recoger',
  recogido: 'Recogido',
  entregado: 'Entregado',
  pagado: 'Pagado',
  pendiente_pago: 'Pendiente de pago',
  cancelado: 'Cancelado',
};

export const orderStatusColor: Record<OrderStatus, string> = {
  tomado: 'badge-blue',
  por_recoger: 'badge-yellow',
  recogido: 'badge-purple',
  entregado: 'badge-green',
  pagado: 'badge-green',
  pendiente_pago: 'badge-yellow',
  cancelado: 'badge-gray',
};

export const clientStatusLabel: Record<ClientStatus, string> = {
  al_dia:           'Al día',
  pendiente:        'Pendiente',
  mora:             'En mora',
  credito_excedido: 'Cupo excedido',
  credito_cerrado:  'Crédito cerrado',
};

export const clientStatusColor: Record<ClientStatus, string> = {
  al_dia:           'badge-green',
  pendiente:        'badge-yellow',
  mora:             'badge-red',
  credito_excedido: 'badge-orange',
  credito_cerrado:  'badge-gray',
};

export const productStatusLabel: Record<ProductStatus, string> = {
  disponible: 'Disponible',
  agotado: 'Agotado',
  por_encargo: 'Por encargo',
  publicado: 'Publicado',
};

export const productStatusColor: Record<ProductStatus, string> = {
  disponible: 'badge-green',
  agotado: 'badge-red',
  por_encargo: 'badge-yellow',
  publicado: 'badge-blue',
};

export const categoryLabel: Record<ProductCategory, string> = {
  ropa_dama: 'Ropa dama',
  ropa_caballero: 'Ropa caballero',
  deportivo: 'Deportivo',
  casual: 'Casual',
  locion: 'Loción 1.1',
  cosmetico: 'Cosmético Athos',
  otro: 'Otro',
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  credito: 'Crédito',
  fiado: 'Fiado',
  abono: 'Abono',
};

export const supplierPurchaseStatusLabel: Record<SupplierPurchaseStatus, string> = {
  pendiente:      'Pendiente',
  recogido:       'Recogido',
  pagado:         'Pagado',
  cancelado:      'Cancelado',
  no_disponible:  'Sin stock',
};

export const supplierPurchaseStatusColor: Record<SupplierPurchaseStatus, string> = {
  pendiente:     'badge-yellow',
  recogido:      'badge-blue',
  pagado:        'badge-green',
  cancelado:     'badge-gray',
  no_disponible: 'badge-red',
};

export const channelLabel: Record<PublicationChannel, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  marketplace: 'Marketplace',
  otro: 'Otro',
};

export const roleLabel: Record<UserRole, string> = {
  admin: 'Administrador',
  jennifer: 'Jennifer',
  alexis: 'Alexis',
  vendedor: 'Vendedor',
  consulta: 'Solo lectura',
};

export const calculateProfit = (salePrice: number, costPrice: number, qty = 1) =>
  (salePrice - costPrice) * qty;

export const profitMargin = (salePrice: number, costPrice: number) =>
  salePrice > 0 ? (((salePrice - costPrice) / salePrice) * 100).toFixed(1) : '0';
