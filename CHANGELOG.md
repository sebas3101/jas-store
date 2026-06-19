# CHANGELOG — JAS Store

Registro de cambios del sistema de gestión comercial JAS Store.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionamiento según [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.6.0] — 2026-06-18 — rama: feature/mejoras-clientes-pedidos-logistica

Mejoras estructurales de negocio: corrección de datos, reglas de deuda, mensajes WhatsApp enriquecidos, logística por proveedor, y dos nuevos módulos (Garantías y Comprobantes).

### Corregido

#### Bloque 1 — Guardado de productos
- UUID vacío enviado a Supabase (ProductsPage.tsx): responsibleId: '' causaba rechazo silencioso en la columna UUID. handleSave ahora limpia campos opcionales antes de persistir.

#### Bloque 5 — Deuda solo al entregar
- calculateClientDebt (businessLogic.ts): la deuda solo se suma cuando el pedido está en entregado o pendiente_pago. Los estados tomado, por_recoger y recogido ya no inflan el saldo pendiente.
- getClientDebt en store/index.ts: actualizado con el mismo filtro.

### Agregado

#### Bloque 2 — Estado de clientes automático + regla de mora 30 días
- deriveClientStatus: acepta payments: Payment[] opcionales e implementa la regla de mora de 30 días (deuda > 0 sin pago en 30 días = mora).
- syncOneClientStatus: actualizado para recibir payments; addPayment re-sincroniza estado tras abono.
- ClientForm: al crear un cliente, status se oculta; se muestra aviso verde explicando el cálculo automático.

#### Bloque 3 — Mensajes WhatsApp enriquecidos
- buildDebtReminderMessage: muestra fecha y monto del último abono registrado.
- buildDebtInfoMessage: resumen completo con lista de pedidos pendientes y todos los abonos.
- buildOrderConfirmationMessage: diferencia crédito (saldo anterior + pedido = nuevo total) vs pago directo (Pagado).
- buildAvailabilityMessage (nueva): notifica al cliente que su pedido está listo para recoger.

#### Bloque 4 — Talla, color y proveedor en pedidos
- OrderForm: cada ítem incluye talla y color, pre-llenados desde el producto seleccionado.
- Sección de proveedor condicional: selector + estado de pago, método y monto al proveedor.
- Nuevos tipos: SupplierPaymentStatus, SupplierPaymentMethod; campos en Order: supplierId, supplierPaymentStatus, supplierPaymentAmount, supplierPaymentMethod.

#### Bloque 6 y 7 — WhatsApp disponibilidad + info proveedor en detalle de pedido
- OrderDetailPage.tsx: tarjeta de info del proveedor, banner azul cuando el pedido no cuenta como deuda, modal WhatsApp al cambiar a por_recoger.

#### Bloque 8 y 9 — Rediseño de Recogidas y Entregas
- Recogidas (DeliveriesPage.tsx): tarjeta ámbar con info del proveedor, pago pendiente destacado en rojo, ítems con talla y color.
- Entregas: info del cliente, botón Ver en Maps, alerta si sin dirección, ítems con talla y color.
- Búsqueda filtra también por nombre de proveedor.

#### Bloque 10 — Módulo Garantías
- src/pages/WarrantiesPage.tsx (nuevo): CRUD de garantías post-entrega. Tipos: devolucion, cambio_talla, cambio_producto, defecto_fabrica, otro. Estados: abierta, en_proceso, resuelta, cerrada.
- Tipos Warranty, WarrantyType, WarrantyStatus en types/index.ts.
- Store: warranties con addWarranty, updateWarranty, deleteWarranty (tabla warranties en Supabase).

#### Bloque 11 — Módulo Comprobantes de pago
- src/pages/PaymentProofPage.tsx (nuevo): registro semi-manual de comprobantes de WhatsApp. Todo comprobante inicia como pendiente_revision.
- Tipos PaymentProof, PaymentProofStatus en types/index.ts.
- Store: paymentProofs con addPaymentProof, updatePaymentProof, deletePaymentProof (tabla payment_proofs en Supabase).

