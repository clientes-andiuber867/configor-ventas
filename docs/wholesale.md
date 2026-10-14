# Ventas mayoristas

La sección **Ventas mayoristas** reúne perfiles de clientes. El administrador crea
el perfil con nombre y teléfono opcional. Administradores y vendedores pueden abrir
un perfil, escanear etiquetas y cobrar mediante el flujo existente de caja.

El precio, importe y peso se leen del código de la balanza y se validan de nuevo en
el servidor. No se aplican descuentos ni se calculan precios mayoristas. Las
etiquetas sin importe no admiten entrada manual en este apartado.

Cada venta guarda `wholesale_customer_id` y una copia del nombre del cliente. El
nombre también aparece en el comprobante, el historial general y la exportación
CSV. Las ventas siguen sumando en la misma caja y en el resumen del negocio. Las
anulaciones conservan la relación con el cliente y dejan de sumar en caja.
El historial general permite combinar el tipo de venta (todas, al público o
mayoristas) con el período y la forma de pago. El filtro se aplica a los datos ya
cargados, sin peticiones adicionales, y también a la exportación CSV. No modifica
los totales del resumen: ambas clases de venta siguen sumando en el período.

El administrador consulta todo el historial del cliente. Se mantiene la política
existente para vendedores: solo ven las ventas del día de Bolivia. Solo un
administrador puede crear clientes, validado por el servidor.

## Persistencia y rendimiento

Aplicar `supabase/migrations/011_wholesale.sql` después de las migraciones 001–010.
La migración añade la tabla privada de clientes, la clave foránea y un índice
compuesto para el historial por cliente. Preserva los bloqueos transaccionales,
la numeración y los reintentos de las ventas actuales. El nombre del comprobante
se obtiene en la transacción de venta, nunca del texto enviado por el navegador.

El directorio solicita 24 perfiles por página y la búsqueda espera 300 ms después
de escribir. El historial consulta 20 ventas por página mediante un cursor de
fecha e ID; no descarga todo el historial ni ejecuta conteos globales. No hay
sondeo periódico para clientes o historial. Las peticiones pendientes se cancelan
al salir de la vista. El punto de venta se carga cuando se abre un perfil.
Las pestañas conservan su estado para no volver a consultar la caja al alternarlas.
La última página del directorio y del historial se reutiliza durante 30 segundos
en la vista abierta. Crear un cliente, registrar o anular una venta y actualizar
manualmente invalidan los datos correspondientes. No se comparte caché entre sesiones.

El cliente forma parte de la huella del cobro QR y del borrador recuperable en
`sessionStorage`. No puede cambiarse de cliente ni pasar al punto de venta normal
mientras haya artículos, un cobro o una operación pendientes.

## Verificación

`npm run verify` incluye `tests/wholesale-cases.mjs` dentro de la suite local:
permisos, validación de etiquetas, reintentos, separación entre clientes y ventas
normales, cobro mixto con banco simulado, anulaciones, totales de caja y paginación
con fechas repetidas. No utiliza ventas reales.

`tests/database/wholesale.sql` comprueba permisos, RLS y la transacción de venta.
Ejecutar siempre dentro de `BEGIN` / `ROLLBACK`, para no conservar datos de prueba.
