// Questions and response codes from “Escalas e Instrumentos escolhidos.docx”.
// This document defines the questionnaire, but does not define score calculation.
export interface Sf36Question {
  key: string;
  label: string;
}

export interface Sf36Section {
  number: number;
  intro: string;
  questions: Sf36Question[];
}

const single = (number: number, label: string): Sf36Section => ({
  number, intro: '', questions: [{ key: String(number), label }],
});
const multiple = (number: number, intro: string, labels: string[]): Sf36Section => ({
  number, intro,
  questions: labels.map((label, index) => ({ key: `${number}${String.fromCharCode(97 + index)}`, label: `${String.fromCharCode(97 + index)}) ${label}` })),
});

export const SF36_SECTIONS: Sf36Section[] = [
  single(1, '1 — Em geral você diria que sua saúde é:'),
  single(2, '2 — Comparada há um ano atrás, como você se classificaria sua saúde em geral, agora?'),
  multiple(3, '3 — Os seguintes itens são sobre atividades que você poderia fazer atualmente durante um dia comum. Devido à sua saúde, você teria dificuldade para fazer estas atividades? Neste caso, quando?', [
    'Atividades rigorosas, que exigem muito esforço, tais como correr, levantar objetos pesados, participar em esportes árduos.',
    'Atividades moderadas, tais como mover uma mesa, passar aspirador de pó, jogar bola, varrer a casa.',
    'Levantar ou carregar mantimentos', 'Subir vários lances de escada', 'Subir um lance de escada',
    'Curvar-se, ajoelhar-se ou dobrar-se', 'Andar mais de 1 quilômetro', 'Andar vários quarteirões',
    'Andar um quarteirão', 'Tomar banho ou vestir-se',
  ]),
  multiple(4, '4 — Durante as últimas 4 semanas, você teve algum dos seguintes problemas com seu trabalho ou com alguma atividade regular, como consequência de sua saúde física?', [
    'Você diminuiu a quantidade de tempo que se dedicava ao seu trabalho ou a outras atividades?',
    'Realizou menos tarefas do que você gostaria?', 'Esteve limitado no seu tipo de trabalho ou a outras atividades.',
    'Teve dificuldade de fazer seu trabalho ou outras atividades (p. ex., necessitou de um esforço extra).',
  ]),
  multiple(5, '5 — Durante as últimas 4 semanas, você teve algum dos seguintes problemas com seu trabalho ou outra atividade regular diária, como consequência de algum problema emocional (como se sentir deprimido ou ansioso)?', [
    'Você diminuiu a quantidade de tempo que se dedicava ao seu trabalho ou a outras atividades?',
    'Realizou menos tarefas do que você gostaria?',
    'Não realizou ou fez qualquer das atividades com tanto cuidado como geralmente faz.',
  ]),
  single(6, '6 — Durante as últimas 4 semanas, de que maneira sua saúde física ou problemas emocionais interferiram nas suas atividades sociais normais, em relação à família, amigos ou em grupo?'),
  single(7, '7 — Quanta dor no corpo você teve durante as últimas 4 semanas?'),
  single(8, '8 — Durante as últimas 4 semanas, quanto a dor interferiu com seu trabalho normal (incluindo o trabalho dentro de casa)?'),
  multiple(9, '9 — Estas questões são sobre como você se sente e como tudo tem acontecido com você durante as últimas 4 semanas. Para cada questão, por favor dê uma resposta que mais se aproxime da maneira como você se sente, em relação às últimas 4 semanas.', [
    'Quanto tempo você tem se sentido cheio de vigor, de vontade, de força?',
    'Quanto tempo você tem se sentido uma pessoa muito nervosa?',
    'Quanto tempo você tem se sentido tão deprimido que nada pode animá-lo?',
    'Quanto tempo você tem se sentido calmo ou tranquilo?', 'Quanto tempo você tem se sentido com muita energia?',
    'Quanto tempo você tem se sentido desanimado ou abatido?', 'Quanto tempo você tem se sentido esgotado?',
    'Quanto tempo você tem se sentido uma pessoa feliz?', 'Quanto tempo você tem se sentido cansado?',
  ]),
  single(10, '10 — Durante as últimas 4 semanas, quanto de seu tempo a sua saúde física ou problemas emocionais interferiram com as suas atividades sociais (como visitar amigos, parentes, etc.)?'),
  multiple(11, '11 — O quanto verdadeiro ou falso é cada uma das afirmações para você?', [
    'Eu costumo adoecer um pouco mais facilmente que as outras pessoas',
    'Eu sou tão saudável quanto qualquer pessoa que eu conheço', 'Eu acho que a minha saúde vai piorar',
    'Minha saúde é excelente',
  ]),
];
