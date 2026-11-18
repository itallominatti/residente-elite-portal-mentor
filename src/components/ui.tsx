/* Peças de interface. As classes vêm do protótipo (src/styles), para o app e o desenho não divergirem. */
import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarClock, ChevronRight, FileX, Loader2, Lock, Moon, Target, TrendingDown, type LucideProps } from 'lucide-react';
import { ROTULO_DA_SITUACAO, TOM_DA_SITUACAO, type Situacao } from '@/lib/carteira';
import { iniciais, tomDe } from '@/lib/format';
import type { Motivo } from '@/lib/api/mentoring';

type Icon = ComponentType<LucideProps>;
export type Tom = 'teal' | 'amber' | 'ok' | 'bad' | 'blue' | 'violet' | 'muted' | 'neutral';
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

interface BtnProps {
  children?: ReactNode; to?: string; onClick?: () => void; kind?: 'p' | 's' | 'g' | 'a' | 'ai' | 'danger';
  sm?: boolean; full?: boolean; icon?: Icon; disabled?: boolean; locked?: boolean; title?: string;
  type?: 'button' | 'submit'; className?: string; 'aria-label'?: string;
}
export function Btn({ children, to, onClick, kind = 'p', sm, full, icon: I, disabled, locked, title, type = 'button', className, ...rest }: BtnProps) {
  const cls = cx('btn', `btn-${kind}`, sm && 'sm', full && 'full', locked && 'locked', className);
  const inner = <>{locked ? <Lock size={sm ? 13 : 15} aria-hidden /> : I && <I size={sm ? 14 : 16} aria-hidden />}{children && <span>{children}</span>}</>;
  if (to && !disabled && !locked) return <Link className={cls} to={to} title={title} aria-label={rest['aria-label']}>{inner}</Link>;
  return <button type={type} className={cls} onClick={onClick} disabled={disabled || locked} aria-disabled={locked || undefined} title={title ?? (locked ? 'Somente leitura' : undefined)} aria-label={rest['aria-label']}>{inner}</button>;
}

export const Pill = ({ tone = 'neutral', icon: I, children }: { tone?: Tom; icon?: Icon; children: ReactNode }) =>
  <span className={`pill tone-${tone}`}>{I && <I size={12} aria-hidden />}{children}</span>;
export const DotPill = ({ tone, children }: { tone: Tom; children: ReactNode }) =>
  <span className={`pill tone-${tone}`}><i className="dotl" />{children}</span>;
export const Tile = ({ icon: I, tone = 'teal', size = 36 }: { icon: Icon; tone?: Tom; size?: number }) =>
  <span className={`tile tone-${tone}`} style={{ width: size, height: size }}><I size={Math.round(size * 0.5)} aria-hidden /></span>;

export function Avatar({ nome, id, size = 34, status }: { nome: string; id?: string; size?: number; status?: Situacao }) {
  return (
    <span className={`av tone-${tomDe(id ?? nome)}`} style={{ width: size, height: size, fontSize: size >= 44 ? 15 : size <= 28 ? 11 : 12 }} aria-hidden>
      {iniciais(nome)}{status && <i className={`st tone-${TOM_DA_SITUACAO[status]}`} />}
    </span>
  );
}

