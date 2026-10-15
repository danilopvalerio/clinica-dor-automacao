import { Evaluation } from '../types';
import { FORM_GROUPS, organizedResponses, selectedChoice } from './forms';

export type PromisDomainId =
  | 'physicalFunction'
  | 'anxiety'
  | 'depression'
  | 'fatigue'
  | 'sleep'
  | 'socialParticipation'
  | 'painInterference';

export type PromisClassification = 'normal' | 'mild' | 'moderate' | 'severe' | 'notAvailable';

export interface PromisDomainResult {
  id: PromisDomainId;
  label: string;
  shortLabel: string;
  direction: 'higherBetter' | 'higherWorse';
  rawScore: number | null;
  tScore: number | null;
  classification: PromisClassification;
  answered: number;
  expected: number;
  estimated: boolean;
  missing: number;
  invalid: boolean;
}

export interface PromisResult {
  domains: PromisDomainResult[];
  painIntensity: number | null;
  totalRaw: number | null;
  impactPercent: number | null;
  complete: boolean;
}

const CONVERSION: Record<PromisDomainId, number[]> = {
  physicalFunction: [22.5, 26.6, 28.9, 30.5, 31.9, 33.2, 34.4, 35.6, 36.7, 37.9, 39.2, 40.5, 41.9, 43.5, 45.5, 48.3, 57.0],
  anxiety: [40.3, 48.0, 51.2, 53.7, 55.8, 57.7, 59.5, 61.4, 63.4, 65.3, 67.3, 69.3, 71.2, 73.3, 75.4, 77.9, 81.6],
  depression: [41.0, 49.0, 51.8, 53.9, 55.7, 57.3, 58.9, 60.5, 62.2, 63.9, 65.7, 67.5, 69.4, 71.2, 73.3, 75.7, 79.4],
  fatigue: [33.7, 39.7, 43.1, 46.0, 48.6, 51.0, 53.1, 55.1, 57.0, 58.8, 60.7, 62.7, 64.6, 66.7, 69.0, 71.6, 75.8],
  sleep: [32.0, 37.5, 41.1, 43.8, 46.2, 48.4, 50.5, 52.4, 54.3, 56.1, 57.9, 59.8, 61.7, 63.8, 66.0, 68.8, 73.3],
  socialParticipation: [27.5, 31.8, 34.0, 35.7, 37.3, 38.8, 40.5, 42.3, 44.2, 46.2, 48.1, 50.0, 51.9, 53.7, 55.8, 58.3, 64.2],
  painInterference: [41.6, 49.6, 52.0, 53.9, 55.6, 57.1, 58.5, 59.9, 61.2, 62.5, 63.8, 65.2, 66.6, 68.0, 69.7, 71.6, 75.6],
};

export const PROMIS_DOMAINS: Array<{
  id: PromisDomainId;
  label: string;
  shortLabel: string;
  direction: 'higherBetter' | 'higherWorse';
  groupId: string;
}> = [
  { id: 'physicalFunction', label: 'Função física', shortLabel: 'Função física', direction: 'higherBetter', groupId: 'physical' },
  { id: 'anxiety', label: 'Ansiedade', shortLabel: 'Ansiedade', direction: 'higherWorse', groupId: 'anxiety' },
  { id: 'depression', label: 'Depressão', shortLabel: 'Depressão', direction: 'higherWorse', groupId: 'depression' },
  { id: 'fatigue', label: 'Fadiga', shortLabel: 'Fadiga', direction: 'higherWorse', groupId: 'fatigue' },
  { id: 'sleep', label: 'Distúrbio do sono', shortLabel: 'Sono', direction: 'higherWorse', groupId: 'sleep' },
  { id: 'socialParticipation', label: 'Participação em papéis e atividades sociais', shortLabel: 'Participação social', direction: 'higherBetter', groupId: 'social' },
  { id: 'painInterference', label: 'Interferência da dor', shortLabel: 'Interferência da dor', direction: 'higherWorse', groupId: 'interference' },
];

export function classifyPromisTScore(tScore: number | null, direction: 'higherBetter' | 'higherWorse'): PromisClassification {
  if (tScore === null) return 'notAvailable';
  if (direction === 'higherBetter') {
    if (tScore > 45) return 'normal';
    if (tScore >= 40) return 'mild';
    if (tScore >= 30) return 'moderate';
    return 'severe';
  }
  if (tScore < 55) return 'normal';
  if (tScore < 60) return 'mild';
  if (tScore < 70) return 'moderate';
  return 'severe';
}

