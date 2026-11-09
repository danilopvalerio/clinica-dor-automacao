import { SpreadsheetParseResult } from '../types';
import type { EvaluationDateOrder } from './evaluationDates';

export type SourceKind = 'combined' | 'sf36' | 'initial';
export const SOURCE_KINDS: SourceKind[] = ['combined', 'sf36', 'initial'];
export const SOURCE_LABELS: Record<SourceKind, string> = { combined: 'PCS e PROMIS-29', sf36: 'SF-36', initial: 'Avaliação inicial' };
export const SOURCE_DATE_ORDERS: Record<SourceKind, EvaluationDateOrder> = {
  combined: 'mdy',
  sf36: 'dmy',
  initial: 'dmy',
};
export const SOURCE_HELP: Record<SourceKind, string> = {
  combined: 'Use a planilha que reúne PCS e PROMIS-29.',
  sf36: 'Use a planilha de SF-36, com ou sem a coluna Pontuação.',
  initial: 'Use a planilha de avaliação inicial. Cada linha será preservada como um registro independente.',
};

export function configuredSheetUrls(env: Record<string, unknown>): Record<SourceKind, string> {
  const value = (key: string) => typeof env[key] === 'string' ? env[key].trim() : '';
  return {
    combined: value('VITE_COMBINED_SHEET_URL'),
    sf36: value('VITE_SF36_SHEET_URL'),
    initial: value('VITE_INITIAL_SHEET_URL'),
  };
}

// Validate before merging so selecting a file in the wrong field never replaces
// an already loaded source. PCS-only and PROMIS-only exports remain supported.
export function validateSource(parsed: SpreadsheetParseResult, kind: SourceKind): void {
  const matches = parsed.evaluations.length > 0 && parsed.evaluations.every(evaluation => kind === 'initial'
    ? evaluation.kind === 'initial' && evaluation.scales.length === 0
    : evaluation.kind !== 'initial' && (kind === 'sf36'
    ? evaluation.scales.includes('sf36') && !evaluation.scales.some(scale => scale === 'pcs' || scale === 'promis')
    : !evaluation.scales.includes('sf36') && evaluation.scales.some(scale => scale === 'pcs' || scale === 'promis')));
  if (!matches) throw new Error(`Este campo aceita a planilha de ${SOURCE_LABELS[kind]}. Selecione o arquivo ou link correspondente.`);
}
