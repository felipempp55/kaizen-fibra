'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Cronômetro persistente ───────────────────────────────────────────────────
const TIMER_KEY = 'kaizen-timer-retrabalho'

interface TimerState {
  status: 'parado' | 'rodando' | 'pausado'
  elapsed: number
  startAt: number | null
}

const TIMER_INICIAL: TimerState = { status: 'parado', elapsed: 0, startAt: null }

function loadTimer(): TimerState {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    if (raw) return JSON.parse(raw) as TimerState
  } catch {}
  return TIMER_INICIAL
}

function saveTimer(t: TimerState) {
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(t)) } catch {}
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

import { salvarTempoRetrabalhoPolimento } from '@/app/actions'
import { GRUPOS_DESPERDICIO } from '@/lib/desperdicios'
import type { Classificacao, NovoApontamento, TipoDesperdicio, TipoFibra } from '@/lib/types'
import EtapaIndicador from './EtapaIndicador'
import BotaoGrande from './BotaoGrande'
import TecladoNumerico from './TecladoNumerico'

type TipoEtapa = 'grupo' | 'tipo' | 'operadora' | 'quantidade' | 'segunda_quantidade' | 'classificacao' | 'tempo' | 'confirmar'

const LABELS_ETAPA: Record<TipoEtapa, string> = {
  grupo: 'Grupo',
  tipo: 'Tipo',
  operadora: 'Operadora',
  quantidade: 'Quantidade',
  segunda_quantidade: 'Adicional',
  classificacao: 'Classificação',
  tempo: 'Tempo',
  confirmar: 'Confirmar',
}

const OPERADORAS = ['Janete', 'Poliana', 'Alice', 'Bruna Nascimento', 'Bruna Fernanda', 'Taísa', 'Beatriz']

function getSequencia(tipo: TipoDesperdicio | null): TipoEtapa[] {
  const base: TipoEtapa[] = ['grupo', 'tipo', 'operadora', 'quantidade']
  if (!tipo) return [...base, 'confirmar']
  if (tipo.segunda_quantidade && tipo.input !== 'contador_duplo') base.push('segunda_quantidade')
  if (tipo.classificacao !== 'nenhum') base.push('classificacao')
  if (tipo.tempo === 'sempre') base.push('tempo')
  base.push('confirmar')
  return base
}

const CLASSIFICACOES: { valor: Classificacao; label: string }[] = [
  { valor: 'perda',      label: 'Perda' },
  { valor: 'retrabalho', label: 'Retrabalho' },
]

function iniciais(nome: string): string {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('')
}

interface Props {
  op: string
  fibra: TipoFibra
  operador: string
  tamanho?: number
  onSalvar: (dados: NovoApontamento) => Promise<boolean | void>
}

