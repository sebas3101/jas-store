# CHANGELOG — JAS Store

Registro de cambios del sistema de gestión comercial JAS Store.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionamiento según [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.2.4] — 2026-06-17 — Agregar ESLint con TypeScript

### Agregado
- `eslint.config.js`: configuración ESLint v9 en formato flat config.
  Incluye reglas de `@eslint/js`, `typescript-eslint`, `react-hooks`
  y `react-refresh`. Ignora `dist/` y `node_modules/`.
- Script `"lint": "eslint ."` en `package.json`.
- Script `"lint:fix": "eslint . --fix"` para correcciones automáticas.

### Dependencias de desarrollo instaladas
- `eslint` ^10.5.0 — motor principal
- `@eslint/js` ^10.0.1 — reglas base JavaScript
- `typescript-eslint` ^8.61.1 — parser y reglas TypeScript
- `eslint-plugin-react-hooks` ^7.1.1 — valida reglas de hooks
- `eslint-plugin-react-refresh` ^0.5.3 — valida exports compatibles con HMR
- `globals` ^17.6.0 — definiciones de globales del navegador

### Resultado de la primera ejecución
`npm run lint` → **0 errores, 0 advertencias**. El código ya seguía
las convenciones correctas. Los únicos `any` existentes en el código
están marcados con comentarios explícitos (`@typescript-eslint/no-explicit-any`).

---

## [1.2.3] — 2026-06-17 — Code splitting: bundle inicial de 966 KB → 446 KB

### Modificado
- `src/App.tsx`: todas las páginas convertidas a `React.lazy()` con dynamic import.
  `LoginPage` se mantiene estática (primera pantalla, carga inmediata).
  Las `<Routes>` se envuelven en `<Suspense fallback={<LoadingScreen />}>`.

### Resultado
| Antes | Después |
|-------|---------|
| 1 chunk · 966 KB | Múltiples chunks |
| El usuario descargaba todo al abrir la app | El usuario solo descarga lo que visita |

**Chunks principales tras el build:**
- `index` (núcleo: React, Zustand, Router, Store, Layout, Login): **446 KB**
- `PieChart` (Recharts completo): **400 KB** — solo se descarga al visitar
  Dashboard o Reportes por primera vez.
- Páginas individuales: 5–12 KB cada una, descargadas al navegar.

**Reducción del bundle inicial: 54%** (de 966 KB a 446 KB).
Usuarios de Clientes, Pedidos o Pagos nunca descargan los 400 KB de Recharts.

---

## [1.2.2] — 2026-06-17 — Eliminar dependencia sin uso react-hook-form

### Eliminado
- `react-hook-form` desinstalado con `npm uninstall react-hook-form`.
  El paquete estaba en `package.json` pero no tenía ningún import en `src/`.
  No aportaba al bundle (Vite nunca lo incluía) pero sí a `node_modules`
  y podía confundir a futuros desarrolladores.

### Verificado
- Búsqueda en todo `src/` confirma cero usos de `react-hook-form`,
  `useForm`, `Controller`, `FormProvider`, `useFieldArray`.
- `npm run build` sigue pasando sin errores tras la desinstalación.

### Pendiente
- `npm audit` reporta 2 vulnerabilidades en `esbuild` (<=0.24.2) y `vite` (<=6.4.2)
  que solo afectan el servidor de desarrollo, no el build de producción.
  Corregirlas requiere saltar a Vite 8 (cambio mayor) — evaluar en una actualización
  dedicada de dependencias.

---

## [1.2.1] — 2026-06-17 — Sincronización automática de estado del cliente

### Agregado
- Helper `deriveClientStatus(client, orders)` en `src/store/index.ts`:
  calcula el estado correcto basado en la deuda real del cliente.
  - Deuda = 0 → `al_dia`
  - Deuda > 0 y ≤ límite de crédito → `pendiente`
  - Deuda > límite de crédito → `mora`
  - `credito_cerrado` nunca se toca (decisión del admin)
- Helper `syncOneClientStatus(clientId, clients, orders, set)`:
  actualiza la UI de inmediato y persiste el cambio en Supabase de forma asíncrona.

### Modificado
- `initialize()`: tras cargar todos los datos, recalcula el status de cada cliente
  y corrige los que están desactualizados. Los cambios se persisten en Supabase
  en segundo plano (fire-and-forget), sin bloquear la carga.
- `addOrder()`: llama a `syncOneClientStatus` después de crear un pedido,
  actualizando el estado del cliente si la nueva deuda lo requiere.
- `updateOrder()`: llama a `syncOneClientStatus` cuando cambia `amountPaid`
  o el estado del pedido, para reflejar la deuda actualizada.
- `deleteOrder()`: llama a `syncOneClientStatus` después de eliminar un pedido,
  ya que la deuda puede reducirse al eliminarlo.

### Pendiente
- `creditLimit` por cliente: actualmente si el campo es null se usa $200.000 como
  umbral entre `pendiente` y `mora`. Verificar que los clientes en BD tengan el
  límite configurado correctamente.

---

## [1.2.0] — 2026-06-17 — Control de acceso por rol

### Agregado
- `src/hooks/usePermissions.ts`: hook centralizado con la matriz de permisos por rol.
  Define qué rutas puede visitar cada rol (`admin`, `jennifer`, `alexis`, `vendedor`, `consulta`).
- Componente `AccessDenied` en `AppLayout`: si el usuario navega a una ruta sin permiso
  ve un mensaje de "Acceso restringido" en lugar de la página (sin redirección al login).

### Modificado
- `src/components/layout/AppLayout.tsx`: lee la ruta actual con `useLocation` y verifica
  el permiso via `usePermissions`. Si no tiene acceso, renderiza `AccessDenied` en lugar de `<Outlet />`.
- `src/components/layout/Sidebar.tsx`: filtra los ítems de navegación con `filterNavItems`
  para mostrar solo los módulos permitidos al rol activo.
- `src/components/layout/MobileNav.tsx`: ídem Sidebar — el menú inferior en móvil
  solo muestra las opciones accesibles.

### Matriz de permisos implementada
| Rol | Módulos accesibles |
|-----|-------------------|
| admin | Todos |
| jennifer | Dashboard, Clientes, Pedidos, Pagos, Entregas, Publicaciones |
| alexis | Dashboard, Pedidos, Entregas |
| vendedor | Dashboard, Productos, Pedidos, Publicaciones |
| consulta | Dashboard, Reportes |

### Pendiente
- Verificar con el usuario si la matriz de permisos refleja exactamente los accesos deseados para cada persona del equipo.

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
