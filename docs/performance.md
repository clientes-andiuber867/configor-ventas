# Rendimiento

Suma de todos los archivos JavaScript de `.next/static`, comprimiendo cada archivo con gzip. No representa la descarga inicial ni el tamaño total del servidor.

| Métrica                             |           Antes |       Después |
| ----------------------------------- | --------------: | ------------: |
| JavaScript sin comprimir            | 1.329.718 bytes | 863.469 bytes |
| JavaScript gzip                     |   418.523 bytes | 273.337 bytes |
| Dependencias directas de producción |              25 |            12 |

Reducción aproximada del JavaScript comprimido: **35 %**. Datos en `performance.json`.

## Cambios

- Vistas y diálogos cargados cuando se necesitan.
- Procesamiento de Excel en el servidor; el navegador no descarga esa librería.
- Eliminación de componentes y dependencias sin uso.
- Resumen en una pasada y memorizado para no recalcular en cada tecla del escáner.
- Una función SQL para cargar el panel; cambiar fechas consulta solo ventas del período.
- Guardado por registro; el cobro devuelve el comprobante sin recargar la aplicación.
- Índices para fechas, vendedores y sesiones; importación por lotes.
- QR con URL versionada y caché privada.
- Verificación de contraseñas asíncrona.

En una verificación con conexión caliente, el panel tardó 254 ms y el período 257 ms. Son muestras de esta conexión, no garantías de latencia. Escaneo y carrito usan el catálogo cargado; guardar requiere Supabase.
