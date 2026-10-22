import refs from "./data/sf36References.json";
import type { Sf36DomainResult } from "./services/sf36";

export function Sf36DomainScale({ domain }: { domain: Sf36DomainResult }) {
  const reference = refs.find(
    (item) => item.label.toLocaleLowerCase("pt-BR") === domain.label.toLocaleLowerCase("pt-BR"),
  );
  const value = domain.score === null ? null : Math.max(0, Math.min(100, domain.score));
  return (
    <article
      className="sf-domain"
      aria-label={`${domain.label}: ${value === null ? "sem escore" : `${value} de 100`}`}
    >
      <div className="sf-domain-heading">Domínio: {domain.label}</div>
      <div className="sf-domain-content">
        <p className="sf-domain-description">
          {reference?.description || "Descrição do domínio não disponível."}
        </p>
        <div
          className="sf-axis"
          role="img"
          aria-label={`Escore ${value === null ? "indisponível" : value}; 0 baixo desempenho; 100 alto desempenho`}
        >
          <div className="sf-axis-extremes">
            <strong>0</strong>
            <strong>100</strong>
          </div>
          <div className="sf-axis-bar">
            <div className="sf-axis-gradient" />
            {Array.from({ length: 10 }, (_, index) => (
              <span className="sf-axis-tick" key={index} style={{ left: `${index * 10}%` }} />
            ))}
            {value !== null && (
              <div className="sf-axis-marker" style={{ left: `${value}%` }}>
                <span />
                <strong>{value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</strong>
              </div>
            )}
          </div>
        </div>
        <div className="sf-domain-interpretations">
          <div>
            <strong>← Baixo desempenho</strong>
            <p>{reference?.low || "—"}</p>
          </div>
          <div>
            <strong>Alto desempenho →</strong>
            <p>{reference?.high || "—"}</p>
          </div>
        </div>
        {value === null && (
          <p className="sf-domain-warning">
            Escore indisponível: respostas insuficientes ou que precisam de conferência.
          </p>
        )}
        {domain.estimated && (
          <p className="sf-domain-warning">Escore estimado por itens respondidos.</p>
        )}
      </div>
    </article>
  );
}
