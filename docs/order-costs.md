# Costos por pedido

Calculadora independiente para administradores. Cada concepto contiene nombre,
costo unitario en Bs y cantidad entera por pedido. El total es la suma de costo
por cantidad; los importes se calculan en centavos para evitar errores decimales.
Ejemplo: una bolsa a Bs 0,20 y una etiqueta a Bs 0,10 suman Bs 0,30.

Los conceptos pueden añadirse, editarse y quitarse. La última eliminación puede
deshacerse antes de guardar. Se admiten hasta 100 conceptos, costos de 0 a
Bs 100.000 y cantidades de 1 a 10.000 por concepto. Los datos incompletos no
se presentan como un total válido y no pueden guardarse.

El módulo calcula localmente y solo consulta al abrir o recargar. Guarda al pulsar
Guardar costos. Conserva los cambios al navegar por los apartados de la sesión
y avisa al cerrar o recargar con cambios pendientes. No escribe en productos,
precios, ventas, caja, pagos ni formato de balanza.

Persistencia en la fila `order_costs` de `configor_settings`, tabla privada ya
existente en Supabase. No necesita migraciones ni variables nuevas. La fila se
crea en el primer guardado. Un identificador de versión evita sobrescribir cambios
guardados desde otra sesión: en caso de conflicto, se pide recargar. La API
`/api/costs` exige administrador para lectura y escritura. Las pruebas locales
verifican cálculo, permisos, persistencia, conflictos e independencia del sistema.
