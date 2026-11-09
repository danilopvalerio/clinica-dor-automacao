import { SpreadsheetParseResult } from '../types';
import { downloadGoogleSheet } from './googleSheets';
import { parseSpreadsheet } from './spreadsheet';
import { SOURCE_KINDS, SOURCE_LABELS, SourceKind, validateSource } from './sources';

// Handle each source independently: a failed download must not discard another
// source or replace previously imported records.
export async function syncSources(
  kinds: readonly SourceKind[],
  onSuccess: (parsed: SpreadsheetParseResult) => void,
  onError: (kind: SourceKind, message: string) => void,
  download = downloadGoogleSheet,
): Promise<void> {
  await Promise.all(SOURCE_KINDS.filter(kind => kinds.includes(kind)).map(async kind => {
    try {
      const parsed = parseSpreadsheet(await download(kind), `google:${kind}`, `${SOURCE_LABELS[kind]} · Google Sheets`, kind === 'initial' ? 'initial' : 'auto');
      validateSource(parsed, kind);
      onSuccess(parsed);
    } catch (error) {
      onError(kind, error instanceof Error ? error.message : 'Não foi possível sincronizar.');
    }
  }));
}
