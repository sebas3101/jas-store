import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL        = process.env.SUPABASE_URL        ?? process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const now = new Date().toISOString();

const products = [
  // ── Ropa dama ──────────────────────────────────────────────────────────────
  { name: 'Blusa manga larga',           category: 'ropa_dama',      cost_price:  25000, sale_price:  55000, notes: 'Tallas S, M, L, XL' },
  { name: 'Blusa sin mangas',            category: 'ropa_dama',      cost_price:  22000, sale_price:  48000, notes: 'Tallas S, M, L, XL' },
  { name: 'Crop top',                    category: 'ropa_dama',      cost_price:  20000, sale_price:  45000, notes: 'Tallas S, M, L' },
  { name: 'Vestido casual',              category: 'ropa_dama',      cost_price:  55000, sale_price: 110000, notes: 'Tallas S, M, L, XL' },
  { name: 'Vestido de fiesta',           category: 'ropa_dama',      cost_price:  65000, sale_price: 130000, notes: 'Tallas S, M, L' },
  { name: 'Jean dama skinny',            category: 'ropa_dama',      cost_price:  58000, sale_price: 115000, notes: 'Tallas 28-34' },
  { name: 'Leggins',                     category: 'ropa_dama',      cost_price:  25000, sale_price:  55000, notes: 'Tallas S, M, L, XL' },
  { name: 'Falda midi',                  category: 'ropa_dama',      cost_price:  30000, sale_price:  65000, notes: 'Tallas S, M, L' },
  { name: 'Conjunto dama (blusa + pantalón)', category: 'ropa_dama', cost_price:  72000, sale_price: 145000, notes: 'Tallas S, M, L, XL' },
  { name: 'Sudadera dama',               category: 'ropa_dama',      cost_price:  50000, sale_price: 100000, notes: 'Tallas S, M, L, XL' },
  { name: 'Short dama',                  category: 'ropa_dama',      cost_price:  22000, sale_price:  48000, notes: 'Tallas S, M, L' },

  // ── Ropa caballero ─────────────────────────────────────────────────────────
  { name: 'Camiseta básica',             category: 'ropa_caballero', cost_price:  22000, sale_price:  48000, notes: 'Tallas S, M, L, XL, XXL' },
  { name: 'Camisa manga larga',          category: 'ropa_caballero', cost_price:  40000, sale_price:  85000, notes: 'Tallas S, M, L, XL' },
  { name: 'Camisa cuadros',             category: 'ropa_caballero', cost_price:  38000, sale_price:  80000, notes: 'Tallas S, M, L, XL' },
  { name: 'Polo caballero',             category: 'ropa_caballero', cost_price:  32000, sale_price:  70000, notes: 'Tallas S, M, L, XL, XXL' },
  { name: 'Jean caballero clásico',     category: 'ropa_caballero', cost_price:  62000, sale_price: 125000, notes: 'Tallas 28-36' },
  { name: 'Pantalón gabardina',         category: 'ropa_caballero', cost_price:  52000, sale_price: 105000, notes: 'Tallas 28-36' },
  { name: 'Bermuda caballero',          category: 'ropa_caballero', cost_price:  28000, sale_price:  62000, notes: 'Tallas S, M, L, XL' },
  { name: 'Sudadera caballero',         category: 'ropa_caballero', cost_price:  52000, sale_price: 105000, notes: 'Tallas S, M, L, XL, XXL' },
  { name: 'Chaqueta caballero',         category: 'ropa_caballero', cost_price:  75000, sale_price: 150000, notes: 'Tallas S, M, L, XL' },

  // ── Deportivo Athos ────────────────────────────────────────────────────────
  { name: 'Conjunto deportivo Athos dama',      category: 'deportivo', cost_price:  82000, sale_price: 165000, notes: 'Tallas S, M, L, XL' },
  { name: 'Conjunto deportivo Athos caballero', category: 'deportivo', cost_price:  85000, sale_price: 170000, notes: 'Tallas S, M, L, XL' },
  { name: 'Licra Athos',                        category: 'deportivo', cost_price:  36000, sale_price:  78000, notes: 'Tallas S, M, L, XL' },
  { name: 'Top deportivo Athos',                category: 'deportivo', cost_price:  22000, sale_price:  50000, notes: 'Tallas S, M, L' },
  { name: 'Camiseta deportiva Athos',           category: 'deportivo', cost_price:  28000, sale_price:  60000, notes: 'Tallas S, M, L, XL' },
  { name: 'Pantaloneta Athos',                  category: 'deportivo', cost_price:  25000, sale_price:  55000, notes: 'Tallas S, M, L, XL' },
  { name: 'Jogger Athos',                       category: 'deportivo', cost_price:  55000, sale_price: 110000, notes: 'Tallas S, M, L, XL' },
  { name: 'Chaqueta deportiva Athos',           category: 'deportivo', cost_price:  78000, sale_price: 155000, notes: 'Tallas S, M, L, XL' },

  // ── Lociones ───────────────────────────────────────────────────────────────
  { name: 'Perfume dama 30ml',           category: 'locion', cost_price:  20000, sale_price:  45000, notes: '30 ml' },
  { name: 'Perfume dama 60ml',           category: 'locion', cost_price:  35000, sale_price:  75000, notes: '60 ml' },
  { name: 'Perfume dama 100ml',          category: 'locion', cost_price:  52000, sale_price: 110000, notes: '100 ml' },
  { name: 'Perfume caballero 30ml',      category: 'locion', cost_price:  20000, sale_price:  45000, notes: '30 ml' },
  { name: 'Perfume caballero 60ml',      category: 'locion', cost_price:  35000, sale_price:  75000, notes: '60 ml' },
  { name: 'Perfume caballero 100ml',     category: 'locion', cost_price:  52000, sale_price: 110000, notes: '100 ml' },

  // ── Cosméticos ─────────────────────────────────────────────────────────────
  { name: 'Base de maquillaje',          category: 'cosmetico', cost_price:  20000, sale_price:  45000, notes: 'Varios tonos' },
  { name: 'Labial',                      category: 'cosmetico', cost_price:  13000, sale_price:  30000, notes: 'Varios colores' },
  { name: 'Paleta de sombras',           category: 'cosmetico', cost_price:  22000, sale_price:  50000, notes: '12 tonos' },
  { name: 'Corrector',                   category: 'cosmetico', cost_price:  15000, sale_price:  35000, notes: 'Varios tonos' },
].map(p => ({
  ...p,
  status:     'disponible',
  created_at: now,
  updated_at: now,
}));

async function main() {
  console.log(`Insertando ${products.length} productos...`);
  const { data, error } = await supabase
    .from('products')
    .insert(products)
    .select('id, name');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`✅ ${data?.length} productos creados:`);
  data?.forEach(p => console.log(`  • ${p.name}`));
}

main();
