import ExcelJS from 'exceljs';
const w=new ExcelJS.Workbook();const s=w.addWorksheet('Productos');s.addRow(['PLU NO','Name','Code','Price','Mode','Shelflife']);s.addRow([1,'BLANDA 1RO','0470101',70,'weight',0]);s.getColumn(3).numFmt='@';await w.xlsx.writeFile('tests/productos-prueba.xlsx');
