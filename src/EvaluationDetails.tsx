import { Evaluation, PcsItemNumber, PcsResult } from './types';
import { PCS_RULES } from './services/pcs';
import { FormResponses } from './FormResponses';
const options=['De forma alguma','Em um grau leve','Em um grau moderado','Em um grau elevado','O tempo todo'];
const subscales = [
 {key:'rumination',label:'Ruminação',description:'Pensamentos intrusivos e repetitivos sobre a dor; incapacidade de desviar a atenção dela.'},
 {key:'magnification',label:'Magnificação',description:'Ampliação da ameaça representada pela dor e antecipação de desfechos negativos.'},
 {key:'helplessness',label:'Desamparo',description:'Sensação de incapacidade de lidar com a dor ou de influenciar seu curso.'},
] as const;
export function EvaluationDetails({evaluation,result}:{evaluation:Evaluation;result:PcsResult|null}) {
 return <div className="evaluation-details">
 <section className="report-section">
  <span className="eyebrow">Parte 1 · Ficha de apuração</span><h2>Apuração das subescalas</h2>
  <div className="table-scroll" role="region" aria-label="Apuração das subescalas" tabIndex={0}><table><thead><tr><th>Subescala</th><th>Itens</th><th>Faixa</th><th>Escore obtido</th><th>O que caracteriza</th></tr></thead><tbody>{subscales.map(s=><tr key={s.key}><th scope="row">{s.label}</th><td>{PCS_RULES[s.key].items.join(', ')}</td><td>0–{PCS_RULES[s.key].max}</td><td className="score-cell">{result?.[s.key]??'Não calculado'}</td><td>{s.description}</td></tr>)}<tr><th scope="row">Escore total</th><td>Todos os 13 itens</td><td>0–52</td><td className="score-cell">{result?.total??'Não calculado'}</td><td>Nível global de catastrofização.</td></tr></tbody></table></div>
  <h3>Interpretação do escore total</h3>
  <div className="table-scroll" role="region" aria-label="Interpretação do escore total" tabIndex={0}><table><thead><tr><th>Escore total</th><th>Faixa obtida</th><th>Leitura</th></tr></thead><tbody>{[
   {key:'low',range:'0–14',text:'Catastrofização baixa.'},
   {key:'moderate',range:'15–29',text:'Catastrofização moderada. Vale explorar em entrevista, sobretudo se uma das subescalas estiver desproporcionalmente alta.'},
   {key:'clinicallyRelevant',range:'≥ 30',text:'Nível clinicamente relevante de catastrofização. Indica prioridade para abordagem psicoeducativa e cognitivo-comportamental voltada à dor.'},
  ].map(s=><tr key={s.key} className={result?.totalClassification===s.key?'selected-range':''}><th scope="row">{s.range}</th><td>{result?result.totalClassification===s.key?'✓ Atingida':'—':'Não calculado'}</td><td>{s.text}</td></tr>)}</tbody></table></div>
  <h3>Interpretação das subescalas</h3>
  <div className="table-scroll" role="region" aria-label="Interpretação das subescalas" tabIndex={0}><table><thead><tr><th>Subescala</th><th>Faixa</th><th>Ponto de corte</th><th>Escore obtido</th><th>Faixa atingida</th></tr></thead><tbody>{subscales.map(s=><tr key={s.key}><th scope="row">{s.label}</th><td>0–{PCS_RULES[s.key].max}</td><td>≥ {PCS_RULES[s.key].cutoff}/{PCS_RULES[s.key].max}</td><td className="score-cell">{result?.[s.key]??'—'}</td><td>{!result?'Não calculado':result[s.key]>=PCS_RULES[s.key].cutoff?'✓ Pontuação significativa':'Não significativa'}</td></tr>)}<tr><th scope="row">Escore total</th><td>0–52</td><td>≥ 30/52</td><td className="score-cell">{result?.total??'—'}</td><td>{!result?'Não calculado':result.total>=30?'✓ Clinicamente relevante':'Abaixo do ponto de corte'}</td></tr></tbody></table></div>
 </section>
 <section className="report-section questionnaire"><span className="eyebrow">Parte 2 · Respostas marcadas</span><h2>Escala de Catastrofização da Dor</h2><p>Pensamentos e sentimentos do paciente quando está sentindo dor. As marcações abaixo reproduzem as respostas registradas na planilha.</p><div className="answer-legend">{options.map((o,i)=><span key={o}><b>{i}</b> {o}</span>)}</div>
 <div className="question-head" aria-hidden="true"><strong>Quando estou sentindo dor…</strong><span>Resposta registrada</span></div>
 {Array.from({length:13},(_,i)=>{const item=(i+1) as PcsItemNumber;const answer=evaluation.pcsResponses[item];return <div className="question-row" key={item}><div className="question-text"><strong>{evaluation.pcsQuestions[item]}</strong><span className={answer===null?'invalid-answer':''}>{answer===null?'Resposta ausente ou inválida':`${answer} — ${options[answer]}`}</span></div><div className="answer-options" role="group" aria-label={`Resposta do item ${item}`}>{options.map((o,value)=><span key={value} className={`answer-option ${answer===value?'marked':''}`} aria-label={`${value}: ${o}${answer===value?', marcado':', não marcado'}`}><small>{value}</small><span aria-hidden="true">{answer===value?'●':'○'}</span></span>)}</div></div>;})}
 </section>
 {evaluation.scales.includes('promis')&&<section className="report-section"><span className="eyebrow">Mesmo registro · somente respostas</span><h2>PROMIS-29</h2><FormResponses evaluation={evaluation} scale="promis"/></section>}
 <details className="original-fields no-print"><summary>Consultar todos os campos originais da planilha</summary><dl className="field-grid raw-fields">{Object.entries(evaluation.fields).map(([field,value])=><div key={field}><dt>{field}</dt><dd>{value||'Não informado'}</dd></div>)}</dl></details>

 <div className="actions-row no-print"><button className="button primary" onClick={()=>window.print()}>Imprimir detalhes / salvar PDF</button></div>
 </div>;
}
