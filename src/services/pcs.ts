import { Evaluation, PcsItemNumber, PcsResult } from '../types';

export const PCS_RULES = {
  rumination: { items: [8, 9, 10, 11] as PcsItemNumber[], max: 16, cutoff: 11 },
  magnification: { items: [6, 7, 13] as PcsItemNumber[], max: 12, cutoff: 5 },
  helplessness: { items: [1, 2, 3, 4, 5, 12] as PcsItemNumber[], max: 24, cutoff: 13 },
  total: { max: 52, clinicallyRelevantCutoff: 30 },
} as const;

const sumItems = (evaluation: Evaluation, items: PcsItemNumber[]) =>
  items.reduce((sum, item) => sum + (evaluation.pcsResponses[item] ?? 0), 0);

export function calculatePcs(evaluation: Evaluation): PcsResult {
  if (evaluation.errors.length > 0) {
    throw new Error('A avaliação possui respostas ausentes ou inválidas e não pode ser calculada.');
  }

  const rumination = sumItems(evaluation, PCS_RULES.rumination.items);
  const magnification = sumItems(evaluation, PCS_RULES.magnification.items);
  const helplessness = sumItems(evaluation, PCS_RULES.helplessness.items);
  const total = Array.from({ length: 13 }, (_, index) => (index + 1) as PcsItemNumber).reduce(
    (sum, item) => sum + (evaluation.pcsResponses[item] ?? 0),
    0,
  );

  const totalClassification = total <= 14 ? 'low' : total <= 29 ? 'moderate' : 'clinicallyRelevant';
  const totalLabel =
    totalClassification === 'low'
      ? 'Catastrofização baixa'
      : totalClassification === 'moderate'
        ? 'Catastrofização moderada'
        : 'Nível clinicamente relevante de catastrofização';

  return {
    rumination,
    magnification,
    helplessness,
    total,
    ruminationSignificant: rumination >= PCS_RULES.rumination.cutoff,
    magnificationSignificant: magnification >= PCS_RULES.magnification.cutoff,
    helplessnessSignificant: helplessness >= PCS_RULES.helplessness.cutoff,
    totalClassification,
    totalLabel,
  };
}
