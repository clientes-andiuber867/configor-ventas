# Pasarela de Banco Económico

## Activación

La migración 004 ya fue aplicada y verificada en el proyecto Supabase de esta instalación el 12 de octubre de 2026. Se conservaron las ventas existentes; la tabla de cobros tiene RLS y bloquea acceso directo público. Los pasos siguientes son para instalaciones nuevas.

1. En el proyecto Supabase existente, ejecutar `supabase/migrations/004_dynamic_payments.sql` con el SQL Editor o una conexión de administración. Es aditiva: crea la tabla privada de cobros, su secuencia y dos columnas en ventas, sin modificar las ventas anteriores. La clave REST de la aplicación no permite aplicar DDL.
2. Configurar BANECO_BASE_URL, BANECO_AES_KEY, BANECO_USER, BANECO_PASSWORD y BANECO_ACCOUNT en el servidor. Las credenciales de la pasarela proporcionada se copiaron a `.env.local`, excluido de Git. Para Vercel deben configurarse allí antes del despliegue. Nunca usar NEXT_PUBLIC para ellas.
3. Compilar y reiniciar Configor. El modo local crea su registro automáticamente; en Supabase la migración es obligatoria también para las nuevas ventas en efectivo.

## Cobro

Al seleccionar QR se genera automáticamente el cobro con el total exacto. En pago mixto, introducir el efectivo y pulsar «Generar QR del saldo». El banco recibe BOB, monto fijo, uso único y descripción/referencia C000001, C000002, etc. Son identificadores internos de compra, no números de factura fiscal. Desde la migración 006, el número definitivo C se asigna atómicamente al guardar la venta pagada. Los QR cancelados, fallos y reintentos no consumen números. Cada intento bancario usa un identificador interno Q único; su descripción muestra el próximo número C previsto. Si varias cajas cobran simultáneamente, el número definitivo depende del orden de guardado y puede diferir del previsto. Una venta ya registrada que luego se anula conserva su número. Las ventas en efectivo también reciben referencia. Las antiguas conservan su identificador anterior.

Configor consulta el estado cada tres segundos, muestra la confirmación del banco y permite guardar la venta. El servidor también exige dicha confirmación: una marca manual o una petición modificada no basta. En el comprobante y la exportación se conserva la referencia. Una anulación de venta en Configor no efectúa una devolución bancaria.

El monto y carrito quedan bloqueados tras solicitar el QR. Cerrar la ventana permite retomar el cobro original. «Cancelar cobro y editar venta» verifica que no esté pagado y anula el QR con el banco antes de desbloquear productos. Cambiar el método a efectivo hace la misma anulación y asigna una referencia nueva. Cancelar no registra ninguna venta. Si el pago llega durante la anulación, se conserva el cobro pagado para guardar la venta. Se requiere la migración 005.

Un borrador en sessionStorage permite recuperarlo al recargar la misma pestaña. No cerrar definitivamente la pestaña con un cobro pendiente; no hay listado de conciliación de cobros pendientes en esta versión.

Si el banco confirmó el pago pero falló el guardado, retomar y guardar de nuevo: la referencia y UUID evitan duplicados. Si no se obtiene la respuesta de generación, no se solicita otro QR automáticamente, porque no está documentada la idempotencia de generación. La anulación de un QR recibido usa DELETE /api/qrsimple/cancelQR, documentado en la sección 6.3 del manual API Market. Revisar la referencia con el banco antes de iniciar otro cobro. Un proceso interrumpido durante generación puede quedar en «generating» y requiere conciliación. No se ofrecen anulaciones bancarias ficticias.

## Verificación

`npm run check`, `npm run build` y `npm test`. Las pruebas levantan un banco simulado y una instalación local aislada; verifican QR completo/mixto, descripción, concurrencia, acceso por cajero, importes incorrectos y confirmación bancaria. No generan cobros reales. Se verificó conectividad HTTPS con el dominio bancario, manteniendo validación de certificados.

La conexión bancaria sigue el protocolo del proyecto Pasarela de Pagos aportado por el usuario. Se requiere una prueba operativa del primer pago real después de aplicar la migración y desplegar. La suite no sustituye esa validación.

Migración 006 aplicada en Supabase. La numeración consecutiva, cancelaciones, reintentos y ventas concurrentes se verificaron con la suite local aislada.
