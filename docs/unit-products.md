# Productos por unidad

En Base de datos, **Productos por unidad → Añadir producto** permite guardar
nombre, código completo (4–16 dígitos, incluidos ceros iniciales) y precio en Bs.
Solo el administrador puede guardar o editar productos. El código queda fijo al
editar; nombre y precio pueden actualizarse.

El lector debe terminar la lectura con Enter o Tab, o se puede usar Añadir.
Cada lectura incorpora una unidad al precio del catálogo. Repetir la lectura
añade otra unidad. Puede mezclarse con etiquetas de balanza en ventas normales
o mayoristas. No se registra peso para estos artículos ni se cuentan como peso
desconocido en el resumen. El comprobante indica “1 unidad”.

El escaneo es local, sobre el catálogo ya cargado. Al cobrar, el servidor valida
código exacto, precio y ausencia de peso en la misma consulta de contexto usada
para los productos de balanza. Si el precio cambió, se debe quitar y volver a
escanear el artículo. No se permite alterar su importe manualmente.

La importación Excel sigue destinada exclusivamente a productos de balanza.
Ambos tipos comparten códigos únicos: si una importación contiene un código de
producto por unidad se rechaza completa, sin sobrescribirlo. Las escrituras se
protegen también en Supabase para evitar cambios de tipo concurrentes.

**Configuración de la balanza** es funcional y queda plegada por defecto. Su
formato sigue interpretando producto, peso e importe tanto en el cliente como en
el servidor. Los productos por unidad usan coincidencia exacta del código y no
dependen de este formato.

`npm run verify` incluye casos de permisos, códigos duplicados entre tipos,
precio fijo, manipulación de importes, carritos mixtos, lecturas repetidas y
totales de caja. `tests/database/unit-products.sql` se ejecuta con rollback.
