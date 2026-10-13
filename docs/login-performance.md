# Optimización del acceso local

Se mantiene la página estática de Next.js y una comprobación de sesión al abrirla.
No hay consultas periódicas al servidor: la cuenta regresiva se calcula en el
navegador. No se cachean contraseñas, sesiones ni decisiones de autorización.

## Mediciones de la compilación

| Recurso | Antes | Después |
| --- | ---: | ---: |
| Imágenes usadas por el login | 943.062 bytes | 69.460 bytes |
| Archivos JavaScript referenciados por el HTML inicial | 8 | 7 |
| Suma de esos archivos, sin comprimir | 616.321 bytes | 581.958 bytes |
| Suma comprimida con gzip para comparación | 188.394 bytes | 179.171 bytes |

Las cifras JavaScript incluyen el runtime de React/Next. No representan todo el
tráfico posterior ni una medición de CPU en el futuro hosting. Las imágenes WebP
se generaron una vez, conservando los originales; no se transforman en el servidor
durante las visitas. Sus nombres contienen un hash y se sirven con caché de un año.

## Trabajo evitado

- La cuenta regresiva solo actualiza su aviso, sin renderizar todo el formulario.
  Su temporizador se detiene al terminar el bloqueo y al ocultar la pestaña.
- Las animaciones se pausan al ocultar la pestaña. Se conserva la preferencia de
  movimiento reducido y las animaciones usan transformaciones CSS.
- Las notificaciones se cargan cuando se necesitan; el panel se empieza a cargar
  durante la confirmación de acceso correcto.
- Un acceso correcto sin fallos anteriores no reescribe el archivo de bloqueos.
- La limpieza de sesiones vencidas de Supabase se realiza como máximo una vez
  por hora y proceso, al iniciar sesión. Los accesos posteriores requieren dos
  operaciones de datos para autenticar y guardar sesión, en lugar de tres,
  además de las dos RPC de reserva/finalización del bloqueo compartido añadidas
  para Vercel. Un intento ya bloqueado requiere solo la RPC de reserva.
  La validación de vencimiento sigue ocurriendo en cada autorización.
- La cola de autenticación admite como máximo ocho solicitudes pendientes. El
  exceso recibe HTTP 503 con Retry-After, evitando una cola ilimitada. Se conserva
  scrypt y los bloqueos progresivos; los bloqueos activos se revisan antes de
  consultar usuarios o calcular contraseñas.

Verificación: TypeScript, compilación de producción, pruebas aisladas de acceso,
bloqueos, concurrencia y reinicio de contadores; comprobación de que un acceso
limpio no modifica el archivo de bloqueos; revisión visual y de cabecera de caché.
Las cifras de tamaño corresponden a la optimización anterior a la modularización.
La cola local se usa solo con `CONFIGOR_STORAGE=local`. En Supabase la migración
007 reemplaza el archivo por protección compartida; ver deployment.md.
