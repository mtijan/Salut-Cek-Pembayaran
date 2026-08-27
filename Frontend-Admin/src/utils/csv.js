export function csvCell(value) {
  let text = String(value ?? '');
  // Spreadsheet applications may ignore leading whitespace/control characters
  // before formula prefixes. Put an apostrophe at the very beginning so the
  // complete cell is always treated as text.
  // eslint-disable-next-line no-control-regex -- control prefixes are the attack vector handled here
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
