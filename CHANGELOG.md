# CHANGELOG — JAS Store

Registro de cambios del sistema de gestión comercial JAS Store.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionamiento según [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.1.0] — 2026-06-16 — rama: feature/integracion-supabase

### Agregado
- Integración con Supabase como base de datos real en la nube.
- `src/lib/supabase.ts`: cliente de Supabase + helpers `toCamel` / `toSnake` para
  convertir entre snake_case (Postgres) y camelCase (TypeScript).
- `supabase/schema.sql`: script SQL completo con tablas, RLS y datos iniciales de
  usuarios. Se ejecuta una sola vez en el SQL Editor de Supabase.
- `.env.local` con variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
  (no se sube a Git).
- Pantalla de carga mientras Supabase inicializa los datos.
- Pantalla de error con botón "Reintentar" si falla la conexión.

### Modificado
- `src/store/index.ts`: reemplazado Zustand + persist (localStorage) por Zustand +
  Supabase. Todas las mutaciones (add/update/delete) ahora son async y persisten en
  la nube. Se agrega `initialize()` que carga todos los datos al arrancar la app.
- `src/App.tsx`: llama a `initialize()` en `useEffect` y muestra pantalla de carga
  hasta que los datos estén disponibles.
- `src/pages/LoginPage.tsx`: `login()` ahora es async (consulta Supabase).

### Pendiente
- Code splitting para reducir el bundle principal (~960 kB).
- Pruebas unitarias e integración.

---

## [1.0.1] — 2026-06-16 — rama: feature/correccion-bugs-pagos-pedidos

### Corregido
- `PaymentForm` estaba definido dentro del componente padre en `PaymentsPage.tsx` y
  `ClientDetailPage.tsx`. React lo trataba como un nuevo tipo de componente en cada
  render, causando que el formulario se desmontara y el usuario perdiera lo que había
  escrito. Extraído a componentes de módulo (`PaymentForm` y `ClientPaymentForm`).
- Los abonos registrados no actualizaban el campo `amountPaid` de los pedidos
  correspondientes. La deuda del cliente nunca disminuía en pantalla aunque se
  registraran pagos. Implementada distribución FIFO: el abono se aplica primero al
  pedido más antiguo; si lo cubre completo, el pedido pasa a estado `pagado`.
- El link "Ver todos" en el detalle de cliente enviaba a `/pedidos?cliente=<id>` pero
  `OrdersPage` ignoraba ese parámetro. Ahora la página lee el query param, pre-filtra
  los pedidos y muestra un badge con el nombre del cliente y un botón para limpiar el
  filtro.

### Pendiente
- Integración con Supabase (base de datos real en la nube).
- Code splitting para reducir el bundle principal (actualmente ~760 kB).
- Pruebas unitarias y de integración.

---

## [1.0.0] — 2026-06-16

### Agregado
- Sistema de gestión comercial completo para JAS Store.
- Módulo de autenticación con roles: admin, jennifer, alexis, vendedor, consulta.
- Dashboard con KPIs, gráficos de ventas semanales y distribución de pedidos.
- Gestión de clientes con semáforo de estado (al día / pendiente / mora / crédito cerrado).
- Detalle de cliente: historial de pedidos, abonos, mensaje de cobro por WhatsApp.
- Gestión de pedidos con 7 estados del flujo.
- Detalle de pedido con cambio de estado y registro de pagos.
- Módulo de pagos y abonos con filtro por fecha y método.
- Catálogo de productos con categorías (ropa dama, caballero, deportivo, casual, lociones, cosméticos).
- Gestión de proveedores y compras.
- Módulo de entregas.
- Publicaciones por canal (WhatsApp, Facebook, Instagram, Marketplace).
- Reportes con gráficos (Recharts).
- Configuración de usuarios y roles.
- Persistencia local con Zustand + localStorage.
- Stack: React 18 + Vite + TypeScript + Tailwind CSS + Zustand + Recharts + React Router v6.
