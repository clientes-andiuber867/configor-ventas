"use client";
import { Choice, ProductTable } from "@/components/shared/tables";
import { Switch } from "@/components/ui/switch";
import { download, type AppState } from "@/features/workspace/use-workspace";
import { decodeBarcode, money, referenceProducts } from "@/lib/domain";
import { ChevronRight, Database, Download, Search, Upload } from "lucide-react";
export function DatabaseView({ s }: { s: AppState }) {
  if (!s.data) return null;
  return (
    <>
      <div className="two-columns">
        <section className="panel">
          <div className="panel-title">
            <h2>Importar desde la balanza</h2>
            <Database size={20} />
          </div>
          <label className="upload-zone">
            <Upload size={30} />
            <b>Seleccionar archivo Excel o CSV</b>
            <span>.xlsx, .csv, .tsv · hasta 500 productos</span>
            <input
              type="file"
              accept=".xls,.xlsx,.csv,.tsv,.txt"
              onChange={(e) => {
                s.importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <p className="hint">
            Columnas: PLU NO, Name, Code, Price y Mode. Code debe estar guardado
            como texto; Price es el precio por kilo en Bs.
          </p>
          <button
            className="text-button"
            onClick={() => {
              s.setImportRows(referenceProducts);
              s.setImportName("Catálogo de referencia de tu fotografía");
              s.setImportError("");
            }}
          >
            Revisar los 15 productos de tu fotografía
          </button>
        </section>
        <section className="panel">
          <div className="panel-title">
            <h2>Conexión con tu balanza</h2>
            <span className="badge">TM-30F</span>
          </div>
          <p className="body-copy">
            La balanza imprime la etiqueta. El lector envía el código a esta
            caja, que identifica el producto en tu base de datos.
          </p>
          <div className="connection-flow">
            <span>Balanza</span>
            <ChevronRight />
            <span>Etiqueta</span>
            <ChevronRight />
            <span>Caja</span>
          </div>
          <p className="hint">
            No hace falta conectar la balanza a esta aplicación para registrar
            ventas.
          </p>
          <button
            className="secondary"
            onClick={() =>
              download(
                "plantilla-productos.csv",
                "PLU NO;Name;Code;Price;Mode;Shelflife\r\n1;BLANDA 1RO;0470101;70;weight;0",
                "text/csv",
              )
            }
          >
            <Download size={16} /> Descargar plantilla CSV
          </button>
        </section>
      </div>
      {s.importError && <div className="error-banner">{s.importError}</div>}
      {s.importRows.length > 0 && (
        <section className="panel import-preview">
          <div className="panel-title">
            <div>
              <h2>Revisar importación</h2>
              <p className="hint">
                {s.importName} · {s.importRows.length} productos. Se
                actualizarán los códigos existentes.
              </p>
            </div>
            <button
              disabled={s.busy}
              className="primary"
              onClick={async () => {
                if (
                  await s.run(
                    { action: "import", products: s.importRows },
                    "Productos importados",
                  )
                )
                  s.setImportRows([]);
              }}
            >
              Confirmar importación
            </button>
          </div>
          <ProductTable products={s.importRows} />
        </section>
      )}
      <section className="panel">
        <div className="panel-title">
          <h2>
            Productos registrados{" "}
            <span className="badge">{s.data.products.length}</span>
          </h2>
          <div className="search">
            <Search size={17} />
            <input
              aria-label="Buscar producto"
              placeholder="Buscar nombre, código o PLU"
              value={s.query}
              onChange={(e) => s.setQuery(e.target.value)}
            />
          </div>
        </div>
        <ProductTable products={s.visibleProducts} />
      </section>
      <section className="panel rule-panel">
        <div className="panel-title">
          <h2>Interpretación del código de barras</h2>
          <label className="switch-label">
            <Switch
              checked={s.rule.enabled}
              onCheckedChange={(enabled) => s.setRule({ ...s.rule, enabled })}
            />{" "}
            Formato con peso / importe
          </label>
        </div>
        <p className="body-copy">
          Los códigos de producto y EAN-8 se reconocen automáticamente. Activa
          un formato extendido solo cuando coincida con una etiqueta real de la
          balanza.
        </p>
        <div className="form-grid">
          <label>
            Formato
            <input
              value={s.rule.pattern}
              onChange={(e) =>
                s.setRule({ ...s.rule, pattern: e.target.value.toUpperCase() })
              }
            />
          </label>
          <label>
            Prefijo esperado (opcional)
            <input
              value={s.rule.prefix}
              onChange={(e) => s.setRule({ ...s.rule, prefix: e.target.value })}
            />
          </label>
          <label>
            Decimales del importe
            <input
              type="number"
              min="0"
              max="4"
              value={s.rule.amountDecimals}
              onChange={(e) =>
                s.setRule({ ...s.rule, amountDecimals: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Decimales del peso en kg
            <input
              type="number"
              min="0"
              max="4"
              value={s.rule.weightDecimals}
              onChange={(e) =>
                s.setRule({ ...s.rule, weightDecimals: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Longitud de Code en catálogo
            <input
              type="number"
              min="4"
              max="16"
              value={s.rule.codePad}
              onChange={(e) =>
                s.setRule({ ...s.rule, codePad: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Control
            <Choice
              value={s.rule.checksum}
              onChange={(v) => s.setRule({ ...s.rule, checksum: v as any })}
              label="Dígito de control"
              options={[
                ["none", "Sin validar C (pendiente)"],
                ["ean", "Módulo 10 / EAN"],
              ]}
            />
          </label>
        </div>
        <p className="hint">
          F: prefijo · W: producto · E: importe · N: peso · C: control. Completa
          con ceros a la izquierda hasta la longitud del catálogo.
        </p>
        <div className="test-row">
          <input
            aria-label="Probar código"
            value={s.testCode}
            onChange={(e) => s.setTestCode(e.target.value)}
            placeholder="Código de una etiqueta real"
          />
          <button
            className="secondary"
            onClick={() => {
              try {
                const d = decodeBarcode(s.testCode, s.data!.products, s.rule);
                s.setTestResult(
                  d.product.name +
                    " · " +
                    (d.amount === null ? "Importe manual" : money(d.amount)) +
                    " · " +
                    (d.grams === null ? "Sin peso" : d.grams / 1000 + " kg"),
                );
              } catch (e: any) {
                s.setTestResult(e.message);
              }
            }}
          >
            Probar lectura
          </button>
          <button
            className="primary"
            disabled={s.busy}
            onClick={() =>
              s.run({ action: "rule", rule: s.rule }, "Formato guardado")
            }
          >
            Guardar formato
          </button>
        </div>
        {s.testResult && <p className="notice">{s.testResult}</p>}
      </section>
    </>
  );
}
