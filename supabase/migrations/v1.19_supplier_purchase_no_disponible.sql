-- Agrega el valor 'no_disponible' al enum supplier_purchase_status
-- para soportar el marcado de ítems sin stock en recogidas.
ALTER TYPE supplier_purchase_status ADD VALUE IF NOT EXISTS 'no_disponible';
