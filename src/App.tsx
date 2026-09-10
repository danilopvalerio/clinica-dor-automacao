import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { downloadGoogleSheet } from './services/googleSheets';
import { calculatePcs } from './services/pcs';
import { groupPatients, mergeSpreadsheet, parseSpreadsheet } from './services/spreadsheet';
import { fieldScale, normalize, ScaleId, SCALE_NAMES } from './services/forms';
import { SpreadsheetParseResult, Evaluation } from './types';
import { EvaluationReport } from './EvaluationReport';
import { EvaluationPicker } from './EvaluationPicker';
import { FormResponses } from './FormResponses';

type View='dashboard'|'patients'|'patient'|'scales'|'scalePatients'|'overview'|'details';
type Route={view:View;patient?:string;row?:string;scale?:ScaleId};
const HOME:Route={view:'dashboard'};
const scaleIds:ScaleId[]=['pcs','promis','sf36'];
const descriptions:Record<ScaleId,string>={pcs:'Escala de Catastrofização da Dor',promis:'Perfil de saúde — função física, sono e bem-estar',sf36:'Questionário de Qualidade de Vida — versão brasileira'};

function App(){
 const [sheetUrl,setSheetUrl]=useState('');
 const [data,setData]=useState<SpreadsheetParseResult|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [query,setQuery]=useState('');
 const [menuOpen,setMenuOpen]=useState(false);
 const [routes,setRoutes]=useState<Route[]>([HOME]);
 const route=routes[routes.length-1],scale=route.scale??'pcs';
 const activeNav=route.view==='dashboard'?'dashboard':routes[1]?.view==='patients'||route.view==='patient'?'patients':'scales';
 const titles:Record<View,string>={dashboard:'Clínica da Dor',patients:'Pacientes',patient:'Ficha do paciente',scales:'Escalas',scalePatients:`${SCALE_NAMES[scale]} · Pacientes`,overview:`${SCALE_NAMES[scale]} · ${scale==='pcs'?'Visão geral':'Respostas'}`,details:'PCS · Avaliação detalhada'};
 useEffect(()=>{
  window.history.replaceState({pcsRoutes:[HOME]},'');
  const pop=(e:PopStateEvent)=>{setRoutes(e.state?.pcsRoutes??[HOME]);setMenuOpen(false);};
  window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);
 },[]);
 useEffect(()=>{if(!menuOpen)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenuOpen(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[menuOpen]);
 const navigate=(next:Route,root=false)=>{
  const stack=root?next.view==='dashboard'?[HOME]:[HOME,next]:[...routes,next];
  window.history.pushState({pcsRoutes:stack},'');setRoutes(stack);setMenuOpen(false);setQuery('');window.scrollTo(0,0);
 };
 const back=()=>{const stack=routes.length>1?routes.slice(0,-1):[HOME];window.history.replaceState({pcsRoutes:stack},'');setRoutes(stack);window.scrollTo(0,0);};
 const patients=useMemo(()=>groupPatients(data?.evaluations??[]),[data]);
 const patient=patients.find(p=>p.key===route.patient);
 const inScale=['overview','details'].includes(route.view);
 const relevantEvaluations=patient?.evaluations.filter(e=>!inScale||e.scales.includes(scale))??[];
 const evaluation=relevantEvaluations.find(e=>e.recordKey===route.row)??relevantEvaluations[0];
 const result=evaluation&&scale==='pcs'&&evaluation.scales.includes('pcs')&&!evaluation.errors.length?calculatePcs(evaluation):null;
 const filtered=patients.filter(p=>(route.view!=='scalePatients'||p.evaluations.some(e=>e.scales.includes(scale)))&&normalize(`${p.id} ${p.name}`).includes(normalize(query)));
 const sources=Array.from(new Set(data?.evaluations.map(e=>e.sourceLabel)??[]));
 const selectRow=(row:string)=>{const stack=[...routes.slice(0,-1),{...route,row}];setRoutes(stack);window.history.replaceState({pcsRoutes:stack},'');};
 const load=(parsed:SpreadsheetParseResult)=>{setData(previous=>mergeSpreadsheet(previous,parsed));setQuery('');setRoutes([HOME]);window.history.replaceState({pcsRoutes:[HOME]},'');};
 const localFile=async(event:ChangeEvent<HTMLInputElement>)=>{
  const files=Array.from(event.target.files??[]);if(!files.length)return;setLoading(true);setError('');
  const failures:string[]=[];
  for(const file of files){try{load(parseSpreadsheet(await file.arrayBuffer(),`file:${file.name}`,file.name));}catch(err){failures.push(`${file.name}: ${err instanceof Error?err.message:'Não foi possível abrir o arquivo.'}`);}}
  setError(failures.join(' '));setLoading(false);event.target.value='';
 };
 const sync=async()=>{setLoading(true);setError('');try{load(parseSpreadsheet(await downloadGoogleSheet(sheetUrl),`google:${sheetUrl.trim()}`,'Google Sheets'));}catch(err){setError(err instanceof Error?err.message:'Não foi possível sincronizar.');}finally{setLoading(false);}};
 const empty=<div className="empty-state"><h2>Nenhum registro carregado</h2><p>Importe a planilha de respostas para consultar os pacientes e suas avaliações.</p><button className="button primary" onClick={()=>navigate(HOME,true)}>Carregar planilha</button></div>;
 const scales=(byPatient:boolean)=><div className="scale-grid">{scaleIds.map((id,i)=>{
  const available=patient?.evaluations.filter(e=>e.scales.includes(id))??[];
  const target=available.find(e=>e.recordKey===evaluation?.recordKey)??available[0];
  return <article className="scale-card" key={id}>
   <span className="scale-number">{String(i+1).padStart(2,'0')}</span><div><h2>{SCALE_NAMES[id]}</h2><span className="eyebrow">{id==='pcs'?'Apuração e respostas':'Somente respostas'}</span></div>
   <p>{descriptions[id]}{byPatient&&<><br/><small>{available.length} registro(s) disponível(is){target&&<><br/>{target.recordKey===evaluation?.recordKey?'Registro selecionado':'Registro disponível'}: {target.date||'Sem data'} · {target.moment||'Sem momento'}</>}</small></>}</p>
   <button className="button secondary" disabled={byPatient&&!target} onClick={()=>navigate(byPatient?{view:'overview',patient:route.patient,scale:id,row:target?.recordKey}:{view:'scalePatients',scale:id})}>{byPatient?target?'Consultar →':'Sem registro':'Escolher paciente →'}</button>
  </article>;
 })}</div>;
 return <div className="layout">
  <aside className={`sidebar no-print ${menuOpen?'open':''}`}>
   <div className="brand-logos"><img className="nutes-logo" src="/logo-nutes.svg" alt="NUTES"/><img className="uepb-logo" src="/logo-uepb.svg" alt="UEPB"/></div>
   <div className="brand-name"><strong>Clínica da Dor</strong><span>Núcleo de Tecnologias Estratégicas em Saúde</span></div>
   <nav id="mobile-nav" aria-label="Menu principal">{([['dashboard','Página inicial'],['patients','Pacientes'],['scales','Escalas']] as const).map(([view,label],i)=><button key={view} aria-current={activeNav===view?'page':undefined} onClick={()=>navigate({view},true)}><span className="nav-index" aria-hidden="true">0{i+1}</span>{label}</button>)}</nav>
   <div className="institution"><span>UNIVERSIDADE ESTADUAL<br/>DA PARAÍBA</span></div>
  </aside>
  {menuOpen&&<button className="menu-scrim no-print" aria-label="Fechar menu" onClick={()=>setMenuOpen(false)}/>}
  <div className="main-area">
   <header className="page-top no-print"><button className="mobile-menu button secondary" aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={()=>setMenuOpen(!menuOpen)}>Menu</button><span>Clínica da Dor<span className="top-divider">/</span>{route.view==='dashboard'?'Acompanhamento':titles[route.view]}</span><span className="top-badge">NUTES / UEPB</span></header>
   <main className="page-grid">
    <div className="page-heading no-print"><div><span className="eyebrow">{route.view==='dashboard'?'Acompanhamento de pacientes':'Clínica da Dor'}</span><h1>{titles[route.view]}</h1></div>{route.view!=='dashboard'&&<button className="button secondary" onClick={back}>← Voltar</button>}</div>
    {route.view==='dashboard'&&<>
     <div className="dashboard-stats"><div className="stat"><span>Pacientes</span><strong>{patients.length}</strong></div><div className="stat"><span>Registros de avaliação</span><strong>{data?.evaluations.length??0}</strong></div><div className="stat"><span>Formulários disponíveis</span><strong>3</strong></div></div>
     <div className="dashboard-body"><section className="source-card"><div className="section-heading"><h2>Importar respostas</h2><span className="source-pill">{sources.length?`${sources.length} fonte(s) carregada(s)`:'Nenhuma planilha carregada'}</span></div>
      <label className="field-label" htmlFor="sheet-url">Link do Google Sheets</label><div className="url-row"><input id="sheet-url" inputMode="url" value={sheetUrl} onChange={e=>setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" onKeyDown={e=>{if(e.key==='Enter'&&!loading)void sync();}}/><button className="button primary" onClick={()=>void sync()} disabled={loading||!sheetUrl.trim()}>{loading?'Carregando…':'Sincronizar'}</button></div>
      <p className="helper">Se o link exigir autenticação, use o arquivo XLSX baixado.</p><div className="divider">Ou abra os arquivos no seu computador</div><label className="button secondary file-button">Abrir arquivo XLSX<input type="file" accept=".xlsx,.xls" multiple onChange={localFile} disabled={loading}/></label>
      <p className="helper">Você pode carregar as planilhas de PCS/PROMIS-29 e SF-36 juntas. Cada linha permanece como uma avaliação independente.</p>
      {error&&<div className="alert" role="alert">{error}</div>}{data&&<><div className="load-summary" role="status">{sources.map(s=><div key={s}>{s}</div>)}</div><button className="button secondary" style={{marginTop:16}} disabled={loading} onClick={()=>{setData(null);setError('');}}>Limpar importação</button></>}
     </section><div className="quick-grid"><button className="quick-card" onClick={()=>navigate({view:'patients'})}><span className="eyebrow">Por paciente</span><h2>Prontuário de avaliações <span>→</span></h2><p>Escolha o paciente, o registro e a escala.</p></button><button className="quick-card" onClick={()=>navigate({view:'scales'})}><span className="eyebrow">Por instrumento</span><h2>Consultar escalas <span>→</span></h2><p>PCS, PROMIS-29 e SF-36.</p></button></div></div>
     {!!data?.warnings.length&&<details className="warnings-card"><summary>Avisos da importação ({data.warnings.length})</summary><ul>{data.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}
    </>}
    {route.view==='scales'&&scales(false)}
    {['patients','scalePatients'].includes(route.view)&&<section className="patient-directory">{!data?empty:<>
     <label className="field-label" htmlFor="patient-search">Buscar por nome ou ID</label><input id="patient-search" className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome ou identificação do paciente"/><p className="helper">{filtered.length} paciente(s){route.view==='scalePatients'?` com registros de ${SCALE_NAMES[scale]}`:''}</p>
     <div className="directory-list">{filtered.map(p=><article className="directory-row" key={p.key}><button className="patient-link" onClick={()=>navigate({view:route.view==='scalePatients'?'overview':'patient',patient:p.key,scale})}><span className="avatar" aria-hidden="true">{(p.name||'?').charAt(0).toUpperCase()}</span><span><strong>{p.name||'Paciente sem nome'}</strong><small>ID: {p.id||'Não informado'} · {p.evaluations.filter(e=>route.view!=='scalePatients'||e.scales.includes(scale)).length} avaliação(ões)</small></span></button><button className="button secondary" onClick={()=>navigate({view:route.view==='scalePatients'?'overview':'patient',patient:p.key,scale})}>{route.view==='scalePatients'?'Consultar':'Avaliações e escalas'} →</button></article>)}</div>
     {!filtered.length&&<p className="empty-small">Nenhum paciente encontrado. Confira a busca e a planilha importada.</p>}
    </>}</section>}
    {route.view==='patient'&&(patient&&evaluation?<>
     <section className="patient-profile"><span className="eyebrow">Paciente</span><h2>{patient.name||'Paciente sem nome'}</h2><p className="helper">ID: {patient.id||'Não informado'}</p><EvaluationPicker evaluations={patient.evaluations} selected={evaluation} onChange={selectRow}/><PatientFields evaluation={evaluation}/><p className="source-record">Registro: {evaluation.sourceLabel} · {evaluation.sheetName} · linha {evaluation.rowNumber}</p></section>
     <h2 className="subheading">Escalas do paciente</h2>{scales(true)}
    </>:empty)}
    {inScale&&(patient&&evaluation?scale==='pcs'?<EvaluationReport selectedPatient={{...patient,evaluations:relevantEvaluations}} selectedEvaluation={evaluation} pcsResult={result} setSelectedEvaluationRow={selectRow} detailed={route.view==='details'} onDetails={()=>navigate({...route,view:'details',row:evaluation.recordKey})}/>:<section className="print-report">
     <div className="print-only"><h1>Clínica da Dor — {SCALE_NAMES[scale]}</h1></div><div className="patient-header"><div><span className="eyebrow">Paciente</span><h2>{patient.name||'Paciente sem nome'}</h2><p>ID: {patient.id||'Não informado'} · {SCALE_NAMES[scale]}</p></div><span className="eyebrow">Consulta de respostas</span></div>
     <EvaluationPicker evaluations={relevantEvaluations} selected={evaluation} onChange={selectRow}/><PatientFields evaluation={evaluation}/><p className="source-record">Registro: {evaluation.sourceLabel} · {evaluation.sheetName} · linha {evaluation.rowNumber}</p><p className="helper">As marcações reproduzem o formulário enviado. Esta escala não tem cálculo de escores nesta versão.</p>
     <FormResponses evaluation={evaluation} scale={scale}/><details className="original-fields no-print"><summary>Consultar todos os campos originais da planilha</summary><dl className="field-grid raw-fields">{Object.entries(evaluation.fields).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value||'Não informado'}</dd></div>)}</dl></details><div className="actions-row no-print"><button className="button primary" onClick={()=>window.print()}>Imprimir respostas / salvar PDF</button></div>
    </section>:empty)}
    <footer className="clinical-note">A ferramenta organiza as respostas e automatiza a apuração da PCS. Os resultados devem ser interpretados em conjunto com a avaliação clínica.</footer>
   </main>
  </div>
 </div>;
}
function PatientFields({evaluation}:{evaluation:Evaluation}){
 const fields=Object.entries(evaluation.fields).filter(([key])=>!fieldScale(key)&&!key.includes('['));
 return <dl className="field-grid">{fields.map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value||'Não informado'}</dd></div>)}</dl>;
}
export default App;
