# Arquitectura y mantenimiento

CONFIGOR es una aplicación Next.js App Router con módulos por función de negocio.
Se conservan `app/`, `public/`, `package.json`, `package-lock.json` y `vercel.json`
en la raíz para mantener la detección y las rutas del proyecto existente de Vercel.

## Mapa del proyecto

| Carpeta | Responsabilidad |
| --- | --- |
| `app/` | Entradas Next.js, layout, metadatos y adaptadores HTTP. No colocar lógica de negocio aquí. |
| `features/auth/` | Login, sesión, contraseña, interfaz de acceso y protección de intentos. |
| `features/catalog/` | Productos, lectura Excel/CSV, importación y repositorio del catálogo. |
| `features/pos/` | Escaneo, vista de caja y entrada manual al carrito. |
| `features/payments/` | Banco, QR, persistencia de cobros, cancelación y hook de flujo de pago. |
| `features/sales/` | Registro/anulación de ventas, repositorio y comprobantes con estilos de impresión. |
| `features/users/` | Administración, permisos y repositorio de usuarios. |
| `features/dashboard/` | Vista de resumen y agregaciones de ventas. |
| `features/workspace/` | Composición de módulos, navegación, estado compartido y contrato del panel. |
| `components/ui/` | Primitivas de interfaz compartidas. |
| `components/shared/` | Componentes usados por varias funciones, como tablas. |
| `lib/` | Tipos y reglas transversales, almacenamiento local y utilidades HTTP/Supabase. |
| `hooks/` | Hooks generales independientes del negocio. |
| `styles/` | Variables de marca y estilos compartidos del panel. |
| `supabase/migrations/` | Migraciones SQL ordenadas e inmutables una vez aplicadas. |
| `tests/` | Pruebas automatizadas y fixtures; `tests/database/` contiene pruebas SQL transaccionales. |
| `scripts/` | Operación y migración de datos; leer cada script antes de ejecutarlo. |
| `docs/` | Arquitectura, despliegue, operación y mediciones. |
| `config/` | Ejemplo de variables sin credenciales. |
| `public/` | Archivos públicos. Nunca guardar aquí datos privados. |
| `assets/` | Originales de diseño que no se sirven durante el login. |

## Convenciones de cada módulo

- `view.tsx`: pantalla principal; `*Dialog.tsx`: diálogo específico.
- `use-*.ts`: comportamiento del navegador y estado de una función concreta.
- `service.ts`: reglas de negocio del servidor.
- `repository.ts`: acceso a los datos del módulo, con adaptador local/Supabase.
- `route-handler.ts`: autorización, validación de entrada y respuesta HTTP.
- `types.ts`: contratos compartidos que no contienen código del servidor.
- `*.css`: estilos que pertenecen a esa función.

Crear solo las capas necesarias; un módulo pequeño no necesita archivos vacíos.
Importar archivos concretos con `@/features/...`, evitando barriles que mezclen
código de cliente y servidor. Los repositorios usan `server-only`.

## Dependencias y límites

`app/api/*/route.ts` exporta runtime y handlers; las URLs permanecen iguales.
Los handlers llaman servicios/repositorios después de validar sesión y permisos.
`lib/supabase/client.ts` solo conoce transporte; `queries.ts` contiene constructores
de consultas. Cada módulo posee sus operaciones de datos; no existe un repositorio
central que haya que editar para todos los cambios.

`workspace/use-workspace.ts` coordina estado compartido de catálogo, carrito y
navegación. El flujo QR, recuperación de borradores, consulta bancaria y cancelación
vive en `payments/use-payment-flow.ts`. Comparten la referencia de exclusión de
operaciones para evitar una importación simultánea con el registro de venta.
Las vistas aún reciben el contrato `AppState`: es una frontera explícita de
composición, no una duplicación de estados por pantalla.

`app/globals.css` fija el orden de las hojas: tema, panel, pagos y comprobantes.
El login importa su CSS en `features/auth/login.tsx`. No cambiar el orden de las
hojas sin revisar los diálogos y la impresión.

## Seguridad de acceso

`auth/login-throttle.ts` selecciona el adaptador según `CONFIGOR_STORAGE`.
En Supabase, la migración 007 usa una fila por identificador hash y una reserva
temporal exclusiva por intento. Las funciones SQL bloquean esa fila al actualizar,
por lo que distintas instancias de Vercel respetan el mismo contador. Una reserva
abandonada vence en 60 segundos; una respuesta antigua no puede reiniciar un intento
nuevo. Solo `service_role` puede ejecutar las funciones. Si la persistencia falla,
no se devuelve una sesión al navegador.

El modo local conserva archivo atómico y cola acotada. Se usa exclusivamente en
una instalación de un proceso con disco persistente. No trasladar este archivo a
`/tmp` como sustituto de la protección compartida en Vercel.

## Añadir una función

1. Elegir el módulo dueño del cambio o crear `features/<funcion>/` si es independiente.
2. Añadir tipos y reglas en ese módulo; compartir en `lib/` solo lo transversal.
3. Para datos nuevos, crear la siguiente migración numerada con RLS y permisos.
4. Añadir repositorio y servicio; validar entradas y permisos en el handler.
5. Integrar vista/hook desde workspace. Cargar pantallas y diálogos pesados bajo demanda.
6. Añadir pruebas del comportamiento, actualizar documentación y ejecutar `npm run verify`.
7. Aplicar primero las migraciones aditivas; después publicar el código. Revisar Vercel.

Nunca guardar secretos en Git, datos de pruebas en producción ni lógica bancaria
en el navegador. La confirmación del banco y el cálculo de importes se verifican
en el servidor aunque el cliente ya los muestre.

## Caja e historial diario

Ver [Caja y punto de venta](cash-register.md). El módulo `features/cash-register/` agrupa interfaz, validación HTTP y repositorio. `008_cash_register.sql` agrega turnos y limita el historial del vendedor en el RPC existente. No modifica los archivos de la pasarela.