export default function FormularioApontamento({ op, fibra, operador, tamanho, onSalvar }: Props) {
  // ── Cronômetro ──────────────────────────────────────────────────────────────
  const [timer, setTimer] = useState<TimerState>(TIMER_INICIAL)
  const [agora, setAgora] = useState(Date.now())
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { setTimer(loadTimer()) }, [])

  useEffect(() => {
    if (timer.status === 'rodando') {
      tickRef.current = setInterval(() => setAgora(Date.now()), 500)
    } else {
      if (tickRef.current) clearInterval(tickRef.current)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [timer.status])

  const displayMs = timer.status === 'rodando' && timer.startAt != null
    ? timer.elapsed + (agora - timer.startAt)
    : timer.elapsed

  function iniciarTimer() {
    const novo: TimerState = { status: 'rodando', elapsed: timer.elapsed, startAt: Date.now() }
    setTimer(novo); saveTimer(novo)
  }
  function pausarTimer() {
    const elapsed = timer.elapsed + (timer.startAt != null ? Date.now() - timer.startAt : 0)
    const novo: TimerState = { status: 'pausado', elapsed, startAt: null }
    setTimer(novo); saveTimer(novo)
  }
  async function concluirTimer() {
    // Captura o tempo final (mesmo se ainda estava rodando)
    const finalMs = timer.status === 'rodando' && timer.startAt != null
      ? timer.elapsed + (Date.now() - timer.startAt)
      : timer.elapsed

    if (finalMs >= 1000) { // só salva se tiver pelo menos 1 segundo
      const tempo_minutos = parseFloat((finalMs / 60000).toFixed(2))
      const custo_hh = parseFloat(((finalMs / 3600000) * 17).toFixed(2))
      try {
        await salvarTempoRetrabalhoPolimento({ numero_op: op, tempo_ms: finalMs, tempo_minutos, custo_hh })
      } catch { /* não bloqueia o reset em caso de erro */ }
    }

    setTimer(TIMER_INICIAL)
    saveTimer(TIMER_INICIAL)
  }

  // ── Formulário ───────────────────────────────────────────────────────────────
  const [etapa, setEtapa] = useState(0)
  const [grupoSelecionado, setGrupoSelecionado] = useState<string | null>(null)
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoDesperdicio | null>(null)
  const [operadoraSelecionada, setOperadoraSelecionada] = useState<string | null>(null)
  const [quantidade, setQuantidade] = useState('')
  const [segundaQuantidade, setSegundaQuantidade] = useState('')
  const [classificacao, setClassificacao] = useState<Classificacao | null>(null)
  const [tempoMinutos, setTempoMinutos] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const grupo = GRUPOS_DESPERDICIO.find((g) => g.nome === grupoSelecionado)
  const sequencia = getSequencia(tipoSelecionado)
  const etapaAtual = sequencia[etapa]
  const labels = sequencia.map((s) => LABELS_ETAPA[s])

  function avancar() { setEtapa((e) => Math.min(e + 1, sequencia.length - 1)) }
  function voltar()  { setEtapa((e) => Math.max(e - 1, 0)) }

  function resetar() {
    setEtapa(0)
    setGrupoSelecionado(null)
    setTipoSelecionado(null)
    setOperadoraSelecionada(null)
    setQuantidade('')
    setSegundaQuantidade('')
    setClassificacao(null)
    setTempoMinutos('')
    setSucesso(false)
  }

  async function confirmar() {
    if (!grupoSelecionado || !tipoSelecionado || !quantidade) return
    setSalvando(true)
    try {
      const ok = await onSalvar({
        grupo: grupoSelecionado,
        tipo_desperdicio: tipoSelecionado.nome,
        nome_operador: operadoraSelecionada ?? operador,
        numero_op: op.toUpperCase(),
        fibra,
        quantidade_pecas: tipoSelecionado.unidade === 'pecas' ? parseInt(quantidade) : null,
        quantidade_ml: tipoSelecionado.unidade === 'ml'
          ? parseFloat(quantidade.replace(',', '.'))
          : (tipoSelecionado.segunda_quantidade ? parseInt(segundaQuantidade || '0') : null),
        classificacao: tipoSelecionado.classificacao_fixa
          ?? (tipoSelecionado.classificacao !== 'nenhum' ? classificacao : null),
        tempo_minutos: tempoMinutos ? parseInt(tempoMinutos) : null,
        observacao: null,
        tamanho_op: tamanho ?? null,
      })
      // Só vai para a tela de sucesso se realmente salvou
      if (ok !== false) setSucesso(true)
    } catch (e) {
      // Erro inesperado — não destrói a tela. A mensagem é exibida pelo cockpit.
      console.error('[FormularioApontamento.confirmar]', e)
    } finally {
      setSalvando(false)
    }
  }

  function podeContinuar(): boolean {
    switch (etapaAtual) {
      case 'operadora': return !!operadoraSelecionada
      case 'quantidade':
        if (tipoSelecionado?.input === 'contador_duplo') return parseInt(quantidade || '0') > 0
        return quantidade.length > 0
      case 'segunda_quantidade': return segundaQuantidade.length > 0
      case 'classificacao': return !!classificacao
      case 'tempo': return tempoMinutos.length > 0
      default: return true
    }
  }

  const labelQtdPrincipal = tipoSelecionado?.label_quantidade
    ?? (tipoSelecionado?.unidade === 'ml' ? 'Quantidade (ml)' : 'Quantidade de peças')

  // ─── Tela de sucesso ────────────────────────────────────────────────────────
  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-10">
        {/* Checkmark SVG */}
        <svg width="108" height="108" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="60" fill="var(--signal-green-soft)" />
          <circle cx="64" cy="64" r="60" fill="none" stroke="var(--signal-green)" strokeWidth="2" opacity="0.3" />
          <circle cx="64" cy="64" r="40" fill="var(--signal-green)" />
          <path d="M48 64 L60 76 L82 54" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div className="text-center">
          <h2
            className="text-3xl font-extrabold"
            style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
          >
            Apontamento Salvo
          </h2>
          <p
            className="mt-2 text-sm font-semibold tracking-widest uppercase"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {tipoSelecionado?.nome} · {operadoraSelecionada} · OP {op}
          </p>
        </div>

        <button
          onClick={resetar}
          className="mt-2 font-bold text-lg px-8 py-4 rounded-xl transition-all active:scale-[0.97]"
          style={{
            background: 'var(--brand-primary)',
            color: '#fff',
            fontFamily: 'var(--font-display)',
            boxShadow: '0 4px 14px rgba(86,164,187,0.3)',
          }}
        >
          + Novo Apontamento
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <EtapaIndicador etapaAtual={etapa} totalEtapas={sequencia.length} labels={labels} />

      {/* ── GRUPO ──────────────────────────────────────────────────────── */}
      {etapaAtual === 'grupo' && (
        <div className="flex flex-col gap-4">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-1"
              style={{ color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}
            >
              ETAPA 1 — Selecione o grupo
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {GRUPOS_DESPERDICIO.map((g) => (
              <BotaoGrande
                key={g.nome}
                label={g.nome}
                selecionado={grupoSelecionado === g.nome}
                onClick={() => {
                  setGrupoSelecionado(g.nome)
                  setTipoSelecionado(null)
                  setQuantidade('')
                  setSegundaQuantidade('')
                  avancar()
                }}
              />
            ))}
          </div>

          {/* ── Cronômetro de Retrabalho ─────────────────────────── */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3 transition-colors"
            style={{
              border: `2px solid ${
                timer.status === 'rodando' ? 'var(--brand-primary)' :
                timer.status === 'pausado' ? 'var(--signal-amber)' :
                'var(--line)'
              }`,
              background: timer.status === 'rodando'
                ? 'var(--brand-primary-tint)'
                : timer.status === 'pausado'
                  ? 'var(--signal-amber-soft)'
                  : 'var(--bg-page)',
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: timer.status === 'rodando'
                    ? 'var(--brand-primary)'
                    : timer.status === 'pausado'
                      ? 'var(--signal-amber)'
                      : 'var(--line-strong)',
                  ...(timer.status === 'rodando' ? { animation: 'pulse-dot 1.6s ease-in-out infinite' } : {}),
                }}
              />
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}
              >
                Retrabalho Manual Pós Máquina
              </p>
            </div>

            <p
              className="text-5xl font-black tabular-nums text-center py-2"
              style={{
                fontFamily: 'var(--font-mono)',
                color: timer.status === 'rodando'
                  ? 'var(--brand-primary)'
                  : timer.status === 'pausado'
                    ? 'var(--signal-amber)'
                    : 'var(--line-strong)',
              }}
            >
              {formatMs(displayMs)}
            </p>

            <div className="flex gap-2">
              {timer.status === 'parado' && (
                <button
                  onClick={iniciarTimer}
                  className="flex-1 font-bold py-3 rounded-xl transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                  style={{ background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)' }}
                >
                  <IconPlay /> Iniciar
                </button>
              )}
              {timer.status === 'rodando' && (
                <button
                  onClick={pausarTimer}
                  className="flex-1 font-bold py-3 rounded-xl transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                  style={{ background: 'var(--signal-amber)', color: '#fff', fontFamily: 'var(--font-display)' }}
                >
                  <IconPause /> Pausar
                </button>
              )}
              {timer.status === 'pausado' && (
                <button
                  onClick={iniciarTimer}
                  className="flex-1 font-bold py-3 rounded-xl transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                  style={{ background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)' }}
                >
                  <IconPlay /> Retomar
                </button>
              )}
              {timer.status !== 'parado' && (
                <button
                  onClick={concluirTimer}
                  className="flex-1 font-bold py-3 rounded-xl transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                  style={{ background: 'var(--signal-red)', color: '#fff', fontFamily: 'var(--font-display)' }}
                >
                  <IconCheck /> Concluir
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TIPO ──────────────────────────────────────────────────────── */}
      {etapaAtual === 'tipo' && grupo && (
        <div className="flex flex-col gap-3">
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-1"
            style={{ color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}
          >
            ETAPA 2 — {grupo.nome}
          </p>
          {grupo.tipos.map((t) => (
            <BotaoGrande
              key={t.nome}
              label={t.nome}
              selecionado={tipoSelecionado?.nome === t.nome}
              onClick={() => {
                setTipoSelecionado(t)
                setQuantidade('')
                setClassificacao(null)
                setTempoMinutos('')
                setSegundaQuantidade('')
                avancar()
              }}
            />
          ))}
        </div>
      )}

      {/* ── OPERADORA ─────────────────────────────────────────────────── */}
      {etapaAtual === 'operadora' && (
        <div className="flex flex-col gap-3">
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-1"
            style={{ color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}
          >
            ETAPA 3 — Selecione a operadora
          </p>
          <div className="grid grid-cols-2 gap-3">
            {OPERADORAS.map((nome) => {
              const ativo = operadoraSelecionada === nome
              return (
                <button
                  key={nome}
                  onClick={() => { setOperadoraSelecionada(nome); avancar() }}
                  className="rounded-xl px-3 py-3.5 flex items-center gap-3 text-left transition-all active:scale-[0.97]"
                  style={{
                    background: ativo ? 'var(--brand-primary)' : '#fff',
                    color: ativo ? '#fff' : 'var(--text-strong)',
                    border: `2px solid ${ativo ? 'var(--brand-primary)' : 'var(--line)'}`,
                    boxShadow: ativo ? '0 4px 16px rgba(86,164,187,0.3)' : 'none',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{
                      background: ativo ? 'rgba(255,255,255,0.15)' : 'var(--brand-primary-soft)',
                      color: ativo ? '#fff' : 'var(--brand-primary-dark)',
                      border: ativo ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--brand-soft)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {iniciais(nome)}
                  </div>
                  <span className="font-bold text-sm leading-tight">{nome}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── QUANTIDADE — contador duplo ────────────────────────────────── */}
      {etapaAtual === 'quantidade' && tipoSelecionado?.input === 'contador_duplo' && (
        <div className="flex flex-col gap-5">
          <ContadorSimples
            label={labelQtdPrincipal}
            valor={quantidade}
            setValor={setQuantidade}
            cor="var(--brand-primary)"
          />

          <div className="border-t" style={{ borderColor: 'var(--line)' }} />

          <ContadorSimples
            label={tipoSelecionado.segunda_quantidade?.label ?? 'Segunda quantidade'}
            valor={segundaQuantidade}
            setValor={setSegundaQuantidade}
            cor="var(--signal-red)"
          />

          {/* Navegação embutida */}
          <div className="flex gap-3 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
            <BtnNav label="← Voltar" onClick={voltar} variante="secundario" />
            <BtnNav
              label="Continuar →"
              onClick={avancar}
              variante="primario"
              disabled={parseInt(quantidade || '0') === 0}
            />
          </div>
        </div>
      )}

      {/* ── QUANTIDADE — contador simples ──────────────────────────────── */}
      {etapaAtual === 'quantidade' && tipoSelecionado?.input === 'contador' && (
        <div className="flex flex-col items-center gap-5">
          <p
            className="text-base font-semibold text-center"
            style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}
          >
            {labelQtdPrincipal}
          </p>

          {/* Visor */}
          <div
            className="w-full py-6 flex flex-col items-center gap-1 rounded-xl"
            style={{ background: 'var(--bg-page)', border: '2px solid var(--line)' }}
          >
            <span
              className="text-7xl font-black leading-none tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}
            >
              {quantidade === '' ? '0' : quantidade}
            </span>
            <span className="text-sm font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
              {labelQtdPrincipal}
            </span>
          </div>

          {/* Botões −1 / +1 */}
          <div className="flex gap-3 w-full">
            <button
              onClick={() => {
                const atual = parseInt(quantidade || '0')
                if (atual > 0) setQuantidade(atual > 1 ? String(atual - 1) : '')
              }}
              className="font-bold text-xl px-5 py-4 rounded-xl transition-all active:scale-[0.97]"
              style={{
                background: '#fff',
                color: 'var(--text-muted)',
                border: '1px solid var(--line)',
                fontFamily: 'var(--font-display)',
              }}
            >
              −1
            </button>
            <button
              onClick={() => {
                const atual = parseInt(quantidade || '0')
                if (atual < 9999) setQuantidade(String(atual + 1))
              }}
              className="flex-1 font-black text-4xl py-4 rounded-xl transition-all active:scale-[0.97] shadow-md select-none"
              style={{ background: 'var(--brand-primary)', color: '#fff', fontFamily: 'var(--font-display)' }}
            >
              +1
            </button>
          </div>
        </div>
      )}

      {/* ── QUANTIDADE — teclado numérico ─────────────────────────────── */}
      {etapaAtual === 'quantidade' && tipoSelecionado && tipoSelecionado.input !== 'contador' && tipoSelecionado.input !== 'contador_duplo' && (
        <TecladoNumerico
          label={labelQtdPrincipal}
          valor={quantidade}
          onChange={setQuantidade}
          placeholder={tipoSelecionado.decimal ? 'ex: 0,5' : tipoSelecionado.unidade === 'ml' ? 'ex: 5' : 'ex: 10'}
          maxLength={tipoSelecionado.decimal ? 6 : 4}
          max={tipoSelecionado.decimal ? undefined : 9999}
          decimal={tipoSelecionado.decimal}
          autoFocus
          onEnter={() => { if (podeContinuar()) avancar() }}
        />
      )}

      {/* ── SEGUNDA QUANTIDADE ────────────────────────────────────────── */}
      {etapaAtual === 'segunda_quantidade' && tipoSelecionado?.segunda_quantidade && (
        <TecladoNumerico
          label={tipoSelecionado.segunda_quantidade.label}
          valor={segundaQuantidade}
          onChange={setSegundaQuantidade}
          placeholder="ex: 2"
          maxLength={4}
          max={9999}
          autoFocus
          onEnter={() => { if (podeContinuar()) avancar() }}
        />
      )}

      {/* ── CLASSIFICAÇÃO ─────────────────────────────────────────────── */}
      {etapaAtual === 'classificacao' && (
        <div className="flex flex-col gap-4">
          <p
            className="text-base font-semibold text-center"
            style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}
          >
            Tipo de ocorrência
          </p>
          <div className="grid grid-cols-2 gap-3">
            {CLASSIFICACOES.map((c) => (
              <button
                key={c.valor}
                type="button"
                onClick={() => {
                  setClassificacao(c.valor)
                  if (c.valor !== 'retrabalho') setTempoMinutos('')
                }}
                className="min-h-[72px] rounded-xl font-bold text-lg px-4 py-4 transition-all active:scale-[0.97] select-none"
                style={{
                  background: classificacao === c.valor
                    ? (c.valor === 'perda' ? 'var(--signal-red)' : 'var(--signal-amber)')
                    : '#fff',
                  color: classificacao === c.valor ? '#fff' : 'var(--text-strong)',
                  border: `2px solid ${classificacao === c.valor
                    ? (c.valor === 'perda' ? 'var(--signal-red)' : 'var(--signal-amber)')
                    : 'var(--line)'}`,
                  fontFamily: 'var(--font-display)',
                  boxShadow: classificacao === c.valor
                    ? `0 4px 16px ${c.valor === 'perda' ? 'rgba(200,80,79,0.3)' : 'rgba(212,161,85,0.3)'}`
                    : 'none',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {tipoSelecionado?.tempo === 'se_retrabalho' && classificacao === 'retrabalho' && (
            <div className="mt-2">
              <TecladoNumerico
                label="Tempo de retrabalho (minutos)"
                valor={tempoMinutos}
                onChange={setTempoMinutos}
                placeholder="—"
                max={999}
                maxLength={3}
                autoFocus
                onEnter={() => { if (podeContinuar()) avancar() }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── TEMPO ─────────────────────────────────────────────────────── */}
      {etapaAtual === 'tempo' && (
        <TecladoNumerico
          label="Tempo total gasto (minutos)"
          valor={tempoMinutos}
          onChange={setTempoMinutos}
          placeholder="ex: 30"
          max={999}
          maxLength={3}
          autoFocus
          onEnter={() => { if (podeContinuar()) avancar() }}
        />
      )}

      {/* ── CONFIRMAR ─────────────────────────────────────────────────── */}
      {etapaAtual === 'confirmar' && (() => {
        return (
          <div className="flex flex-col gap-4">
            <h3
              className="text-xl font-extrabold text-center"
              style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
            >
              Confirmar apontamento
            </h3>

            {/* Cabeçalho com OP + fibra */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--line)' }}
            >
              <div
                className="px-5 py-3 flex items-center gap-2"
                style={{ background: 'var(--brand-primary-tint)', borderBottom: '1px solid var(--line)' }}
              >
                <PillTag label={`OP ${op}`} cor="var(--brand-primary-soft)" textCor="var(--brand-primary-dark)" />
                <PillTag
                  label={`FIBRA ${fibra === 'F272' ? '272' : '365'}`}
                  cor="rgba(156,229,238,0.2)"
                  textCor="#0e7a89"
                />
              </div>

              <div className="px-5 py-1" style={{ background: '#fff' }}>
                <LinhaConfirm label="Operadora" valor={operadoraSelecionada ?? ''} />
                <LinhaConfirm label="Grupo" valor={grupoSelecionado ?? ''} />
                <LinhaConfirm label="Tipo" valor={tipoSelecionado?.nome ?? ''} />
                <LinhaConfirm label={labelQtdPrincipal} valor={quantidade} mono />
                {tipoSelecionado?.segunda_quantidade && (tipoSelecionado.input === 'contador_duplo' || segundaQuantidade) && (
                  <LinhaConfirm label={tipoSelecionado.segunda_quantidade.label} valor={segundaQuantidade || '0'} mono />
                )}
                {tipoSelecionado?.classificacao_fixa && (
                  <LinhaConfirm label="Classificação" valor={tipoSelecionado.classificacao_fixa.toUpperCase()} />
                )}
                {classificacao && <LinhaConfirm label="Classificação" valor={classificacao.toUpperCase()} />}
                {tempoMinutos && <LinhaConfirm label="Tempo" valor={`${tempoMinutos} min`} mono />}
                <LinhaConfirm
                  label="Horário"
                  valor={new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  mono
                  last
                />
              </div>
            </div>


            <button
              onClick={confirmar}
              disabled={salvando}
              className="font-bold text-xl py-5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 mt-1 flex items-center justify-center gap-2"
              style={{
                background: 'var(--brand-primary)',
                color: '#fff',
                fontFamily: 'var(--font-display)',
                boxShadow: '0 4px 14px rgba(86,164,187,0.3)',
              }}
            >
              <IconCheck />
              {salvando ? 'Salvando…' : 'Salvar Apontamento'}
            </button>
          </div>
        )
      })()}

      {/* ── BARRA DE NAVEGAÇÃO ─────────────────────────────────────────── */}
      <div
        className={`flex gap-3 mt-2 ${
          etapaAtual === 'quantidade' && tipoSelecionado?.input === 'contador_duplo' ? 'hidden' : ''
        }`}
      >
        {etapa > 0 && (
          <BtnNav label="← Voltar" onClick={voltar} variante="secundario" />
        )}
        {etapaAtual !== 'grupo' && etapaAtual !== 'tipo' && etapaAtual !== 'confirmar' && (
          <BtnNav
            label="Continuar →"
            onClick={avancar}
            variante="primario"
            disabled={!podeContinuar()}
          />
        )}
      </div>
    </div>
  )
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function ContadorSimples({
  label, valor, setValor, cor,
}: {
  label: string; valor: string; setValor: (v: string) => void; cor: string
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p
        className="text-sm font-semibold text-center"
        style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}
      >
        {label}
      </p>
      <div
        className="w-full py-4 flex items-center justify-center rounded-xl"
        style={{ background: 'var(--bg-page)', border: '2px solid var(--line)' }}
      >
        <span
          className="text-6xl font-black tabular-nums w-24 text-center"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}
        >
          {valor === '' ? '0' : valor}
        </span>
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={() => {
            const atual = parseInt(valor || '0')
            if (atual > 0) setValor(atual > 1 ? String(atual - 1) : '')
          }}
          className="font-bold text-xl px-5 py-4 rounded-xl transition-all active:scale-[0.97]"
          style={{
            background: '#fff',
            color: 'var(--text-muted)',
            border: '1px solid var(--line)',
            fontFamily: 'var(--font-display)',
          }}
        >
          −1
        </button>
        <button
          onClick={() => {
            const atual = parseInt(valor || '0')
            if (atual < 9999) setValor(String(atual + 1))
          }}
          className="flex-1 font-black text-4xl py-4 rounded-xl transition-all active:scale-[0.97] shadow-md select-none"
          style={{ background: cor, color: '#fff', fontFamily: 'var(--font-display)' }}
        >
          +1
        </button>
      </div>
    </div>
  )
}

function BtnNav({
  label, onClick, variante, disabled,
}: {
  label: string; onClick: () => void; variante: 'primario' | 'secundario'; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 font-bold text-base py-4 rounded-xl transition-all active:scale-[0.97] disabled:opacity-40"
      style={{
        background: variante === 'primario' ? 'var(--brand-primary)' : '#fff',
        color: variante === 'primario' ? '#fff' : 'var(--text-body)',
        border: variante === 'primario' ? 'none' : '1px solid var(--line)',
        fontFamily: 'var(--font-display)',
        boxShadow: variante === 'primario' ? '0 2px 8px rgba(86,164,187,0.25)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

function LinhaConfirm({
  label, valor, mono, last,
}: {
  label: string; valor: string; mono?: boolean; last?: boolean
}) {
  return (
    <div
      className="flex justify-between items-center py-3"
      style={{ borderBottom: last ? 'none' : '1px solid var(--line-soft)' }}
    >
      <span className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
        {label}
      </span>
      <span
        className="font-bold text-sm text-right"
        style={{
          color: 'var(--text-strong)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
        }}
      >
        {valor || '—'}
      </span>
    </div>
  )
}

function PillTag({ label, cor, textCor }: { label: string; cor: string; textCor: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase"
      style={{
        background: cor,
        color: textCor,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.05em',
      }}
    >
      {label}
    </span>
  )
}

// ─── Mini ícones SVG (sem emoji) ─────────────────────────────────────────────
function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 5l12 7-12 7V5z" />
    </svg>
  )
}
function IconPause() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l4.5 4.5L19 7" />
    </svg>
  )
}
function IconBox() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8C2B2A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l9-5 9 5v8l-9 5-9-5V8z" />
      <path d="M3 8l9 5 9-5M12 13v9" opacity="0.6" />
    </svg>
  )
}
