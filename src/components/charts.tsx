/* Gráficos em SVG, sem biblioteca. Mesmos desenhos do protótipo; as classes (.chart, .heat) vêm de styles/components.css. */
const TOM: Record<string, string> = { teal: 'var(--teal)', ok: 'var(--ok)', bad: 'var(--bad)', amber: 'var(--amber)', blue: 'var(--blue)', violet: 'var(--violet)', muted: 'var(--ink3)' };
const W = 600, L = 34, R = 10, T = 12, B = 26;

export interface Serie { name: string; data: (number | null)[]; tone?: keyof typeof TOM; dash?: boolean }

/** Linhas com eixo fixo. `null` é lacuna (a linha se interrompe em vez de cair a zero). */
export function LineChart({ labels, series, min = 0, max = 100, ticks = [0, 25, 50, 75, 100], unit = '', label, every = 2, h = 190 }: {
  labels: string[]; series: Serie[]; min?: number; max?: number; ticks?: number[]; unit?: string; label: string; every?: number; h?: number;
}) {
  const X = (i: number) => L + (labels.length > 1 ? i / (labels.length - 1) : 0) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - min) / (max - min)) * (h - T - B);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label}>
      {ticks.map(t => <g key={t}><line className="grid" x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} /><text x={L - 6} y={Y(t) + 3.5} textAnchor="end">{t}{unit}</text></g>)}
      {labels.map((l, i) => (i % every === 0 || i === labels.length - 1) && <text key={i} x={X(i)} y={h - 8} textAnchor="middle">{l}</text>)}
      {series.map(s => {
        let d = '', pen = false;
        s.data.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)} `; pen = true; });
        const cor = TOM[s.tone ?? 'teal'];
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={cor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dash ? '5 4' : undefined} />
            {!s.dash && s.data.map((v, i) => v != null && <circle key={i} cx={X(i)} cy={Y(v)} r={3} fill="#fff" stroke={cor} strokeWidth={2}><title>{labels[i]}: {v}{unit}</title></circle>)}
          </g>
        );
      })}
    </svg>
  );
}

/** Colunas de volume; a coluna fica vermelha abaixo de metade da meta (quando há meta). */
export function ColChart({ labels, values, goal, goalLabel = 'meta', label, every = 2, h = 170, fmt = (v: number) => String(v) }: {
  labels: string[]; values: number[]; goal?: number; goalLabel?: string; label: string; every?: number; h?: number; fmt?: (v: number) => string;
}) {
  const mx = Math.max(1, ...values, goal ?? 0) * 1.1;
  const bw = (W - L - R) / values.length;
  const Y = (v: number) => T + (1 - v / mx) * (h - T - B);
  const ticks = [0, 0.5, 1].map(f => Math.round((mx * f) / 1.1 / 10) * 10);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label}>
      {[...new Set(ticks)].map(t => <g key={t}><line className="grid" x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} /><text x={L - 6} y={Y(t) + 3.5} textAnchor="end">{fmt(t)}</text></g>)}
      {values.map((v, i) => {
        const x = L + i * bw + bw * 0.18, w = bw * 0.64, y = Y(v), baixo = goal != null && v < goal * 0.5;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={Math.max(2, h - B - y)} rx={4} fill={baixo ? 'var(--bad)' : 'var(--teal)'} opacity={0.9}><title>{labels[i]}: {fmt(v)}</title></rect>
            {(i % every === 0 || i === values.length - 1) && <text x={x + w / 2} y={h - 8} textAnchor="middle">{labels[i]}</text>}
          </g>
        );
      })}
      {goal != null && <g><line className="goal" x1={L} x2={W - R} y1={Y(goal)} y2={Y(goal)} /><text x={W - R} y={Y(goal) - 5} textAnchor="end" style={{ fill: 'var(--amber-t)' }}>{goalLabel}</text></g>}
    </svg>
  );
}

/** Uma coluna por semana, domingo a sábado. Nível 0 a 4. */
export const Heat = ({ niveis, label }: { niveis: number[]; label: string }) => (
  <div className="heat" role="img" aria-label={label}>{niveis.map((n, i) => <i key={i} className={n ? `l${n}` : ''} />)}</div>
);

export const LegendaDaConstancia = () => (
  <div className="legend" aria-hidden>
    <span>menos</span>
    {['var(--track)', 'rgba(37,107,128,.28)', 'rgba(37,107,128,.5)', 'rgba(37,107,128,.75)', 'var(--teal-d)'].map(c => <span key={c}><i style={{ background: c }} /></span>)}
    <span>mais</span>
  </div>
);
