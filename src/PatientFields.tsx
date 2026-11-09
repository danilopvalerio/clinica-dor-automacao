import { Evaluation } from './types';
import { fieldScale } from './services/forms';

export function PatientFields({ evaluation }: { evaluation: Evaluation }) {
  const fields = Object.entries(evaluation.fields).filter(([key]) =>
    evaluation.kind === 'initial' || (!fieldScale(key) && !key.includes('[')));
  return <>
    {evaluation.kind === 'initial' && <h3>Avaliação inicial</h3>}
    {!!evaluation.errors.length && <div className="alert" role="alert"><strong>Confira a identificação deste registro</strong><ul>{evaluation.errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    <dl className="field-grid">{fields.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || 'Não informado'}</dd></div>)}</dl>
  </>;
}
