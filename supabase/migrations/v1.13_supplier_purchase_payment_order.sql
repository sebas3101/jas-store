-- Compra a proveedor: vínculo robusto al pedido + abono/pago al proveedor.
-- order_id reemplaza el match frágil por prefijo de description.
-- paid_amount/payment_method permiten registrar abono parcial (saldo = cost - paid_amount).
ALTER TABLE supplier_purchases
  ADD COLUMN IF NOT EXISTS order_id       uuid REFERENCES orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS paid_amount    numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text;

-- Backfill: vincular compras existentes a su pedido por el prefijo "JAS-XXX —"
-- del campo description (el " —" evita que JAS-3 haga match con JAS-30).
UPDATE supplier_purchases p
SET order_id = o.id
FROM orders o
WHERE p.order_id IS NULL
  AND p.description LIKE o.order_number || ' —%';
