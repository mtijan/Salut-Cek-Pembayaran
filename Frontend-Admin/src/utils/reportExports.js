const encoder = new globalThis.TextEncoder();

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function reportRows(students) {
  return [
    [
      'NIM',
      'Nama',
      'No BRIVA',
      'Nomor Kontak',
      'Program Studi',
      'Periode Masuk',
      'Jumlah Tagihan',
      'Total Tagihan (Rp)',
      'Total Terbayar (Rp)',
      'Sisa Piutang (Rp)',
      'Realisasi (%)',
      'Status Pembayaran',
    ],
    ...students.map((student) => [
      student.nim || '-',
      student.full_name || '-',
      student.briva || '-',
      student.phone_number || '-',
      student.program_study || '-',
      student.entry_period || '-',
      Number(student.total_bills || 0),
      Number(student.billed_amount || 0),
      Number(student.paid_amount || 0),
      Number(student.outstanding_amount || 0),
      Number(student.percentage_paid || 0),
      student.status_label ||
        (student.status === 'paid'
          ? 'Lunas'
          : student.status === 'partial'
            ? 'Sebagian'
            : 'Belum Bayar'),
    ]),
  ];
}

function columnName(index) {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

function worksheetXml(rows) {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
          if (rowIndex > 0 && typeof value === 'number') {
            return `<c r="${reference}" t="n"><v>${value}</v></c>`;
          }
          const cellFormat = rowIndex === 0 ? ' s="1"' : '';
          return `<c r="${reference}"${cellFormat} t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${body}</sheetData><autoFilter ref="A1:L${rows.length}"/></worksheet>`;
}

let crcTable;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      return value >>> 0;
    });
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function littleEndian(size, value) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  if (size === 2) view.setUint16(0, value, true);
  else view.setUint32(0, value, true);
  return bytes;
}

function joinBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const [path, content] of files) {
    const name = encoder.encode(path);
    const data = encoder.encode(content);
    const checksum = crc32(data);
    const localHeader = joinBytes([
      littleEndian(4, 0x04034b50),
      littleEndian(2, 20),
      littleEndian(2, 0x0800),
      littleEndian(2, 0),
      littleEndian(2, 0),
      littleEndian(2, 0),
      littleEndian(4, checksum),
      littleEndian(4, data.length),
      littleEndian(4, data.length),
      littleEndian(2, name.length),
      littleEndian(2, 0),
      name,
    ]);
    localParts.push(localHeader, data);

    centralParts.push(
      joinBytes([
        littleEndian(4, 0x02014b50),
        littleEndian(2, 20),
        littleEndian(2, 20),
        littleEndian(2, 0x0800),
        littleEndian(2, 0),
        littleEndian(2, 0),
        littleEndian(2, 0),
        littleEndian(4, checksum),
        littleEndian(4, data.length),
        littleEndian(4, data.length),
        littleEndian(2, name.length),
        littleEndian(2, 0),
        littleEndian(2, 0),
        littleEndian(2, 0),
        littleEndian(2, 0),
        littleEndian(4, 0),
        littleEndian(4, localOffset),
        name,
      ]),
    );
    localOffset += localHeader.length + data.length;
  }

  const central = joinBytes(centralParts);
  const end = joinBytes([
    littleEndian(4, 0x06054b50),
    littleEndian(2, 0),
    littleEndian(2, 0),
    littleEndian(2, files.length),
    littleEndian(2, files.length),
    littleEndian(4, central.length),
    littleEndian(4, localOffset),
    littleEndian(2, 0),
  ]);
  return joinBytes([...localParts, central, end]);
}

export function createFinancialReportXlsx(students) {
  const rows = reportRows(students);
  const files = [
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ],
    [
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Rekap Keuangan" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ],
    [
      'xl/styles.xml',
      '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>',
    ],
    ['xl/worksheets/sheet1.xml', worksheetXml(rows)],
  ];
  return new Blob([createZip(files)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function pdfText(value, maxLength) {
  const ascii = String(value ?? '-')
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
  return ascii.length > maxLength ? `${ascii.slice(0, Math.max(0, maxLength - 3))}...` : ascii;
}

function compactNumber(value) {
  return Math.round(Number(value || 0)).toLocaleString('id-ID');
}

function pageStream(students, pageNumber, totalPages, generatedDate) {
  const columns = [
    ['No', 22, 4],
    ['NIM', 48, 11],
    ['Nama', 94, 21],
    ['BRIVA', 80, 16],
    ['Kontak', 68, 14],
    ['Program Studi', 90, 20],
    ['Masuk', 42, 8],
    ['Jml', 26, 4],
    ['Tagihan', 64, 12],
    ['Terbayar', 64, 12],
    ['Sisa', 64, 12],
    ['%', 30, 6],
    ['Status', 50, 10],
  ];
  const commands = [
    'BT /F1 14 Tf 1 0 0 1 30 560 Tm (Rekap Keuangan SALUT AWWABIN) Tj ET',
    `BT /F1 7 Tf 1 0 0 1 30 545 Tm (Tanggal ekspor: ${pdfText(generatedDate, 20)} | Halaman ${pageNumber}/${totalPages}) Tj ET`,
  ];
  let x = 30;
  for (const [label, width] of columns) {
    commands.push(`BT /F1 7 Tf 1 0 0 1 ${x} 525 Tm (${pdfText(label, 25)}) Tj ET`);
    x += width;
  }
  commands.push('30 520 m 808 520 l S');
  students.forEach((student, index) => {
    const row = [
      (pageNumber - 1) * 34 + index + 1,
      student.nim || '-',
      student.full_name || '-',
      student.briva || '-',
      student.phone_number || '-',
      student.program_study || '-',
      student.entry_period || '-',
      student.total_bills || 0,
      compactNumber(student.billed_amount),
      compactNumber(student.paid_amount),
      compactNumber(student.outstanding_amount),
      `${Number(student.percentage_paid || 0)}%`,
      student.status_label ||
        (student.status === 'paid' ? 'Lunas' : student.status === 'partial' ? 'Sebagian' : 'Belum'),
    ];
    let rowX = 30;
    const y = 505 - index * 13;
    row.forEach((value, columnIndex) => {
      commands.push(
        `BT /F1 6.5 Tf 1 0 0 1 ${rowX} ${y} Tm (${pdfText(value, columns[columnIndex][2])}) Tj ET`,
      );
      rowX += columns[columnIndex][1];
    });
  });
  return commands.join('\n');
}

function createPdfBytes(students) {
  const perPage = 34;
  const pages = Math.max(1, Math.ceil(students.length / perPage));
  const objects = [];
  const fontObject = 3 + pages * 2;
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages} >>`;
  const generatedDate = new Date().toLocaleDateString('id-ID');
  for (let index = 0; index < pages; index += 1) {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const stream = pageStream(
      students.slice(index * perPage, (index + 1) * perPage),
      index + 1,
      pages,
      generatedDate,
    );
    objects[pageObject - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject - 1] =
      `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`;
  }
  objects[fontObject - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  const parts = [encoder.encode('%PDF-1.4\n')];
  const offsets = [0];
  let offset = parts[0].length;
  objects.forEach((object, index) => {
    offsets.push(offset);
    const bytes = encoder.encode(`${index + 1} 0 obj\n${object}\nendobj\n`);
    parts.push(bytes);
    offset += bytes.length;
  });
  const xrefOffset = offset;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((entry) => `${String(entry).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  ].join('');
  parts.push(encoder.encode(xref));
  return joinBytes(parts);
}

export function createFinancialReportPdf(students) {
  return new Blob([createPdfBytes(students)], { type: 'application/pdf' });
}
