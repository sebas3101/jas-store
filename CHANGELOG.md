# CHANGELOG — JAS Store

Registro de cambios del sistema de gestión comercial JAS Store.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionamiento según [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.1.1] — 2026-06-17 — Validación general QA

### Validado
- `npm run build` sin errores TypeScript ni de compilación.
- Navegación completa: Login, Dashboard, Clientes, Pedidos, Pagos, Productos, Proveedores, Entregas, Publicaciones, Reportes, Configuración.
- Formularios: crear/editar cliente, crear pedido con múltiples items, registrar pago/abono, crear producto, proveedor, publicación y usuario.
- Cálculo de deuda por cliente (`getClientDebt`): excluye pedidos `pagado` y `cancelado` → correcto.
- Distribución FIFO de abonos entre pedidos → correcto.
- Cálculo de ganancia estimada (`totalAmount − totalCost`) → correcto.
- KPIs del Dashboard: ventas totales, por cobrar, cobrado, ganancia estimada → correctos.
- Prueba de caso real: pedido $120.000 + abono $50.000 → saldo pendiente $70.000 → correcto.
- Alertas automáticas (mora, pedidos por recoger, productos agotados) → correctas.
- Mensaje de cobro WhatsApp en detalle de cliente → genera y abre correctamente.
- Sesión persistida en `localStorage`, sobrevive recarga de página.
- Protección de rutas privadas: redirige a `/login` sin sesión activa → correcto.
- Módulo Entregas: asignación de repartidor y cambio de estado → funcionan.
- Configuración: restricción a rol `admin` → correcto.

### Corregido
- **fix: logo roto en página Configuración** (`src/pages/SettingsPage.tsx`): referencia estática `/logo.jpeg` generaba 404 en producción. Corregido importando el asset desde `src/assets/logo.jpeg`.
- **fix: estado del cliente no se actualizaba al pagar desde /pagos** (`src/pages/PaymentsPage.tsx`): `PaymentForm` distribuía el abono pero nunca actualizaba `client.status`. Corregido: si la deuda total queda en cero, se llama `updateClient({ status: 'al_dia' })`.

### Pendiente
- Control de acceso por rol: roles `jennifer`, `alexis`, `vendedor`, `consulta` no tienen guardias de ruta. Cualquier usuario autenticado accede a todos los módulos.
- Estado del cliente no sincronizado automáticamente: solo se recalcula al abonar la deuda completa. Un cliente con deuda parcial puede mostrar estado incorrecto si el admin lo estableció manualmente.
- Bundle pesado (963 KB antes de gzip): aplicar `dynamic import()` en páginas de Reportes y Dashboard para reducir chunk inicial.
- Sin script `npm run lint`: agregar ESLint + `@typescript-eslint`.
- Sin tests: agregar Vitest con tests unitarios para cálculos de deuda, distribución FIFO y ganancia.
- `react-hook-form` está instalado pero no se usa en ningún formulario — eliminar para reducir bundle.

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
