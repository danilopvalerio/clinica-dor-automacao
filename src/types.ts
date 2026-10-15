export type PcsItemNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Evaluation {
  rowNumber: number;
  recordKey: string;
  sourceId: string;
  sourceLabel: string;
  sheetName: string;
  scales: import("./services/forms").ScaleId[];
  id: string;
  name: string;
  date: string;
  researcher: string;
  moment: string;
  timestamp: string;
  pcsResponses: Record<PcsItemNumber, number | null>;
  errors: string[];
  fields: Record<string, string>;
  pcsQuestions: Record<PcsItemNumber, string>;
}

export interface PatientGroup {
  key: string;
  id: string;
  name: string;
  evaluations: Evaluation[];
}

export type TotalClassification = 'low' | 'moderate' | 'clinicallyRelevant';

export interface PcsResult {
  rumination: number;
  magnification: number;
  helplessness: number;
  total: number;
  ruminationSignificant: boolean;
  magnificationSignificant: boolean;
  helplessnessSignificant: boolean;
  totalClassification: TotalClassification;
  totalLabel: string;
}

export interface SpreadsheetParseResult {
  evaluations: Evaluation[];
  warnings: string[];
  warningsBySource: Record<string, string[]>;
  sheetName: string;
}
