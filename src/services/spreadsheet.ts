import * as XLSX from 'xlsx';
import { Evaluation, PatientGroup, PcsItemNumber, SpreadsheetParseResult } from '../types';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const FIELD_ALIASES = {
  timestamp: ['timestamp'],
  id: ['codigo/id unico do paciente', 'código/id único do paciente'],
  name: ['nome completo do paciente'],
  date: ['data da avaliacao', 'data da avaliação'],
  researcher: [
    'extensionista/pesquisador(a) responsavel pela coleta',
    'extensionista/pesquisador(a) responsável pela coleta',
  ],
  moment: ['momento da avaliacao', 'momento da avaliação'],
};

function findHeader(headers: string[], aliases: string[]): string | undefined {
  const normalizedAliases = aliases.map(normalize);
  return headers.find((header) => normalizedAliases.includes(normalize(header)));
}

function findPcsHeaders(headers: string[]): Map<PcsItemNumber, string> {
  const found = new Map<PcsItemNumber, string>();

  for (const header of headers) {
    if (!normalize(header).startsWith('quando estou sentindo dor')) continue;
    const match = header.match(/\[(\d{1,2})\./);
    if (!match) continue;
    const item = Number(match[1]);
    if (item >= 1 && item <= 13) found.set(item as PcsItemNumber, header);
  }

  return found;
}

function parsePcsValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 && value <= 4 && Number.isInteger(value) ? value : null;
  }

  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/^([0-4])(?:\D|$)/);
  if (!match) return null;
  return Number(match[1]);
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function parseSpreadsheet(data: ArrayBuffer | Uint8Array): SpreadsheetParseResult {
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('A planilha não possui nenhuma aba.');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
    dateNF: 'dd/mm/yyyy',
  });

  const headers = Object.keys(rows[0] ?? {});
  if (headers.length === 0) throw new Error('A planilha está vazia ou não possui cabeçalhos reconhecíveis.');

  const timestampHeader = findHeader(headers, FIELD_ALIASES.timestamp);
  const idHeader = findHeader(headers, FIELD_ALIASES.id);
  const nameHeader = findHeader(headers, FIELD_ALIASES.name);
  const dateHeader = findHeader(headers, FIELD_ALIASES.date);
  const researcherHeader = findHeader(headers, FIELD_ALIASES.researcher);
  const momentHeader = findHeader(headers, FIELD_ALIASES.moment);
  const pcsHeaders = findPcsHeaders(headers);

  const missingFields: string[] = [];
  if (!idHeader) missingFields.push('Código/ID único do paciente');
  if (!nameHeader) missingFields.push('Nome completo do paciente');
  if (!dateHeader) missingFields.push('Data da avaliação');
  if (!researcherHeader) missingFields.push('Responsável pela coleta');
  if (!momentHeader) missingFields.push('Momento da avaliação');

  if (missingFields.length) {
    throw new Error(`Colunas obrigatórias não encontradas: ${missingFields.join(', ')}.`);
  }

  if (pcsHeaders.size !== 13) {
    const missingItems = Array.from({ length: 13 }, (_, i) => i + 1).filter(
      (item) => !pcsHeaders.has(item as PcsItemNumber),
    );
    throw new Error(`Não foram encontrados todos os 13 itens da PCS. Itens ausentes: ${missingItems.join(', ')}.`);
  }

  const warnings: string[] = [];
  const evaluations: Evaluation[] = [];

  rows.forEach((row, index) => {
    const id = asText(row[idHeader!]);
    const name = asText(row[nameHeader!]);
    const hasAnyPcs = Array.from(pcsHeaders.values()).some((header) => asText(row[header]) !== '');

    if (!id && !name && !hasAnyPcs) return;

    const pcsResponses = {} as Evaluation['pcsResponses'];
    const errors: string[] = [];

    for (let item = 1; item <= 13; item += 1) {
      const itemNumber = item as PcsItemNumber;
      const header = pcsHeaders.get(itemNumber)!;
      const raw = row[header];
      const parsed = parsePcsValue(raw);
      pcsResponses[itemNumber] = parsed;
      if (parsed === null) errors.push(`Item ${item}: resposta ausente ou inválida`);
    }

    if (!id) errors.push('Código/ID do paciente ausente');
    if (!name) errors.push('Nome do paciente ausente');

    const rowNumber = index + 2;
    if (errors.length) warnings.push(`Linha ${rowNumber}: ${errors.join('; ')}.`);

    evaluations.push({
      rowNumber,
      id,
      name,
      date: asText(row[dateHeader!]),
      researcher: asText(row[researcherHeader!]),
      moment: asText(row[momentHeader!]),
      timestamp: timestampHeader ? asText(row[timestampHeader]) : '',
      pcsResponses,
      errors,
    });
  });

  if (evaluations.length === 0) {
    throw new Error('Nenhuma avaliação foi encontrada na planilha.');
  }

  return { evaluations, warnings, sheetName };
}

export function groupPatients(evaluations: Evaluation[]): PatientGroup[] {
  const groups = new Map<string, PatientGroup>();

  for (const evaluation of evaluations) {
    const key = evaluation.id ? `id:${normalize(evaluation.id)}` : `name:${normalize(evaluation.name)}`;
    const existing = groups.get(key);

    if (existing) {
      existing.evaluations.push(evaluation);
      if (!existing.name && evaluation.name) existing.name = evaluation.name;
    } else {
      groups.set(key, {
        key,
        id: evaluation.id,
        name: evaluation.name,
        evaluations: [evaluation],
      });
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      evaluations: [...group.evaluations].sort((a, b) => b.rowNumber - a.rowNumber),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
