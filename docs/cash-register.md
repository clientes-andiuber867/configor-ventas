# Caja y punto de venta

## Uso

Cada usuario tiene un turno de caja independiente. En **Punto de venta → Abrir caja**, cuenta el efectivo disponible (fondo para cambio) e introdúcelo en bolivianos, incluido cero. Puedes añadir observaciones.

Las ventas nuevas de ese usuario se vinculan automáticamente al turno abierto. Las ventas anteriores a la apertura no se incorporan: el importe inicial ya representa el dinero existente. Es obligatorio abrir caja antes de vender. Sin turno abierto se deshabilitan el lector, la entrada manual y el cobro; el servidor rechaza nuevas ventas y reservas QR. Las ventas históricas sin turno conservan sus datos. Al abrir caja se habilita y enfoca automáticamente el lector.

Para cerrar, termina o cancela la venta actual, pulsa **Cerrar caja** y cuenta solo el efectivo físico. El sistema calcula:

- Efectivo esperado = fondo inicial + parte en efectivo de ventas completadas del turno.
- Los pagos mixtos aportan únicamente su parte en efectivo; el QR se muestra separado.
- Diferencia = efectivo contado − efectivo esperado. Negativo indica faltante; positivo, sobrante.
- Con diferencia se requiere una observación; si cuadra, es opcional.

No hay movimientos de retiro/ingreso ni devoluciones bancarias automáticas. Si retiras efectivo durante el turno, registra el motivo en las observaciones del cierre. Un cierre guarda una fotografía inmutable de los importes: una anulación posterior no cambia ese arqueo ni mueve dinero. Los cobros QR pendientes deben completarse o cancelarse antes de cerrar. El módulo no modifica la pasarela ni ejecuta operaciones bancarias.

El botón de historial de caja muestra los últimos 50 cierres para el administrador. Los vendedores ven sus propios cierres del día. Cada usuario abre y cierra únicamente su turno; un administrador puede consultar los cierres de todos.

## Ventas y permisos

Los vendedores reciben únicamente las ventas del día actual en Bolivia (UTC−4), aunque modifiquen parámetros HTTP. Pueden ver las ventas del día de todos los vendedores, como antes. El administrador conserva períodos personalizados y **Todo el historial**. Al cambiar de día, la sesión del vendedor limpia la selección y actualiza su historial; no hay sondeo periódico.

Los filtros **Todos / Efectivo / QR / Mixto** se aplican en memoria; no hacen peticiones ni afectan al resumen. El CSV respeta el filtro seleccionado.

## Persistencia y rendimiento

Módulo `features/cash-register`, entrada `app/api/cash-register/route.ts`. Sin dependencias adicionales, fuentes descargadas ni animaciones continuas. Se carga con el punto de venta. La caja se consulta al entrar, actualizar ventas, consultar cierres y preparar el arqueo; no tiene intervalos de sondeo. El servidor recalcula los totales al confirmar el cierre.

Local: `cashSessions` dentro del archivo de datos, con la cola y escritura atómica existente. Supabase: migración **008_cash_register.sql**, tabla con RLS y funciones accesibles solo por `service_role`. Un índice único impide dos cajas abiertas por usuario; el bloqueo transaccional por usuario serializa aperturas, cierres y asignación de ventas. Se mantienen las rutas y funciones bancarias existentes.

Las solicitudes de apertura/cierre usan UUID para soportar reintentos sin duplicar registros. El cliente nunca decide los totales esperados. Los importes se guardan en centavos enteros y las notas tienen límite de 1.000 caracteres.

## Verificación

`npm run verify`: compilación, tipos y pruebas de regresión de pagos, permisos e historial; apertura/cierre idempotentes, propiedad del turno, saldo cero, pagos mixtos, anulación, diferencias y QR pendiente. `tests/database/cash-register.sql` se ejecuta dentro de `BEGIN`/`ROLLBACK` después de la migración para validar el adaptador SQL sin dejar datos de prueba.

La migración 008 fue aplicada al Supabase conectado el 13/10/2026 después de probarla en una transacción revertida. No repetirla en esa base. Para otra instalación, aplicar 001–008 en orden antes de iniciar esta versión.

### Apertura obligatoria (migración 009)

`009_require_open_cash.sql` agrega operaciones de reserva y registro que verifican el turno con el mismo bloqueo que el cierre. Una reserva QR, incluso antes de recibir la respuesta del banco, impide cerrar caja hasta completarla o cancelarla. Los reintentos de ventas ya guardadas siguen siendo idempotentes. La comunicación con el banco no cambia. Las pestañas sincronizan cambios de caja mediante BroadcastChannel y actualizan al volver a estar visibles, sin sondeo periódico.

Migración 009 aplicada al Supabase conectado el 13/10/2026 tras pruebas transaccionales revertidas. Para nuevas instalaciones aplicar 001–009. Pruebas SQL adicionales: `tests/database/require-open-cash.sql`.

### Consultas agrupadas (010)

La ruta de caja usa `configor_cash_workspace`: autentica y ejecuta dentro de una sola llamada a Supabase. `configor_sale_context` trae solo los productos necesarios y su configuración. Aplicar 001–010 en instalaciones nuevas; 010 ya está aplicada al proyecto conectado. La pantalla conserva actualización al preparar el cierre y la confirmación siempre recalcula importes. Abrir el formulario usa el estado cargado y el POST valida de nuevo atómicamente.