function interpolate(values: number[], rawScore: number): number {
  const clamped = Math.min(20, Math.max(4, rawScore));
  if (Number.isInteger(clamped)) return values[clamped - 4];
  const lower = Math.floor(clamped);
  const upper = Math.ceil(clamped);
  const ratio = clamped - lower;
  return values[lower - 4] + (values[upper - 4] - values[lower - 4]) * ratio;
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function getGroupValues(evaluation: Evaluation, groupId: string): { values: Array<number | null>; invalid: boolean } {
  const group = organizedResponses(evaluation, 'promis').find((item) => item.id === groupId);
  const questions = group?.questions ?? [];
  const values = questions.map((question) => selectedChoice(question.value, question.options) ?? null);
  const itemIds = questions.map(question => question.label.match(/^(\d+)[.)]/)?.[1]).filter((id): id is string => !!id);
  return { values, invalid: questions.length > 4 || new Set(itemIds).size !== itemIds.length || questions.some((question, index) => !!question.value && values[index] === null) };
}

function scoreDomain(
  evaluation: Evaluation,
  definition: (typeof PROMIS_DOMAINS)[number],
): PromisDomainResult {
  const { values, invalid } = getGroupValues(evaluation, definition.groupId);
  const answeredValues = values.filter((value): value is number => value !== null);
  const rawScore = invalid ? null : answeredValues.length === 4
    ? answeredValues.reduce((sum, value) => sum + value, 0)
    : answeredValues.length === 3
      ? (answeredValues.reduce((sum, value) => sum + value, 0) / answeredValues.length) * 4
      : null;
  const tScore = rawScore === null ? null : interpolate(CONVERSION[definition.id], rawScore);
  return {
    id: definition.id,
    label: definition.label,
    shortLabel: definition.shortLabel,
    direction: definition.direction,
    rawScore: rawScore === null ? null : rounded(rawScore),
    tScore: tScore === null ? null : rounded(tScore),
    classification: classifyPromisTScore(tScore, definition.direction),
    answered: answeredValues.length,
    expected: 4,
    estimated: !invalid && answeredValues.length === 3,
    missing: Math.max(0, 4 - answeredValues.length),
    invalid,
  };
}

function getPain(evaluation: Evaluation): number | null {
  const group = organizedResponses(evaluation, 'promis').find((item) => item.id === 'pain');
  const value = group?.questions[0];
  if (!value) return null;
  const selected = selectedChoice(value.value, value.options);
  return selected === undefined || selected < 0 || selected > 10 ? null : selected;
}

export function calculatePromis29(evaluation: Evaluation): PromisResult {
  if (!evaluation.scales.includes('promis')) throw new Error('Este registro não contém a PROMIS-29.');
  const domains = PROMIS_DOMAINS.map((domain) => scoreDomain(evaluation, domain));
  const painIntensity = getPain(evaluation);
  const complete = domains.every((domain) => domain.answered === domain.expected) && painIntensity !== null;
  const domainValues = domains.map((domain) => domain.rawScore);
  const totalRaw = domainValues.every((value): value is number => value !== null) && painIntensity !== null
    ? rounded(domainValues.reduce((sum, value) => sum + value, 0) + painIntensity)
    : null;
  return { domains, painIntensity, totalRaw, impactPercent: totalRaw === null ? null : rounded((totalRaw / 150) * 100), complete };
}

export const PROMIS_INTERPRETATION = {
  symptoms: [
    { label: 'Dentro da normalidade', rule: 'T < 55' },
    { label: 'Leve', rule: 'T de 55 a 59,9' },
    { label: 'Moderado', rule: 'T de 60 a 69,9' },
    { label: 'Grave', rule: 'T ≥ 70' },
  ],
  function: [
    { label: 'Dentro da normalidade', rule: 'T > 45' },
    { label: 'Leve', rule: 'T de 40 a 45' },
    { label: 'Moderado', rule: 'T de 30 a 39,9' },
    { label: 'Grave', rule: 'T < 30' },
  ],
} as const;

export const PROMIS_FORM_GROUPS = FORM_GROUPS.promis;
