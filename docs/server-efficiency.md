# Optimización de caja y ventas · 13/10/2026

Se redujeron consultas y transferencia sin cachear permisos, caja ni confirmaciones bancarias.

| Operación | Antes | Ahora |
| --- | --- | --- |
| Consultar, abrir o cerrar caja | 2 consultas Supabase: autenticar y operar | 1 RPC con autenticación y operación |
| Preparar una venta | Catálogo completo paginado + configuración | 1 RPC: configuración y solo códigos relevantes |
| Pulsar Abrir caja | GET de comprobación antes de mostrar formulario | Estado ya cargado; POST comprueba vigencia atómicamente |
| Renderizar importes y fechas | Creación reiterada de formateadores | Formateadores reutilizados |
| Filtrar productos al actualizar el carrito | Recorrer catálogo en cada render | Resultado memorizado hasta cambiar catálogo o búsqueda |

Con catálogo menor a 1.000 productos, el registro en efectivo pasa de 5 a 4 llamadas a Supabase (sin contar la consulta posterior de caja, que pasa de 2 a 1). Con catálogos mayores se evitan además las páginas de productos. Estos son conteos de llamadas, no promesas de latencia ni porcentajes globales de consumo.

`tests/verify-cloud-auth.mjs` comprueba el número y tipo de consultas HTTP para lectura/escritura de caja y registro de efectivo. Se ejecuta con `VERCEL=1` y un servidor de Supabase simulado; las funciones SQL se validan separadamente con `tests/database/efficient-cash-and-sales.sql`, dentro de una transacción revertida.

`010_efficient_cash_and_sales.sql` incorpora los RPC y los índices para pendientes por vendedor y cierres por usuario. Aplicarla después de 009 antes de desplegar. Fue validada con sesión inválida, revocación, apertura/cierre y selección acotada de productos. Las claves de servidor mantienen acceso exclusivo a las funciones.

Se conserva la comprobación autoritativa de caja al reservar y guardar, la idempotencia y la verificación del banco. No se cambia el intervalo de confirmación QR ni su pasarela. La caja y los filtros no hacen sondeo periódico; las actualizaciones de caja se producen por acciones, cambios de ventas y al volver a una pestaña visible.

No se añadieron dependencias, servicios externos ni fuentes descargadas. Los módulos visuales conservan carga diferida y estilos CSS, sin bucles de animación nuevos.
