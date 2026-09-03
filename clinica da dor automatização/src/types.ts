export type PcsItemNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Evaluation {
  rowNumber: number;
  id: string;
  name: string;
  date: string;
  researcher: string;
  moment: string;
  timestamp: string;
  pcsResponses: Record<PcsItemNumber, number | null>;
  errors: string[];
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
  sheetName: string;
}