#### Bloque 12 — Permisos actualizados
- PermModule extendido con garantias y comprobantes.
- usePermissions.ts: ROUTE_MODULE, MODULE_ACTIONS, MODULE_LABELS, ALL_MODULES actualizados.
- Plantillas jennifer (garantias ver/crear/editar, comprobantes ver/crear), alexis (garantias ver, comprobantes ver), vendedor (garantias ver).
- Sidebar y MobileNav: íconos ShieldCheck y FileImage añadidos. App.tsx: rutas lazy.

### Pendientes recomendados
- Migración SQL en Supabase: columnas supplier_id y supplier_payment_* en tabla orders; tablas warranties y payment_proofs.
- Actualizar tests para nueva firma de deriveClientStatus con payments.
- Validar visual en dispositivos reales (320-430 px) para Garantías y Comprobantes.

---

## [1.5.2] — 2026-06-17 — Corrección responsive en clientes y filtros de fecha

### Corregido

- **Desbordamiento en resumen financiero de clientes** — La sección de "Total pedidos / Total pagado / Saldo pendiente" en el detalle del cliente usaba `grid-cols-3 gap-4` con `text-2xl`. En 320px cada tarjeta medía ~85px de ancho, insuficiente para valores monetarios. Rediseñada como lista horizontal con fila por indicador (etiqueta izquierda | valor derecho) en móvil, y rejilla de 3 columnas en `sm+`.
- **Valores de historial de pedidos y abonos** — Añadido `flex-shrink-0` al valor monetario en las listas de pedidos y pagos del cliente, evitando que se comprima y genere solapamiento.
- **Historial de metas (GoalsPage)** — `grid-cols-2 gap-4` con cadenas `"$X / $Y"` por columna podía desbordar en 120px de ancho. Cambiado a `grid-cols-1 sm:grid-cols-2` y separado el valor actual de la meta en dos líneas independientes.
- **Input de mes en Finanzas** — Eliminado `max-w-[200px]` en móvil para que el campo ocupe el ancho disponible completo; `sm:max-w-[200px]` en escritorio.

### Validado

- 320px, 360px, 375px, 390px, 414px, 430px: sin scroll horizontal, valores completos, tarjetas alineadas.

---

## [1.5.1] — 2026-06-17 — Correcciones mobile: filtros de fechas, tarjetas de pagos y notificaciones

### Corregido

- **Filtros de rango de fechas** — Los campos "Desde" y "Hasta" ahora se apilan verticalmente en móvil (`grid-cols-1` en < sm). Antes en pantallas de 320-430px los inputs de fecha se comprimían y se solapaban. Corregido en PaymentsPage y FinancesPage.
- **Tarjetas de resumen en Pagos** — La grilla pasó de `grid-cols-3` a `grid-cols-2 sm:grid-cols-3`, con la tarjeta "Total cobrado" ocupando ancho completo en móvil. Evita que los valores monetarios se corten en pantallas estrechas.
- **Campana de notificaciones** — Ahora abre un panel (bottom-sheet) con alertas reales: clientes en mora con monto de deuda, pedidos por recoger y pedidos con pago pendiente. Estado vacío claro si no hay alertas.

### Modificado

- `Header.tsx` — Panel de notificaciones con datos reales del store (clientes en mora, pedidos por recoger, pagos pendientes). Íconos y colores por severidad: rojo (mora), naranja (por recoger/pendiente pago).
- `PaymentsPage.tsx` — Stats 2+1 en móvil, filtros de fecha apilados.
- `FinancesPage.tsx` — Filtros de rango de fechas apilados en móvil.

---

## [1.4.0] — 2026-06-17 — Mejoras pedidos, clientes, finanzas y metas

### Agregado

