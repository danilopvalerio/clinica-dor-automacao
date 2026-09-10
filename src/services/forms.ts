import { Evaluation } from '../types';
export type ScaleId = 'pcs' | 'promis' | 'sf36';
export const SCALE_NAMES: Record<ScaleId,string> = {pcs:'PCS',promis:'PROMIS-29',sf36:'SF-36'};
export const normalize = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
export interface Choice {code:number;label:string}
export interface FormGroup {id:string; title:string; period:string; expected:number; match:(header:string)=>boolean; options:(header:string)=>Choice[]}
const choices = (labels:string[], codes?:number[]) => labels.map((label,i)=>({label,code:codes?.[i]??i+1}));
const frequency=choices(['Nunca','Raramente','Às vezes','Frequentemente','Sempre']);
const intensity=choices(['De modo nenhum','Um pouco','Mais ou menos','Bastante','Muitíssimo']);
const reversedIntensity=choices(['De modo nenhum','Um pouco','Mais ou menos','Bastante','Muitíssimo'],[5,4,3,2,1]);
const yesNo=choices(['Sim','Não']);
const promisGroups:FormGroup[] = [
 {id:'physical',title:'Função física',expected:4,period:'Capacidade atual',match:h=>h.startsWith('funcao fisica'),options:()=>choices(['Sem nenhuma dificuldade','Com um pouco de dificuldade','Com alguma dificuldade','Com muita dificuldade','Incapaz de fazer'],[5,4,3,2,1])},
 {id:'anxiety',title:'Ansiedade',expected:4,period:'Nos últimos 7 dias',match:h=>h.startsWith('ansiedade'),options:()=>frequency},
 {id:'depression',title:'Depressão',expected:4,period:'Nos últimos 7 dias',match:h=>h.startsWith('depressao'),options:()=>frequency},
 {id:'fatigue',title:'Fadiga',expected:4,period:'Durante os últimos 7 dias',match:h=>h.startsWith('fadiga'),options:()=>intensity},
 {id:'sleep',title:'Distúrbio do sono',expected:4,period:'Nos últimos 7 dias',match:h=>h.startsWith('disturbio do sono'),options:h=>/\[17\.|qualidade do meu sono/.test(h)?choices(['Muito ruim','Ruim','Razoável','Boa','Muito boa'],[5,4,3,2,1]):reversedIntensity},
 {id:'social',title:'Papéis e atividades sociais',expected:4,period:'Nos últimos 7 dias',match:h=>h.startsWith('capacidade de participar'),options:()=>choices(['Nunca','Raramente','Às vezes','Quase sempre','Sempre'],[5,4,3,2,1])},
 {id:'interference',title:'Interferência da dor',expected:4,period:'Nos últimos 7 dias',match:h=>h.startsWith('interferencia da dor'),options:()=>intensity},
 {id:'pain',title:'Intensidade da dor',expected:1,period:'Nos últimos 7 dias',match:h=>h.includes('como voce avaliaria a sua dor')&&h.includes('7 dias'),options:()=>Array.from({length:11},(_,code)=>({code,label:code===0?'Nenhuma dor':code===10?'Pior dor possível':String(code)}))},
];
const sfGroup=(id:number,title:string,expected:number,match:(h:string)=>boolean,opts:Choice[],period='Nas últimas 4 semanas'):FormGroup=>({id:`sf${id}`,title,expected,match,period,options:()=>opts});
const sfGroups:FormGroup[] = [
 sfGroup(1,'Saúde em geral',1,h=>h.includes('em geral voce diria que sua saude'),choices(['Excelente','Muito boa','Boa','Ruim','Muito ruim']),'Percepção atual'),
 sfGroup(2,'Comparação com o ano anterior',1,h=>h.includes('comparada')&&h.includes('ano atras'),choices(['Muito melhor','Um pouco melhor','Quase a mesma','Um pouco pior','Muito pior']),'Em relação a um ano atrás'),
 sfGroup(3,'Atividades do dia a dia',10,h=>h.includes('seguintes itens')&&h.includes('atividades')&&h.includes('atualmente'),choices(['Sim, dificulta muito','Sim, dificulta um pouco','Não, não dificulta de modo algum']),'Atualmente, durante um dia comum'),
 sfGroup(4,'Trabalho e saúde física',4,h=>h.includes('seguintes problemas')&&h.includes('saude fisica'),yesNo),
 sfGroup(5,'Trabalho e aspectos emocionais',3,h=>h.includes('seguintes problemas')&&h.includes('problema emocional'),yesNo),
 sfGroup(6,'Interferência nas atividades sociais',1,h=>h.includes('de que maneira')&&h.includes('atividades sociais'),choices(['De forma nenhuma','Ligeiramente','Moderadamente','Bastante','Extremamente'])),
 sfGroup(7,'Dor no corpo',1,h=>h.includes('quanta dor no corpo'),choices(['Nenhuma','Muito leve','Leve','Moderada','Grave','Muito grave'])),
 sfGroup(8,'Interferência da dor no trabalho',1,h=>h.includes('quanto a dor interferiu')&&h.includes('trabalho normal'),choices(['De maneira alguma','Um pouco','Moderadamente','Bastante','Extremamente'])),
 sfGroup(9,'Sentimentos e disposição',9,h=>h.includes('estas questoes')&&h.includes('como voce se sente'),choices(['Todo tempo','A maior parte do tempo','Uma boa parte do tempo','Alguma parte do tempo','Uma pequena parte do tempo','Nunca'])),
 sfGroup(10,'Tempo de interferência social',1,h=>h.includes('quanto de seu tempo')&&h.includes('atividades sociais'),choices(['Todo tempo','A maior parte do tempo','Alguma parte do tempo','Uma pequena parte do tempo','Nenhuma parte do tempo'])),
 sfGroup(11,'Percepções sobre a saúde',4,h=>h.includes('verdadeiro ou falso')&&h.includes('afirmac'),choices(['Definitivamente verdadeiro','A maioria das vezes verdadeiro','Não sei','A maioria das vezes falso','Definitivamente falso']),'Percepção geral'),
];
export const FORM_GROUPS={promis:promisGroups,sf36:sfGroups};
export function fieldScale(header:string):ScaleId|undefined {
 const h=normalize(header);
 if(h.startsWith('quando estou sentindo dor'))return 'pcs';
 if(promisGroups.some(g=>g.match(h)))return 'promis';
 if(sfGroups.some(g=>g.match(h)))return 'sf36';
}
export function organizedResponses(evaluation:Evaluation,scale:'promis'|'sf36') {
 return FORM_GROUPS[scale].map(group=>({...group,questions:Object.entries(evaluation.fields).filter(([header])=>group.match(normalize(header))).map(([header,value])=>({header,value,label:header.match(/\[(.*)\]/)?.[1]??header,options:group.options(normalize(header))})).sort((a,b)=>{const order=(s:string)=>{const m=s.match(/^(\d+|[a-z])[.)]/i);return m?(/^\d+$/.test(m[1])?Number(m[1]):m[1].toLowerCase().charCodeAt(0)):null;};const x=order(a.label),y=order(b.label);return x!==null&&y!==null?x-y:0;})}));
}
// Keep original values visible. Only select a known option when its label/code
// agrees with the form; unknown or contradictory values are never guessed.
export function selectedChoice(value:string,options:Choice[]):number|undefined {
 const v=normalize(value);
 if(!v)return;
 const plain=options.find(o=>normalize(o.label)===v);
 if(plain)return plain.code;
 if(/^\d+$/.test(v)){const n=Number(v);return options.some(o=>o.code===n)?n:undefined;}
 const end=v.match(/^(.*?)\s*\((\d+)\)$/);
 const start=v.match(/^(\d+)\s*[-:]\s*(.+)$/);
 const code=end?Number(end[2]):start?Number(start[1]):undefined;
 const label=end?end[1]:start?start[2]:undefined;
 return options.find(o=>o.code===code&&normalize(o.label)===label?.trim())?.code;
}
