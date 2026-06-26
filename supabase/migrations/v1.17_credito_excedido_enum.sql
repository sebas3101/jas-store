-- v1.17: agregar 'credito_excedido' al enum client_status
-- y corregir clientes que quedaron en 'mora' antes de que existiera este estado

ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'credito_excedido';

-- Corregir clientes que tienen deuda >18 días desde la referencia → ya en mora
-- pero cuyo último abono fue dentro de 18 días y tienen el cupo excedido.
-- Este backfill es idempotente; la app lo recalcula en cada initialize.
UPDATE clients c
SET status = 'credito_excedido', updated_at = NOW()
WHERE c.status = 'mora'
  AND EXISTS (
    SELECT 1 FROM payments p WHERE p.client_id = c.id
    AND NOW()::date - p.date::date <= 18
  )
  AND (
    SELECT COALESCE(SUM(o.total_amount - o.amount_paid), 0)
    FROM orders o
    WHERE o.client_id = c.id
      AND o.status IN ('entregado', 'pendiente_pago')
      AND o.total_amount > o.amount_paid
  ) > COALESCE(c.credit_limit, 200000);
