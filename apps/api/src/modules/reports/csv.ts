/** Quote every field and neutralize spreadsheet formulas even after leading whitespace/control characters. */
export function csvCell(value:unknown):string {
 let text=value==null?'':String(value);
 if(typeof value==='string') {
  const first = text.search(/\S/);
  if(first >= 0 && '=+-@'.includes(text[first]!)) text="'"+text;
 }
 return '"'+text.replaceAll('"','""')+'"';
}
export function reportCsv(columns:Array<{key:string;label:string}>,rows:Array<Record<string,unknown>>):string {
 return '\uFEFF'+[columns.map(c=>csvCell(c.label)).join(','),...rows.map(row=>columns.map(c=>csvCell(row[c.key])).join(','))].join('\r\n')+'\r\n';
}
