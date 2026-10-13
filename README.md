# CONFIGOR · Ventas

Sistema Next.js con Supabase para productos, usuarios, sesiones, ventas y configuración; QR dinámico mediante Banco Económico. Puede ejecutarse localmente y requiere internet para consultar y guardar datos.

## Arranque

Node.js 22.x, versión 22.13 o posterior. Copiar `config/environment.example` a `.env.local` y completar las variables del servidor. Nunca subir ese archivo a Git.

```powershell
npm ci
npm run build
npm start
```

Abrir http://127.0.0.1:3000. Para desarrollo: `npm run dev`. Se conservan usuarios y contraseñas migrados; no hay registro público.

## Organización

Cada área tiene su carpeta en `features/`: `auth`, `catalog`, `pos`, `payments`, `sales`, `dashboard`, `users` y `workspace`. Contienen sus vistas y lógica correspondiente. `components/` contiene controles compartidos; `lib/supabase/` el acceso desde el servidor; `supabase/migrations/` el esquema y permisos SQL.

Los repositorios pertenecen a cada módulo. El flujo de cobros vive en
`features/payments/use-payment-flow.ts`; `workspace` compone las funciones.
`styles/` contiene tema y estilos comunes; pagos, comprobantes y login tienen sus
propias hojas. Consultar [arquitectura y mantenimiento](docs/architecture.md).

Se mantienen escaneo automático al carrito, cobro final confirmado por el cajero, efectivo/QR/mixto, resumen por períodos, importación Excel, comprobantes y anulación.

## Verificación

```powershell
npm run verify
```

Las pruebas usan datos temporales, puertos 3006/3007 y servicios simulados. Incluyen
el modo Vercel sin escrituras al disco. Ver [pruebas](docs/testing.md).

## Documentación

- [Datos y migración](docs/database.md)
- [Índice completo](docs/README.md)
- [Arquitectura](docs/architecture.md)
- [Pruebas y CI](docs/testing.md)
- [Rendimiento medido](docs/performance.md)
- [Ejecución y alojamiento](docs/deployment.md)

La web confirma lecturas del escáner, pero no siempre su conexión física. El banco confirma automáticamente el pago QR antes de habilitar el registro de la venta. El comprobante es interno.

## Pasarela QR

En una instalación nueva, aplicar las migraciones 001 a 007 en orden. En el
proyecto existente, aplicar solo las pendientes: la 007 añade los bloqueos del
login compartidos entre instancias. Ya fue aplicada al proyecto configor-database
durante esta actualización. No se necesitan variables nuevas en Vercel.
Configurar `BANECO_*` con las credenciales bancarias existentes para QR.
Consultar [despliegue](docs/deployment.md) y [pagos](docs/payments.md).
