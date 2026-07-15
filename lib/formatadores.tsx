import type { Apontamento } from './types'

// ─── Helper: formatar quantidade de um apontamento ────────────────────────────
// Lida com os 3 tipos contador_duplo (Máquina, Crimpagem, Clivagem com Defeito)
// onde quantidade_ml na verdade guarda a segunda quantidade em peças.
export function formatarQtdApontamento(a: Apontamento): React.ReactElement {
  const labelsDuplos: Record<string, { p: string; s: string; corS: string }> = {
    'Máquina':              { p: 'retr', s: 'perd',  corS: 'var(--signal-red)'   },
    'Crimpagem':            { p: 'perd', s: 'manut', corS: 'var(--signal-amber)' },
    'Clivagem com Defeito': { p: 'retr', s: 'perd',  corS: 'var(--signal-red)'   },
    'Clivagem Proximal':    { p: 'retr', s: 'perd',  corS: 'var(--signal-red)'   },
    'Clivagem Distal':      { p: 'retr', s: 'perd',  corS: 'var(--signal-red)'   },
  }
  const dual = labelsDuplos[a.tipo_desperdicio]
  // Tipos duplos: quantidade_ml aqui guarda a 2ª quantidade (peças), nunca ml de verdade.
  // Aplica sempre que o tipo é duplo, mesmo quando só a perda foi apontada (sem retrabalho).
  if (dual && (a.quantidade_pecas != null || a.quantidade_ml != null)) {
    const temPrimaria = a.quantidade_pecas != null
    const temSecundaria = a.quantidade_ml != null && a.quantidade_ml > 0
    return (
      <span
        className="inline-flex items-center gap-1.5 font-bold tabular-nums"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}
      >
        {temPrimaria && (
          <span>
            {a.quantidade_pecas}{' '}
            <span
              className="text-[10px] font-semibold uppercase"
              style={{ color: 'var(--text-muted)' }}
            >
              {dual.p}
            </span>
          </span>
        )}
        {temPrimaria && temSecundaria && <span style={{ color: 'var(--text-faint)' }}>·</span>}
        {temSecundaria && (
          <span style={{ color: dual.corS }}>
            {a.quantidade_ml}{' '}
            <span className="text-[10px] font-semibold uppercase">{dual.s}</span>
          </span>
        )}
      </span>
    )
  }
  if (a.quantidade_pecas != null) {
    return (
      <span
        className="font-bold tabular-nums"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}
      >
        {a.quantidade_pecas}{' '}
        <span
          className="text-[10px] font-semibold uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          pç
        </span>
      </span>
    )
  }
  if (a.quantidade_ml != null) {
    return (
      <span
        className="font-bold tabular-nums"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}
      >
        {a.quantidade_ml}{' '}
        <span
          className="text-[10px] font-semibold uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          ml
        </span>
      </span>
    )
  }
  return <span style={{ color: 'var(--text-faint)' }}>—</span>
}
