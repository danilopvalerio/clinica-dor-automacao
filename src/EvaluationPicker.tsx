import { Evaluation } from './types';
export const evaluationLabel=(e:Evaluation)=>`${e.date||'Sem data'} · ${e.moment||'Sem momento'} · ${e.sourceLabel} / ${e.sheetName} · linha ${e.rowNumber}`;
export function EvaluationPicker({evaluations,selected,onChange}:{evaluations:Evaluation[];selected:Evaluation;onChange:(key:string)=>void}) {
 return <div className="evaluation-picker no-print"><div><strong>{evaluations.length} {evaluations.length===1?'avaliação disponível':'avaliações disponíveis'}</strong><p>Escolha o registro que deseja consultar.</p></div><div><label className="field-label" htmlFor="evaluation">Avaliação</label><select id="evaluation" value={selected.recordKey} onChange={e=>onChange(e.target.value)}>{evaluations.map(e=><option key={e.recordKey} value={e.recordKey}>{evaluationLabel(e)}</option>)}</select></div></div>;
}
