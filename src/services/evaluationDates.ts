import * as XLSX from 'xlsx';

export type EvaluationDateOrder = 'dmy' | 'mdy';

// SF-36 and initial assessments preserve Excel's stored calendar day. Their
// display format can be localized by the exporter and must not swap day/month.
// PCS/PROMIS retains its explicit month/day import convention.
export function readEvaluationDate(cell: XLSX.CellObject | undefined, original: string, order: EvaluationDateOrder, date1904 = false): {
  date: string;
  dateValue: number | null;
} {
  const invalid = { date: original, dateValue: null };
  const result = (year: number, month: number, day: number) => {
    const dateValue = Date.UTC(year, month - 1, day);
    const date = new Date(dateValue);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return invalid;
    return { date: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`, dateValue };
  };

  if (order === 'dmy' && cell?.t === 'n' && typeof cell.v === 'number') {
    const parts = XLSX.SSF.parse_date_code(cell.v, { date1904 });
    return parts ? result(parts.y, parts.m, parts.d) : invalid;
  }

  const fromText = (text: string) => {
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
    if (iso) return result(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (!slash) return invalid;
    const first = Number(slash[1]), second = Number(slash[2]);
    let year = Number(slash[3]);
    if (slash[3].length === 2) year += year < 50 ? 2000 : 1900;
    return result(year, order === 'mdy' ? first : second, order === 'mdy' ? second : first);
  };

  const displayed = String(cell?.w ?? original).trim();
  const parsed = fromText(displayed);
  if (parsed.dateValue !== null) return parsed;

  if (cell?.t === 'n' && typeof cell.v === 'number') {
    const parts = XLSX.SSF.parse_date_code(cell.v, { date1904 });
    return parts ? result(parts.y, parts.m, parts.d) : invalid;
  }
  return invalid;
}
