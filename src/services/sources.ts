import { SpreadsheetParseResult } from '../types';

export type SourceKind = 'combined' | 'sf36';
export const SOURCE_LABELS: Record<SourceKind, string> = { combined: 'PCS e PROMIS-29', sf36: 'SF-36' };

// Validate before merging so selecting a file in the wrong field never replaces
// an already loaded source. PCS-only and PROMIS-only exports remain supported.
export function validateSource(parsed: SpreadsheetParseResult, kind: SourceKind): void {
  const matches = parsed.evaluations.every(evaluation => kind === 'sf36'
    ? evaluation.scales.includes('sf36') && !evaluation.scales.some(scale => scale === 'pcs' || scale === 'promis')
    : !evaluation.scales.includes('sf36') && evaluation.scales.some(scale => scale === 'pcs' || scale === 'promis'));
  if (!matches) throw new Error(`Este campo aceita a planilha de ${SOURCE_LABELS[kind]}. Selecione o arquivo ou link correspondente.`);
}