export function Card({ title, sub, icon, iconTone, right, children, className, flush }: { title?: ReactNode; sub?: ReactNode; icon?: Icon; iconTone?: Tom; right?: ReactNode; children?: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cx('card', flush && 'flush', className)}>
      {title && (
        <header className="card-h" style={flush ? { padding: '16px 16px 6px' } : undefined}>
          {icon && <Tile icon={icon} tone={iconTone} size={28} />}
          <h2 className="t-title">{title}</h2>
          {sub && <span className="t-small muted">{sub}</span>}
          {right && <span className="push">{right}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stats({ items }: { items: { label: string; value: ReactNode; tone?: Tom; extra?: ReactNode; to?: string }[] }) {
  return (
    <div className="stats">
      {items.map(s => {
        const inner = <><span className="t-label">{s.label}</span><span className={cx('t-num', s.tone && s.tone !== 'neutral' && `c-${s.tone === 'muted' ? 'teal' : s.tone}`)}>{s.value}</span>{s.extra && <span className="t-small muted">{s.extra}</span>}</>;
        return s.to ? <Link key={s.label} className="stat" to={s.to}>{inner}</Link> : <div key={s.label} className="stat">{inner}</div>;
      })}
    </div>
  );
}

export const Callout = ({ icon: I, tone, children }: { icon: Icon; tone: Tom; children: ReactNode }) =>
  <div className={`callout tone-${tone}`}><I size={18} aria-hidden /><div className="grow">{children}</div></div>;

export const Empty = ({ icon, title, children, action }: { icon: Icon; title: string; children?: ReactNode; action?: ReactNode }) => (
  <div className="empty"><Tile icon={icon} tone="muted" size={52} /><h3 className="t-title">{title}</h3>{children && <p className="t-body muted">{children}</p>}{action}</div>
);

export const Loading = ({ children = 'Carregando…' }: { children?: ReactNode }) =>
  <div className="loading" role="status"><Loader2 size={18} className="spin" aria-hidden />{children}</div>;

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Algo deu errado.';
  return (
    <div className="card err-box" role="alert">
      <Callout icon={AlertCircle} tone="bad"><p className="t-strong">Não foi possível carregar</p><p className="t-small">{msg} Seus dados não foram alterados.</p></Callout>
      {onRetry && <Btn kind="s" sm onClick={onRetry}>Tentar de novo</Btn>}
    </div>
  );
}

export const SituacaoPill = ({ s }: { s: Situacao }) => <DotPill tone={TOM_DA_SITUACAO[s]}>{ROTULO_DA_SITUACAO[s]}</DotPill>;

export const ICONE_DO_MOTIVO: Record<string, Icon> = {
  sem_questoes_7d: Moon, meta_baixa_2_semanas: Target, revisoes_atrasadas: CalendarClock, queda_de_acerto: TrendingDown, simulado_abandonado: FileX,
};
export const ROTULO_CURTO_DO_MOTIVO: Record<string, string> = {
  sem_questoes_7d: 'Sem questões', meta_baixa_2_semanas: 'Meta baixa', revisoes_atrasadas: 'Revisões atrasadas', queda_de_acerto: 'Queda de acerto', simulado_abandonado: 'Simulado parado',
};
export const MotivoPill = ({ m, tone = 'amber' }: { m: Motivo; tone?: Tom }) =>
  <Pill tone={tone} icon={ICONE_DO_MOTIVO[m.codigo] ?? AlertCircle}>{m.texto}</Pill>;

export const Kv = ({ k, v, tone }: { k: ReactNode; v: ReactNode; tone?: Tom }) =>
  <div className="kv"><span className="t-small muted">{k}</span><span className={cx('t-small-strong', tone && `c-${tone}`)}>{v}</span></div>;

export const Bar = ({ p, tone = 'teal', h = 6 }: { p: number; tone?: Tom; h?: number }) =>
  <div className="bar" style={{ height: h }} role="img" aria-label={`${Math.round(p)}%`}><span className={`fill-${tone}`} style={{ width: `${Math.max(1, Math.min(100, p))}%` }} /></div>;

export function Tabs({ items, on }: { items: { label: string; to: string; count?: number }[]; on: number }) {
  return (
    <div className="tabs-wrap"><nav className="tabs" aria-label="Seções">
      {items.map((t, i) => <Link key={t.to} to={t.to} className={i === on ? 'on' : ''} aria-current={i === on ? 'page' : undefined}>{t.label}{t.count != null && <span className="count">{t.count}</span>}</Link>)}
    </nav></div>
  );
}

export function PageHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return <div className="page-h"><div><h1 className="t-h1">{title}</h1>{sub && <p className="t-body muted">{sub}</p>}</div>{right && <div className="hrow wrap">{right}</div>}</div>;
}

export const Chev = () => <ChevronRight size={16} className="chev" aria-hidden />;
