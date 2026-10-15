import { Evaluation } from '../types';
import { organizedResponses, selectedChoice } from './forms';
import { SF36_SECTIONS } from './sf36Form';

// All weights and domains below follow folhas_de_correção_das_escalas_.docx.
// In particular, Q7 response 5 weighs 2.0, as specified in that document.
export const SF36_DOMAINS = [
  { id: 'physicalFunction', label: 'Capacidade funcional', items: ['3a','3b','3c','3d','3e','3f','3g','3h','3i','3j'], questions: '03 (a–j)', lower: 10, range: 20 },
  { id: 'physicalRole', label: 'Limitação por aspectos físicos', items: ['4a','4b','4c','4d'], questions: '04 (a–d)', lower: 4, range: 4 },
  { id: 'pain', label: 'Dor', items: ['7','8'], questions: '07 + 08', lower: 2, range: 10 },
  { id: 'generalHealth', label: 'Estado geral de saúde', items: ['1','11a','11b','11c','11d'], questions: '01 + 11', lower: 5, range: 20 },
  { id: 'vitality', label: 'Vitalidade', items: ['9a','9e','9g','9i'], questions: '09 (a, e, g, i)', lower: 4, range: 20 },
  { id: 'socialFunction', label: 'Aspectos sociais', items: ['6','10'], questions: '06 + 10', lower: 2, range: 8 },
  { id: 'emotionalRole', label: 'Limitação por aspectos emocionais', items: ['5a','5b','5c'], questions: '05 (a–c)', lower: 3, range: 3 },
  { id: 'mentalHealth', label: 'Saúde mental', items: ['9b','9c','9d','9f','9h'], questions: '09 (b, c, d, f, h)', lower: 5, range: 25 },
] as const;

export interface Sf36ItemResult {
  id: string;
  label: string;
  original: string;
  code: number | null;
  weighted: number | null;
  issue: string | null;
}

export interface Sf36DomainResult {
  id: string;
  label: string;
  questions: string;
  lower: number;
  range: number;
  answered: number;
  expected: number;
  rawScore: number | null;
  score: number | null;
  estimated: boolean;
  issues: string[];
}

export interface Sf36Result {
  domains: Sf36DomainResult[];
  items: Sf36ItemResult[];
  healthChange: string;
}

function weight(item: Sf36ItemResult): number | null {
  const code = item.code;
  if (code === null) return null;
  if (item.id === '1') return [5,4.4,3.4,2,1][code - 1];
  if (item.id === '6') return 6 - code;
  if (item.id === '7') return [6,5.4,4.2,3.1,2,1][code - 1];
  if (['9a','9d','9e','9h'].includes(item.id)) return 7 - code;
  if (['11b','11d'].includes(item.id)) return 6 - code;
  return code;
}

const rounded = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

export function calculateSf36(evaluation: Evaluation): Sf36Result {
  if (!evaluation.scales.includes('sf36')) throw new Error('Este registro não contém a SF-36.');
  const groups = organizedResponses(evaluation, 'sf36');
  const items: Sf36ItemResult[] = groups.flatMap((group, sectionIndex) => group.questions.map((question, index) => {
    const code = question.ambiguous ? null : selectedChoice(question.value, question.options) ?? null;
    const item: Sf36ItemResult = {
      id: SF36_SECTIONS[sectionIndex].questions[index].key,
      label: question.label, original: question.value, code, weighted: null,
      issue: question.ambiguous ? 'Mais de uma coluna para o mesmo item.'
        : question.value && code === null ? 'Resposta sem correspondência nas alternativas.' : null,
    };
    item.weighted = weight(item);
    return item;
  }));
  const byId = new Map(items.map(item => [item.id, item]));
  const q7 = byId.get('7')!, q8 = byId.get('8')!;
  if (q8.code !== null) {
    if (q7.issue) {
      q8.weighted = null;
      q8.issue = 'A ponderação depende de uma resposta válida à questão 7.';
    } else if (q7.code === null) {
      q8.weighted = [6,4.75,3.5,2.25,1][q8.code - 1];
    } else if (q7.code === 1 && q8.code === 1) {
      q8.weighted = 6;
    } else if (q7.code >= 2) {
      q8.weighted = 6 - q8.code;
    } else {
      // The supplied sheet has no rule for Q7=1 with Q8=2..5. Do not guess.
      q8.weighted = null;
      q8.issue = 'Combinação das questões 7 e 8 sem regra na folha de correção.';
    }
  }

  const domains = SF36_DOMAINS.map(definition => {
    const domainItems = definition.items.map(id => byId.get(id)!);
    const values = domainItems.filter(item => item.weighted !== null).map(item => item.weighted!);
    const issues = domainItems.filter(item => item.issue).map(item => `Item ${item.id}: ${item.issue}`);
    const expected = definition.items.length;
    // At least 50% answered, as permitted by the supplied correction sheet.
    // Missing items are estimated from the mean of valid weighted items; source
    // answers remain untouched and every estimated domain is visibly identified.
    const canCalculate = !issues.length && values.length >= Math.ceil(expected / 2);
    const rawScore = canCalculate ? values.reduce((sum, value) => sum + value, 0) * expected / values.length : null;
    const score = rawScore === null ? null : rounded((rawScore - definition.lower) * 100 / definition.range);
    return {
      id: definition.id, label: definition.label, questions: definition.questions,
      lower: definition.lower, range: definition.range, expected, answered: values.length,
      rawScore, score, estimated: canCalculate && values.length < expected, issues,
    };
  });
  const change = byId.get('2')!;
  const healthChange = change.issue ? 'Resposta a conferir' : change.code === null ? 'Não respondida'
    : groups[1].questions[0].options.find(option => option.code === change.code)!.label;
  return { domains, items, healthChange };
}
