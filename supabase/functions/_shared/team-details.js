export function parseTeamDetailsSheet(text) {
  const json = String(text).match(/google\.visualization\.Query\.setResponse\((.*)\);?\s*$/s)?.[1];
  if (!json) throw new Error('Invalid TeamDetails sheet response. Previous data was not changed.');
  const data = JSON.parse(json);
  const table = data?.table;
  if (data.status === 'error' || !Array.isArray(table?.cols) || !Array.isArray(table?.rows)) {
    throw new Error('TeamDetails sheet is unavailable. Previous data was not changed.');
  }
  const nameIndex = table.cols.findIndex(col => ['c', 'name', 'school', 'team'].includes(String(col.label || '').trim().toLowerCase()) || String(col.id).toLowerCase() === 'c');
  const rows = table.rows.filter(row => String(row?.c?.[nameIndex >= 0 ? nameIndex : 2]?.v || '').trim());
  if (!rows.length) throw new Error('TeamDetails sheet contains no teams. Previous data was not changed.');
  // Preserve formatted values and every column used by the existing team parser.
  return { cols: table.cols, rows };
}
