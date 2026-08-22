export function csvCell(value) {
  let text = String(value ?? '');
  // Spreadsheet applications evaluate these prefixes as formulas. Prefix the
  // value with an apostrophe before CSV quoting so it is always displayed.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
