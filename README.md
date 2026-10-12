# CONFIGOR · Ventas

Sistema Next.js con Supabase para productos, usuarios, sesiones, ventas y configuración; QR en Storage privado. Puede ejecutarse localmente y requiere internet para consultar y guardar datos.

## Arranque

Node.js 22.13 o superior. Copiar `config/environment.example` a `.env.local` y completar las variables del servidor. La instalación actual ya está configurada.

```powershell
npm ci
npm run build
npm start
```

Abrir http://127.0.0.1:3000. Para desarrollo: `npm run dev`. Se conservan usuarios y contraseñas migrados; no hay registro público.

## Organización

Cada área tiene su carpeta en `features/`: `auth`, `catalog`, `pos`, `payments`, `sales`, `dashboard`, `users` y `workspace`. Contienen sus vistas y lógica correspondiente. `components/` contiene controles compartidos; `lib/supabase/` el acceso desde el servidor; `supabase/migrations/` el esquema y permisos SQL.

Se mantienen escaneo automático al carrito, cobro final confirmado por el cajero, efectivo/QR/mixto, resumen por períodos, importación Excel, comprobantes y anulación.

## Verificación

```powershell
npm run check
npm run build
npm test
```

Las pruebas locales usan datos temporales y puerto 3006. `scripts/verify-supabase.mjs` comprueba la instalación migrada; requiere `CONFIGOR_VERIFY_PASSWORD` y admite `CONFIGOR_TEST_URL`. No crea ventas nuevas: reintenta una existente para comprobar idempotencia.

## Documentación

- [Datos y migración](docs/database.md)
- [Rendimiento medido](docs/performance.md)
- [Ejecución y alojamiento](docs/deployment.md)

La web confirma lecturas del escáner, pero no siempre su conexión física. El cajero verifica el abono bancario manualmente. El comprobante es interno.
