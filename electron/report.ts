export interface ReportPayload {
  patient: {
    id: string;
    name: string;
    date: string;
    researcher: string;
    moment: string;
  };
  pcs: {
    rumination: number;
    magnification: number;
    helplessness: number;
    total: number;
    ruminationSignificant: boolean;
    magnificationSignificant: boolean;
    helplessnessSignificant: boolean;
    totalLabel: string;
  };
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const significance = (value: boolean) =>
  value ? 'Pontuação significativa' : 'Pontuação não significativa';

export function renderReportHtml(payload: ReportPayload): string {
  const p = payload.patient;
  const pcs = payload.pcs;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório PCS - ${escapeHtml(p.id)}</title>
<style>
  @page { size: A4; margin: 17mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #17343a; margin: 0; line-height: 1.45; }
  .top { border-bottom: 4px solid #0b7181; padding-bottom: 14px; margin-bottom: 20px; }
  h1 { margin: 0 0 4px; font-size: 24px; color: #0b5260; }
  .subtitle { color: #5d7378; font-size: 13px; }
  .patient { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 22px; padding: 14px; background: #f2f8f8; border-radius: 10px; margin-bottom: 22px; }
  .field small { display: block; text-transform: uppercase; letter-spacing: .04em; color: #6b7e82; font-size: 10px; }
  .field strong { font-size: 13px; }
  h2 { font-size: 17px; color: #0b5260; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  th { text-align: left; background: #0b7181; color: white; font-size: 12px; padding: 9px; }
  td { border-bottom: 1px solid #d7e3e5; padding: 10px 9px; font-size: 12px; }
  td:nth-child(2) { font-weight: 700; width: 22%; }
  .total { border: 1px solid #b8d5d9; border-radius: 10px; padding: 15px; margin-top: 8px; }
  .total-score { font-size: 28px; color: #0b5260; font-weight: 800; }
  .classification { font-weight: 700; margin-top: 3px; }
  .note { margin-top: 28px; font-size: 10px; color: #64777b; border-top: 1px solid #d7e3e5; padding-top: 10px; }
</style>
</head>
<body>
  <section class="top">
    <h1>Clínica da Dor — UEPB</h1>
    <div class="subtitle">Relatório automatizado — Escala de Catastrofização da Dor (PCS)</div>
  </section>

  <section class="patient">
    <div class="field"><small>Código/ID</small><strong>${escapeHtml(p.id)}</strong></div>
    <div class="field"><small>Paciente</small><strong>${escapeHtml(p.name)}</strong></div>
    <div class="field"><small>Data da avaliação</small><strong>${escapeHtml(p.date || '—')}</strong></div>
    <div class="field"><small>Momento</small><strong>${escapeHtml(p.moment || '—')}</strong></div>
    <div class="field"><small>Responsável pela coleta</small><strong>${escapeHtml(p.researcher || '—')}</strong></div>
  </section>

  <h2>Apuração das subescalas</h2>
  <table>
    <thead><tr><th>Subescala</th><th>Escore</th><th>Interpretação</th></tr></thead>
    <tbody>
      <tr><td>Ruminação</td><td>${pcs.rumination} / 16</td><td>${significance(pcs.ruminationSignificant)}</td></tr>
      <tr><td>Magnificação</td><td>${pcs.magnification} / 12</td><td>${significance(pcs.magnificationSignificant)}</td></tr>
      <tr><td>Desamparo</td><td>${pcs.helplessness} / 24</td><td>${significance(pcs.helplessnessSignificant)}</td></tr>
    </tbody>
  </table>

  <section class="total">
    <div>Escore total PCS</div>
    <div class="total-score">${pcs.total} / 52</div>
    <div class="classification">${escapeHtml(pcs.totalLabel)}</div>
  </section>

  <div class="note">
    Este documento apresenta a apuração automatizada da PCS e não substitui a avaliação clínica do paciente.
  </div>
</body>
</html>`;
}