#### Inputs de moneda (MEJORA 1)
- `src/components/ui/CurrencyInput.tsx` — componente reutilizable para valores monetarios en COP
  - Modo display: muestra `$50.000` formateado
  - Modo edición (focus): muestra número puro, sin ceros pegados
  - Reemplazó `<input type="number">` en OrdersPage, ProductsPage, ClientDetailPage, PaymentsPage, SuppliersPage

#### Recogidas y Entregas separadas (MEJORA 2)
- `src/pages/DeliveriesPage.tsx` — reescrita con dos tabs:
  - **Recogidas**: pedidos `por_recoger` (ir a buscar al proveedor)
  - **Entregas**: pedidos `recogido / entregado / pagado` (llevar al cliente)
  - Stats cards actualizadas: Por recoger, En camino, Entregados

#### Cartera vencida (MEJORA 3)
- `ClientsPage.tsx`: sección de cartera vencida al tope de la lista de clientes
  - Muestra solo clientes con deuda activa
  - Color-coded por antigüedad: amarillo (1-15d), naranja (16-30d), rojo (31-60d), rojo oscuro (+60d)
  - Total de cartera vencida al pie de la sección

#### Mensaje de deuda detallada por WhatsApp (MEJORA 4)
- `src/utils/whatsapp.ts` — nueva función `buildDebtInfoMessage()` con detalle de pedidos pendientes
- `ClientDetailPage.tsx` — segunda tarjeta de WhatsApp "Resumen de deuda" (azul) con copiar + enviar

#### WhatsApp al crear pedido (MEJORA 5)
- `src/utils/whatsapp.ts` — nueva función `buildOrderConfirmationMessage()` con items y saldo pendiente
- `OrdersPage.tsx` — modal de confirmación post-creación de pedido con botón de WhatsApp al cliente

#### Módulo Finanzas (MEJORA 6)
- `src/pages/FinancesPage.tsx` — resumen financiero con:
  - Filtro por mes o rango de fechas
  - KPIs: ventas, recaudo, ganancia bruta, deuda activa
  - Flujo de caja (recaudo vs compras)
  - Desglose por método de pago
  - Tabla de pedidos del período
  - Exportación a Excel (.xlsx) con 4 hojas: Resumen, Pedidos, Pagos, Compras
- Instala `xlsx` (SheetJS) como dependencia

#### Módulo Metas (MEJORA 7)
- `src/store/goals.ts` — store Zustand persistido en localStorage (`jas-goals`)
- `src/pages/GoalsPage.tsx` — metas mensuales con:
  - Barra de progreso para ventas y recaudo vs meta
  - Mes actual destacado
  - Historial de meses anteriores con % de cumplimiento
  - CRUD completo (crear, editar, eliminar)
- Nuevo tipo `MonthlyGoal` en `src/types/index.ts`

#### Permisos para nuevos módulos (MEJORA 8)
- `PermModule` extendido con `'finanzas'` y `'metas'`
- `usePermissions.ts` — mapeo de rutas, acciones y etiquetas para finanzas y metas
- Sidebar y MobileNav — iconos TrendingUp (Finanzas) y Target (Metas)
- `App.tsx` — rutas `/finanzas` y `/metas` con lazy loading

### Cambiado
- `src/utils/whatsapp.ts` — importa `formatDate` de formatters
- `DeliveriesPage` — assignableUsers ahora filtra por `u.active` en vez de hardcodear roles

---

## [1.3.0] — 2026-06-17 — Permisos personalizados por usuario

### Agregado
- `PermModule`, `PermAction`, `ModulePerms`, `UserPermissions` — nuevos tipos en `src/types/index.ts`
- Campo `permissions?: UserPermissions` en la interfaz `User`
- `src/hooks/usePermissions.ts` — completamente reescrito:
  - `can(module, action)` — verifica permisos granulares por módulo y acción
  - `canAccess(basePath)` — verifica acceso de vista a una ruta
  - `filterNavItems()` — filtra navegación según permisos `ver`
  - `PERMISSION_TEMPLATES` — plantillas reutilizables (admin, jennifer, alexis, vendedor, consulta)
  - `MODULE_ACTIONS` — definición de acciones disponibles por módulo para la UI
  - `ALL_MODULES`, `MODULE_LABELS` — utilidades para la matriz de permisos
