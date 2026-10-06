# CONFIGOR · Sistema de ventas

Aplicación web con identidad CONFIGOR en negro y rojo. Vinext/React, Cloudflare D1 para registros y R2 para el QR bancario.

## Funciones
- Resumen por fechas en horario de Bolivia: ingresos, ventas, kilos registrados, ticket medio, productos por ingresos y distribución efectivo/QR.
- Caja por lector USB en modo teclado con Enter. No se afirma una conexión física: se indica cuándo hubo una lectura recibida.
- Códigos de producto, EAN-8 validado y formato extendido configurable. La regla extendida inicia desactivada hasta comprobar una etiqueta real.
- Importación XLSX, CSV y TSV, con revisión, validación de duplicados y ceros iniciales. XLS antiguos deben convertirse a XLSX.
- Cobros en efectivo con cambio, QR y mixtos. Importes en centavos y pesos en gramos. El QR es una imagen bancaria reutilizable; requiere verificación manual del abono.
- Historial, comprobante interno imprimible de 80 mm, exportación CSV y anulación con motivo.
- Roles administrador/cajero validados en servidor. El cajero puede registrar y consultar ventas; solo el administrador importa, configura, administra usuarios y anula.

## Acceso
Sites proporciona el inicio de sesión. En la publicación privada entra solo el propietario. El primer propietario autenticado queda como administrador principal. Para acceso real de empleados deben habilitarse los destinatarios en Sites además de registrar sus correos en Usuarios. Agregar una fila en Usuarios no abre el sitio privado.
El entorno local usa la identidad de prueba del starter, seedy@sites.test. Este mecanismo no se incluye en la publicación.

## Inicio
npm install
npm run dev

La vista previa usa http://127.0.0.1:5173. Para preparar una base local nueva:
1. npm run db:generate (solo si cambia el esquema).
2. npm run build.
3. node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_cloudy_warlock.sql
No repetir migraciones ya aplicadas. Sites aplica las migraciones del paquete al publicar.

## Verificación
npx tsc --noEmit
npm run build
node tests/verify.mjs
La última prueba solo usa el servidor local. Crea productos de referencia, comprueba autenticación, cobros, QR, anulación e idempotencia, y anula sus ventas. La imagen usada para probar uploads NO es un QR para cobrar.

## Puesta en marcha
1. Base de datos: importar el archivo de la balanza o revisar el catálogo de la fotografía.
2. Configuración de pagos: subir el QR bancario y guardar el titular.
3. Escanear una etiqueta real. Si solo contiene el producto, introducir su importe impreso.
4. Si incluye importe/peso, ajustar la regla y comprobar los decimales y el dígito de control con el equipo real antes de activarla.
5. Habilitar al equipo y probar su acceso antes de operar.

No se cambia la configuración de la balanza. No hay conexión bancaria ni confirmación automática de pagos. El comprobante no es factura fiscal. Hace falta internet para registrar ventas. El historial de esta primera versión recupera hasta 10.000 ventas recientes.
