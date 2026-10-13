# Verificación

Usar Node.js 22.x (22.13 o posterior; la validación actual usa 22.23.3).

```sh
npm ci
npm run verify
```

`verify` ejecuta TypeScript, compilación de producción y todas las pruebas locales.
`npm test` necesita una compilación previa. No usar las pruebas contra la caja real.

| Archivo | Qué verifica |
| --- | --- |
| `tests/verify-storage.mjs` | Escritura atómica, bloqueos de Windows y conservación de datos ante fallos. |
| `tests/verify-catalog.mjs` | CSV, modos, códigos y duplicados. |
| `tests/verify-local.mjs` | Login, bloqueos, permisos, importación, ventas, concurrencia y QR con banco simulado. |
| `tests/verify-cloud-auth.mjs` | API de autenticación con `VERCEL=1`, Supabase simulado y ruta de disco no escribible; sesiones, bloqueos y fallo de persistencia. |
| `tests/database/login-throttle.sql` | Funciones reales de la migración 007: progresión, exclusión por reserva, vencimiento y permisos. Revierte sus filas con ROLLBACK. |

Las suites Node usan los puertos 3006 y 3007, contraseñas aleatorias y carpetas
únicas bajo `tests/.local-data/`, ignoradas por Git. No generan cobros reales.
Las pruebas SQL se ejecutan con acceso administrativo después de aplicar la
migración; no forman parte del comando local ni necesitan secretos en CI.

`scripts/verify-supabase.mjs` es una comprobación operativa separada: requiere
`CONFIGOR_VERIFY_PASSWORD` y puede reintentar una venta existente. No ejecutarlo
automáticamente en cada build. La validación bancaria real requiere un flujo
operativo controlado, descrito en payments.md.

El workflow de GitHub usa Ubuntu y Node 22, instala con el lockfile y ejecuta
`npm run verify`. No necesita secretos de Supabase ni del banco. Vercel conserva
su build de Next.js y las variables existentes del proyecto.
