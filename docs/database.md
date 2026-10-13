# Datos y migración

Proyecto: configor-database. Migración inicial verificada: 41 productos, 2 usuarios, 1 venta, configuración, sesiones vigentes e imagen QR. Se compararon registros y bytes de la imagen con el origen local.

## Modelo

Los repositorios se encuentran en `features/<modulo>/repository.ts`. El cliente
de transporte y constructores REST permanecen en `lib/supabase/`.

- `configor_login_attempts` (migración 007): hash del usuario, contador, nivel,
  fecha de desbloqueo y reserva temporal exclusiva. Funciones `configor_login_claim`
  y `configor_login_complete`, solo para service_role. No guarda contraseñas.

- `configor_products`: código textual, PLU, nombre, precio y modo.
- `configor_members`: usuario, nombre, rol, estado y hash scrypt. Conserva acceso por usuario; no usa Supabase Auth.
- `configor_sessions`: hash del token, usuario y vencimiento; cookie HttpOnly.
- `configor_sales`: UUID, fecha, vendedor, importes enteros, detalle, estado y motivo de anulación.
- `configor_settings`: propietario, formato de etiquetas y pagos.
- Bucket privado `configor-payments`: imagen bancaria entregada mediante ruta autenticada.

Las tablas tienen RLS y no conceden acceso a anon/authenticated. El servidor valida sesión y rol antes de operar con la clave secreta, que nunca se entrega al navegador. Las funciones RPC están restringidas a service_role.

Las ventas tienen restricciones y un trigger que comprueba importes del detalle. El UUID evita duplicados al reintentar el mismo cobro. Cambiar contraseña, desactivar o cambiar rol revoca sesiones. Se protege al administrador principal. La función del panel comprueba sesión y devuelve ventas del período solicitado.

## Reproducir en un proyecto vacío

1. Aplicar en orden `supabase/migrations` con una conexión administrativa.
2. Configurar `.env.local` con URL y clave secreta del servidor.
3. Respaldar `data/`.
4. Ejecutar `node scripts/migrate-supabase.mjs`. Detecta conflictos y verifica registros; no es sincronización continua.
5. Compilar, iniciar y comprobar acceso, catálogo, etiquetas, QR e historial.

La copia anterior permanece en `data/backups/`, excluida de Git. Desde la migración, el JSON local deja de actualizarse. No cambiar a modo local para seguir vendiendo si falla internet: produciría dos historiales separados.

Referencias: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [claves API](https://supabase.com/docs/guides/api/api-keys), [Storage](https://supabase.com/docs/guides/storage/buckets/fundamentals).
