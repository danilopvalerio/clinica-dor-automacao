import { Evaluation } from './types';
import { organizedResponses, SCALE_NAMES, selectedChoice } from './services/forms';
export function FormResponses({evaluation,scale}:{evaluation:Evaluation;scale:'promis'|'sf36'}) {
 const groups=organizedResponses(evaluation,scale);
 return <section className="organized-form" aria-label={`Respostas ${SCALE_NAMES[scale]}`}>
 <nav className="form-nav no-print" aria-label={`Seções ${SCALE_NAMES[scale]}`}>{groups.map((g,i)=><a key={g.id} href={`#${scale}-${g.id}`} onClick={event=>{event.preventDefault();document.getElementById(`${scale}-${g.id}`)?.scrollIntoView({block:"start"});}}>{String(i+1).padStart(2,'0')} {g.title}</a>)}</nav>
 {groups.map((group,i)=><section className="form-section" id={`${scale}-${group.id}`} key={group.id}>
  <div className="form-section-heading"><span>{String(i+1).padStart(2,'0')}</span><h3>{group.title}</h3></div><p className="period">{group.period}</p>
  {scale==='sf36'&&group.questions[0]?.header.includes('[')&&<p className="helper">{group.questions[0].header.split('[')[0].trim()}</p>}
  {group.questions.length<group.expected&&<p className="form-missing">{group.questions.length} de {group.expected} perguntas encontradas neste registro. As colunas ausentes não foram preenchidas automaticamente.</p>}
  {group.questions.map(q=>{const chosen=selectedChoice(q.value,q.options);return <article className="form-question" key={q.header}>
   <h4>{q.label}</h4><div className="response-options" role="group" aria-label={q.label}>
    {q.options.map(option=><div className={`response-choice ${chosen===option.code?'selected':''}`} key={option.code}><span className="choice-dot" aria-hidden="true"/><span>{option.label===String(option.code)?option.code:`${option.label} (${option.code})`}{chosen===option.code&&<span className="sr-only"> — resposta marcada</span>}</span></div>)}
    {chosen===undefined&&<div className="recorded-answer"><small>Resposta registrada</small>{q.value||'Não respondida'}{q.value&&<small>Valor sem correspondência exata nas opções do formulário</small>}</div>}
   </div>
  </article>;})}
 </section>)}
 </section>;
}
