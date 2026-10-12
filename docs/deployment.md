# Ejecución y alojamiento

Para caja local: `npm run build` y `npm start`, puerto 3000. Mantener el proceso abierto. Para cambiar código detenerlo, compilar y reiniciar. `npm run dev` es para desarrollo.

## Git y secretos

`.env.local`, `data/`, `node_modules/` y `.next/` están excluidos de Git. Publicar código, migraciones, documentación y archivos de dependencias; no respaldos ni imágenes bancarias. El token personal de administración de Supabase no es la clave usada por la aplicación.

Variables de servidor: `CONFIGOR_STORAGE=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. No usar prefijo `NEXT_PUBLIC` en la clave secreta.

## Hosting

La aplicación usa rutas Node.js de Next.js. El código está preparado para Vercel; el despliegue se realiza desde su panel.

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

Supabase es el origen activo. Un fallo de red no se muestra como cobro guardado. Reintentar conserva el UUID para evitar duplicar una venta cuya respuesta se perdió. El QR no confirma automáticamente el pago bancario.

El adaptador local se conserva para pruebas y recuperación controlada. El respaldo anterior no incluye nuevas ventas de Supabase y no es un reemplazo automático.