- `src/pages/SettingsPage.tsx` — completamente reescrita con:
  - Lista de usuarios con toggle activo/inactivo (sin eliminar historial)
  - Modal de edición de usuario con campo de permisos embebido
  - Modal de permisos independiente con `PermissionsMatrix` completa
  - Botones: crear, editar, activar/desactivar, administrar accesos, eliminar — cada uno protegido por `can()`
  - Selector de plantillas de permisos para setup rápido
- Checks `can()` en páginas clave:
  - `ClientsPage`: oculta "Nuevo cliente" y botón Editar según permisos
  - `OrdersPage`: oculta "Nuevo pedido"
  - `PaymentsPage`: oculta "Registrar pago"
  - `ProductsPage`: oculta crear/editar/eliminar
  - `SuppliersPage`: oculta crear/editar/eliminar
  - `DeliveriesPage`: oculta controles de asignación y cambio de estado
- Migración SQL en `supabase/schema.sql` (sección v1.3):
  - `alter table app_users add column permissions jsonb`
  - RPC `login_user` actualizada para verificar `active = true`
  - `update` con permisos predeterminados por rol para usuarios existentes

### Cambiado
- `store/updateUser`: sincroniza `localStorage` cuando se actualizan los permisos del usuario activo
- Admin (`role = 'admin'`) omite verificación de permisos — acceso completo garantizado por código
- `AppLayout`: mensaje de "Acceso no autorizado" más claro

### Seguridad
- Usuarios inactivos (`active = false`) bloqueados en el login a nivel de RPC
- Solo admin o usuario con `configuracion.administrar_accesos` puede modificar permisos
- Dos niveles de enforcement: UI (ocultar elementos) + ruta (bloquear navegación)

---

## [1.2.5] — 2026-06-17 — Tests unitarios con Vitest

### Agregado
- `vitest` ^4.1.9 como dependencia de desarrollo.
- Scripts `"test": "vitest run"` y `"test:watch": "vitest"` en `package.json`.
- `vite.config.ts`: sección `test` con `globals: true`, `environment: 'node'`.
- `src/utils/businessLogic.ts`: módulo nuevo con las funciones puras de lógica
  de negocio extraídas del store y las páginas, para poder testarlas de forma aislada:
  - `calculateClientDebt(clientId, orders)` — deuda activa del cliente
  - `distributeFifo(amount, orders)` — distribución FIFO devuelve `FifoApplication[]`
  - `deriveClientStatus(client, orders)` — estado correcto según deuda real
- `src/utils/businessLogic.test.ts`: **20 tests** cubriendo los tres casos
  críticos del negocio (deuda, distribución FIFO, estado del cliente).
- `src/utils/formatters.test.ts`: **10 tests** para `calculateProfit`
  y `profitMargin`, incluyendo caso borde de división por cero.

### Modificado
- `src/store/index.ts`: importa `deriveClientStatus` desde `businessLogic.ts`
  en lugar de tenerla duplicada localmente.

### Resultado
```
Test Files  2 passed (2)
     Tests  30 passed (30)
  Duration  1.27s
```

**Cobertura de los 30 tests:**
- `calculateClientDebt`: 6 casos (sin pedidos, sin abonos, con abono, pagado, cancelado, múltiples pedidos)
- `distributeFifo`: 8 casos (monto 0, sin pedidos, pago parcial, pago exacto, FIFO correcto, dos pedidos, cubre todo, ya pagado, amountPaid previo)
- `deriveClientStatus`: 5 casos (al_dia, pendiente, mora, credito_cerrado, límite por defecto)
- `calculateProfit` + `profitMargin`: 9 casos (unitario, con cantidad, cero ganancia, negativo, margen, div/0, sin ganancias, redondeo)

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
