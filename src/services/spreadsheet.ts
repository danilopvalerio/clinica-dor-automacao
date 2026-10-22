import * as XLSX from 'xlsx';
import { Evaluation, PatientGroup, PcsItemNumber, SpreadsheetParseResult } from '../types';
import { fieldScale, normalize, ScaleId } from './forms';
const FIELD_ALIASES={
 timestamp:['timestamp','carimbo de data/hora','carimbo de data e hora'],
 id:['codigo/id unico do paciente','codigo do paciente','id do paciente','cpf do paciente'],
 name:['nome completo do paciente','nome do paciente'],
 date:['data da avaliacao'],
 researcher:['extensionista/pesquisador(a) responsavel pela coleta','responsavel pela coleta'],
 moment:['momento da avaliacao'],
};
const findHeader=(headers:string[],aliases:string[])=>headers.find(h=>aliases.includes(normalize(h).replace(/^\d+[.)]\s*/,'')));
const asText=(v:unknown)=>String(v??'').trim();
// Google Forms occasionally stores the date with a General numeric Excel format.
export function displayDate(value:unknown):string {
 const raw=asText(value);
 if (/^\d{5}(?:\.0+)?$/.test(raw)) {
  const serial=Number(raw);
  if (serial>30000&&serial<90000) {
   const date=new Date(Date.UTC(1899,11,30)+serial*86400000);
   return `${String(date.getUTCDate()).padStart(2,'0')}/${String(date.getUTCMonth()+1).padStart(2,'0')}/${date.getUTCFullYear()}`;
  }
 }
 return raw;
}
function parsePcsValue(value:unknown):number|null {
 if(typeof value==='number')return Number.isInteger(value)&&value>=0&&value<=4?value:null;
 const match=asText(value).match(/^([0-4])(?:\s*[-–—:]\s*.*)?$/);
 return match?Number(match[1]):null;
}
export function parseSpreadsheet(data:ArrayBuffer|Uint8Array,sourceId='local',sourceLabel='Planilha',sourceKind:'auto'|'initial'='auto'):SpreadsheetParseResult {
 const workbook=XLSX.read(data,{type:'array',cellDates:true});
 const evaluations:Evaluation[]=[],warnings:string[]=[],readSheets:string[]=[];
 for(const sheetName of workbook.SheetNames){
  const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(workbook.Sheets[sheetName],{defval:'',raw:false,dateNF:'dd/mm/yyyy'});
  const headers=Object.keys(rows[0]??{});if(!headers.length)continue;
  const scales=Array.from(new Set(headers.map(fieldScale).filter((s):s is ScaleId=>!!s)));
  if(!scales.length&&sourceKind!=='initial'){warnings.push(`Aba “${sheetName}”: nenhum cabeçalho de escala reconhecido; aba ignorada.`);continue;}
  const meta=Object.fromEntries(Object.entries(FIELD_ALIASES).map(([key,aliases])=>[key,findHeader(headers,aliases)]));
  const required=sourceKind==='initial'?{id:'Código/ID único do paciente',name:'Nome completo do paciente',date:'Data da avaliação'}:{id:'Código/ID único do paciente',name:'Nome completo do paciente',date:'Data da avaliação',researcher:'Responsável pela coleta',moment:'Momento da avaliação'};
  const missing=Object.entries(required).filter(([key])=>!meta[key]).map(([,label])=>label);
  if(missing.length){warnings.push(`Aba “${sheetName}”: colunas obrigatórias ausentes (${missing.join(', ')}); aba ignorada.`);continue;}
  readSheets.push(sheetName);
  const pcsHeaders=new Map<PcsItemNumber,string>();
  for(const h of headers){if(fieldScale(h)!=='pcs')continue;const item=Number(h.match(/\[(\d{1,2})\./)?.[1]);if(item>=1&&item<=13)pcsHeaders.set(item as PcsItemNumber,h);}
  rows.forEach((row,index)=>{
   if(!Object.values(row).some(v=>asText(v)))return;
   const rowNumber=typeof row.__rowNum__==='number'?row.__rowNum__+1:index+2, id=asText(row[meta.id!]),name=asText(row[meta.name!]);
   const errors:string[]=[],pcsResponses={} as Evaluation['pcsResponses'],pcsQuestions={} as Evaluation['pcsQuestions'];
   for(let i=1;i<=13;i++){const item=i as PcsItemNumber,header=pcsHeaders.get(item);pcsResponses[item]=header?parsePcsValue(row[header]):null;pcsQuestions[item]=header?.match(/\[(.*)\]/)?.[1]??`Item ${i}`;if(scales.includes('pcs')&&pcsResponses[item]===null)errors.push(`Item PCS ${i}: resposta ausente ou inválida`);}
   if(!id)errors.push('Código/ID do paciente ausente');if(!name)errors.push('Nome do paciente ausente');
   if(errors.length)warnings.push(`${sheetName}, linha ${rowNumber}: ${errors.join('; ')}.`);
   evaluations.push({rowNumber,recordKey:JSON.stringify([sourceId,sheetName,rowNumber]),sourceId,sourceLabel,sheetName,scales,id,name,date:displayDate(row[meta.date!]),researcher:meta.researcher?asText(row[meta.researcher]):'',moment:meta.moment?asText(row[meta.moment]):'Avaliação inicial',timestamp:meta.timestamp?asText(row[meta.timestamp]):'',pcsResponses,pcsQuestions,errors,fields:Object.fromEntries(Object.entries(row).map(([k,v])=>[k,asText(v)]))});
  });
 }
 if(!evaluations.length)throw new Error(warnings.join(' ')||'Nenhuma avaliação foi encontrada. Confira os cabeçalhos da planilha.');
 return {evaluations,warnings,warningsBySource:{[sourceId]:warnings},sheetName:readSheets.join(', ')};
}
// Reimporting the same source refreshes its rows, while distinct form exports coexist.
export function mergeSpreadsheet(previous:SpreadsheetParseResult|null,next:SpreadsheetParseResult):SpreadsheetParseResult {
 const sources=new Set(next.evaluations.map(e=>e.sourceId));
 const warningsBySource={...previous?.warningsBySource,...next.warningsBySource};
 const evaluations=[...(previous?.evaluations??[]).filter(e=>!sources.has(e.sourceId)),...next.evaluations];
 return {evaluations,warningsBySource,warnings:Object.values(warningsBySource).flat(),sheetName:Array.from(new Set(evaluations.map(e=>e.sheetName))).join(', ')};
}
export function groupPatients(evaluations:Evaluation[]):PatientGroup[]{
 const groups=new Map<string,PatientGroup>();
 for(const e of evaluations){
  const key=e.id?`id:${normalize(e.id)}`:e.name?`name:${normalize(e.name)}`:`record:${e.recordKey}`;
  const p=groups.get(key);if(p){p.evaluations.push(e);if(!p.name&&e.name)p.name=e.name;}else groups.set(key,{key,id:e.id,name:e.name,evaluations:[e]});
 }
 return Array.from(groups.values()).map(p=>({...p,evaluations:[...p.evaluations].reverse()})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
