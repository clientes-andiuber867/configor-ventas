# Ejecución y alojamiento

Para caja local: `npm run build` y `npm start`, puerto 3000. Mantener el proceso abierto. Para cambiar código detenerlo, compilar y reiniciar. `npm run dev` es para desarrollo.

## Git y secretos

`.env.local`, `data/`, `node_modules/` y `.next/` están excluidos de Git. Publicar código, migraciones, documentación y archivos de dependencias; no respaldos ni imágenes bancarias. El token personal de administración de Supabase no es la clave usada por la aplicación.

Variables de servidor: `CONFIGOR_STORAGE=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. No usar prefijo `NEXT_PUBLIC` en la clave secreta.

## Hosting

La aplicación usa rutas Node.js de Next.js. El repositorio conectado dispara el
despliegue al hacer push a la rama de producción. Se conservan la raíz `./`,
las rutas `app/api`, el lockfile y `vercel.json` del proyecto existente.

1. Importar el repositorio en Vercel con framework **Next.js** y Root Directory **./**.
2. Usar Node.js **22.x**, instalación `npm ci` y build `npm run build`. Mantener Output Directory automático.
3. Añadir estas variables antes de desplegar:

| Variable            | Valor                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| CONFIGOR_STORAGE    | supabase                                                                                |
| SUPABASE_URL        | URL del proyecto Supabase activo                                                        |
| SUPABASE_SECRET_KEY | Clave secreta de servidor del proyecto, disponible en la instalación local `.env.local` |

4. Configurar los valores en Production; habilitarlos en Preview solo si esas versiones deben acceder a los datos reales. No usar el token personal `sbp_` ni una clave pública en lugar de la clave del servidor.
5. Desplegar y comprobar login, catálogo, escaneo, QR e historial. No repetir las migraciones sobre la base de datos ya configurada.

`vercel.json` sitúa las funciones en `iad1`, cerca de la base de datos en US East. El modo local se bloquea en Vercel para evitar guardados en archivos efímeros. Excel admite hasta 4 MB y QR hasta 2 MB para respetar el [límite de peticiones de Vercel](https://vercel.com/docs/functions/limitations). El código fija [Node.js 22.x](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

Cloudflare requiere adaptar y verificar Next.js mediante un adaptador compatible; no basta una exportación estática. Todavía no se ha validado esta plataforma.

## Operación

### Bloqueo de acceso local y en Vercel

Cada usuario dispone de 3 intentos de contraseña antes de un bloqueo. Las esperas
sucesivas son 5, 15, 30 y 60 minutos, y después se duplican hasta un máximo de
24 horas. Una contraseña correcta no permite entrar durante un bloqueo activo.
Al vencer la espera se habilitan otros 3 intentos; un acceso correcto reinicia la
progresión. Elegir un rol equivocado no cuenta como fallo de contraseña.

Con `CONFIGOR_STORAGE=supabase`, el servidor usa la tabla y funciones de
`007_login_attempts.sql`; no escribe archivos para controlar el login. La reserva
por intento evita que distintas instancias eludan el contador. RLS y permisos
restringen las funciones a la clave de servidor. La reserva vence en 60 segundos
si un proceso desaparece. No se necesita Redis ni variables nuevas.

Con `CONFIGOR_STORAGE=local`, usa `data/login-attempts.json` (o `CONFIGOR_DATA_DIR`),
excluido de Git, con hashes de usuario y sin contraseñas. Este adaptador es para
un solo proceso con disco persistente. Ambos conservan bloqueos al recargar o
cambiar de navegador; no hay sondeo periódico desde el cliente.

### Actualizar el proyecto conectado

1. Aplicar únicamente la migración 007 antes del código nuevo. Es aditiva y ya se
   aplicó a configor-database en esta actualización; no modifica ventas ni usuarios.
2. Ejecutar `npm ci` y `npm run verify` con Node 22.x.
3. Hacer push a `main`. Mantener las variables existentes de Supabase y del banco.
4. Esperar estado Ready en Vercel y comprobar la página y el acceso. Un build
   correcto por sí solo no confirma credenciales o conectividad en producción.
5. Si hay que revertir el código, usar el despliegue anterior. La tabla añadida
   puede permanecer: no interfiere con el código anterior. No borrar contadores
   como parte de un rollback rutinario.

Supabase es el origen activo. Un fallo de red no se muestra como cobro guardado. Reintentar conserva el UUID para evitar duplicar una venta cuya respuesta se perdió. El QR consulta al banco y exige confirmación bancaria para registrar la venta. Antes de publicar esta versión aplica las migraciones 004, 005 y 006 y configura las variables BANECO_*; consulta payments.md.

El adaptador local se conserva para pruebas y recuperación controlada. El respaldo anterior no incluye nuevas ventas de Supabase y no es un reemplazo automático.

## Variables de la pasarela

En Production configurar `BANECO_BASE_URL`, `BANECO_AES_KEY`, `BANECO_USER`, `BANECO_PASSWORD` y `BANECO_ACCOUNT` usando los valores privados de `.env.local`. No subir ese archivo al repositorio. Los endpoints de cobro y ventas declaran 60 segundos de duración máxima para las consultas bancarias. Los pagos y consecutivos persisten en Supabase, no en el disco efímero de Vercel.

### Migración 008: caja e historial

Para instalaciones nuevas, aplicar `008_cash_register.sql` tras 001–007 antes de usar el módulo de caja. En el Supabase conectado ya se aplicó el 13/10/2026; no repetir. Es aditiva y compatible con la versión anterior del cobro. No necesita variables de entorno nuevas. La interfaz sigue local hasta publicar el código. Consultar [operación de caja](cash-register.md).

### Publicación de caja y optimización (008–010)

Aplicar solo las migraciones pendientes, en orden: 008 agrega caja; 009 exige turno abierto; 010 agrupa consultas de caja y preparación de ventas. En el proyecto conectado ya quedaron aplicadas el 13/10/2026. No repetirlas. Mantener variables de Supabase y banco existentes. No se cambia la raíz, el framework ni la configuración de Vercel. Ver [eficiencia del servidor](server-efficiency.md).

### Publicación de ventas mayoristas (011)

La migración `011_wholesale.sql` quedó aplicada a configor-database el 14/10/2026:
clientes privados, relación de ventas, índice de historial y asociación del nombre
dentro de la transacción de venta. No repetirla en este proyecto. Para una
instalación nueva, aplicarla después de 001–010 y antes de publicar este código.
No requiere nuevas variables ni cambios en Vercel; conservar Node 22.x, `npm ci`,
`npm run build` y las credenciales existentes de Supabase y del banco.
