'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Cronômetro persistente ───────────────────────────────────────────────────
const TIMER_KEY = 'kaizen-timer-retrabalho'

interface TimerState {
  status: 'parado' | 'rodando' | 'pausado'
  elapsed: number       // ms acumulados antes do run atual
  startAt: number | null  // Date.now() quando o run atual começou
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
import { GRUPOS_DESPERDICIO } from '@/lib/desperdicios'
import type { Classificacao, NovoApontamento, TipoDesperdicio } from '@/lib/types'
import EtapaIndicador from './EtapaIndicador'
import BotaoGrande from './BotaoGrande'
import TecladoNumerico from './TecladoNumerico'

type TipoEtapa = 'grupo' | 'tipo' | 'quantidade' | 'segunda_quantidade' | 'classificacao' | 'tempo' | 'confirmar'

const LABELS_ETAPA: Record<TipoEtapa, string> = {
  grupo: 'Grupo',
  tipo: 'Tipo',
  quantidade: 'Quantidade',
  segunda_quantidade: 'Adicional',
  classificacao: 'Classificação',
  tempo: 'Tempo',
  confirmar: 'Confirmar',
}

function getSequencia(tipo: TipoDesperdicio | null): TipoEtapa[] {
  const base: TipoEtapa[] = ['grupo', 'tipo', 'quantidade']
  if (!tipo) return [...base, 'confirmar']
  // contador_duplo mostra as duas quantidades na mesma tela — não gera etapa separada
  if (tipo.segunda_quantidade && tipo.input !== 'contador_duplo') base.push('segunda_quantidade')
  if (tipo.classificacao !== 'nenhum') base.push('classificacao')
  if (tipo.tempo === 'sempre') base.push('tempo')
  base.push('confirmar')
  return base
}

const CLASSIFICACOES: { valor: Classificacao; label: string; cor: string }[] = [
  { valor: 'perda', label: 'Perda', cor: 'bg-red-500 hover:bg-red-600 active:bg-red-700' },
  { valor: 'retrabalho', label: 'Retrabalho', cor: 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700' },
]

interface Props {
  op: string
  operador: string
  onSalvar: (dados: NovoApontamento) => Promise<void>
}

export default function FormularioApontamento({ op, operador, onSalvar }: Props) {
  // ── Cronômetro ──────────────────────────────────────────────────────────────
  const [timer, setTimer] = useState<TimerState>(TIMER_INICIAL)
  const [agora, setAgora] = useState(Date.now())
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Carrega do localStorage ao montar
  useEffect(() => { setTimer(loadTimer()) }, [])

  // Inicia/para o tick a cada 500ms conforme status
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
  function concluirTimer() {
    setTimer(TIMER_INICIAL); saveTimer(TIMER_INICIAL)
  }

  // ── Formulário ───────────────────────────────────────────────────────────────
  const [etapa, setEtapa] = useState(0)
  const [grupoSelecionado, setGrupoSelecionado] = useState<string | null>(null)
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoDesperdicio | null>(null)
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

  function avancar() {
    setEtapa((e) => Math.min(e + 1, sequencia.length - 1))
  }

  function voltar() {
    setEtapa((e) => Math.max(e - 1, 0))
  }

  function resetar() {
    setEtapa(0)
    setGrupoSelecionado(null)
    setTipoSelecionado(null)
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
      await onSalvar({
        grupo: grupoSelecionado,
        tipo_desperdicio: tipoSelecionado.nome,
        nome_operador: operador,
        numero_op: op.toUpperCase(),
        quantidade_pecas: tipoSelecionado.unidade === 'pecas' ? parseInt(quantidade) : null,
        quantidade_ml: tipoSelecionado.unidade === 'ml'
          ? parseInt(quantidade)
          : (tipoSelecionado.segunda_quantidade
              ? parseInt(segundaQuantidade || '0')
              : null),
        classificacao: tipoSelecionado.classificacao_fixa
          ?? (tipoSelecionado.classificacao !== 'nenhum' ? classificacao : null),
        tempo_minutos: tempoMinutos ? parseInt(tempoMinutos) : null,
        observacao: null,
      })
      setSucesso(true)
    } finally {
      setSalvando(false)
    }
  }

  function podeContinuar(): boolean {
    switch (etapaAtual) {
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

  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <div className="text-8xl">✅</div>
        <h2 className="text-3xl font-bold text-[#1E9FAC] text-center">Apontamento Salvo!</h2>
        <p className="text-[#8FA3B0] text-center text-lg">
          {tipoSelecionado?.nome} · OP {op} · {quantidade}{' '}
          {tipoSelecionado?.unidade === 'ml' ? 'ml' : 'peça(s)'}
          {tipoSelecionado?.segunda_quantidade && segundaQuantidade
            ? ` · ${segundaQuantidade} ${tipoSelecionado.segunda_quantidade.label.toLowerCase()}`
            : ''}
        </p>
        <button
          onClick={resetar}
          className="mt-4 bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 text-white font-bold text-xl px-10 py-5 rounded-xl transition-all"
        >
          Novo Apontamento
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <EtapaIndicador etapaAtual={etapa} totalEtapas={sequencia.length} labels={labels} />

      {/* Grupo */}
      {etapaAtual === 'grupo' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {GRUPOS_DESPERDICIO.map((g) => (
              <BotaoGrande
                key={g.nome}
                label={g.nome}
                selecionado={grupoSelecionado === g.nome}
                onClick={() => {
                  setGrupoSelecionado(g.nome)
                  setTipoSelecionado(null)
                  avancar()
                }}
              />
            ))}
          </div>

          {/* ── Cronômetro de Retrabalho ─────────────────────────────────────── */}
          <div className={`rounded-xl border-2 p-4 flex flex-col gap-3 transition-colors ${
            timer.status === 'rodando' ? 'border-[#1E9FAC] bg-[#E6F6F8]' :
            timer.status === 'pausado' ? 'border-amber-300 bg-amber-50' :
            'border-[#DDE4EA] bg-[#F2F5F7]'
          }`}>
            {/* Título */}
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                timer.status === 'rodando' ? 'bg-[#1E9FAC] animate-pulse' :
                timer.status === 'pausado' ? 'bg-amber-400' : 'bg-[#C4D0DA]'
              }`} />
              <p className="text-[#1A3344] text-xs font-bold uppercase tracking-wider">
                Retrabalho Manual Pós Máquina
              </p>
            </div>

            {/* Display do tempo */}
            <p className={`text-5xl font-black font-mono tabular-nums text-center py-2 ${
              timer.status === 'rodando' ? 'text-[#1E9FAC]' :
              timer.status === 'pausado' ? 'text-amber-600' :
              'text-[#C4D0DA]'
            }`}>
              {formatMs(displayMs)}
            </p>

            {/* Botões */}
            <div className="flex gap-2">
              {timer.status === 'parado' && (
                <button
                  onClick={iniciarTimer}
                  className="flex-1 bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 text-white font-bold py-3 rounded-xl transition-all"
                >
                  ▶ Iniciar
                </button>
              )}
              {timer.status === 'rodando' && (
                <button
                  onClick={pausarTimer}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold py-3 rounded-xl transition-all"
                >
                  ⏸ Pausar
                </button>
              )}
              {timer.status === 'pausado' && (
                <button
                  onClick={iniciarTimer}
                  className="flex-1 bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 text-white font-bold py-3 rounded-xl transition-all"
                >
                  ▶ Retomar
                </button>
              )}
              {timer.status !== 'parado' && (
                <button
                  onClick={concluirTimer}
                  className="flex-1 bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold py-3 rounded-xl transition-all"
                >
                  ✓ Concluir
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tipo */}
      {etapaAtual === 'tipo' && grupo && (
        <div className="flex flex-col gap-3">
          <p className="text-[#8FA3B0] text-sm text-center font-medium mb-1">{grupo.nome}</p>
          {grupo.tipos.map((t) => (
            <BotaoGrande
              key={t.nome}
              label={t.nome}
              selecionado={tipoSelecionado?.nome === t.nome}
              onClick={() => {
                setTipoSelecionado(t)
                setClassificacao(null)
                setTempoMinutos('')
                setSegundaQuantidade('')
                avancar()
              }}
            />
          ))}
        </div>
      )}

      {/* Quantidade principal — contador duplo (dois contadores na mesma tela) */}
      {etapaAtual === 'quantidade' && tipoSelecionado?.input === 'contador_duplo' && (
        <div className="flex flex-col gap-5">

          {/* Contador 1 */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-[#1A3344] text-sm font-semibold text-center">{labelQtdPrincipal}</p>
            <div className="bg-[#F2F5F7] border-2 border-[#DDE4EA] rounded-2xl w-full py-4 flex items-center justify-center gap-4">
              <span className="text-6xl font-black font-mono text-[#1A3344] tabular-nums w-24 text-center">
                {quantidade === '' ? '0' : quantidade}
              </span>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => {
                  const atual = parseInt(quantidade || '0')
                  if (atual > 0) setQuantidade(atual > 1 ? String(atual - 1) : '')
                }}
                className="bg-white border border-[#DDE4EA] hover:border-red-300 hover:text-red-400 active:scale-95 text-[#8FA3B0] font-bold text-xl px-5 py-4 rounded-xl transition-all"
              >
                −1
              </button>
              <button
                onClick={() => {
                  const atual = parseInt(quantidade || '0')
                  if (atual < 9999) setQuantidade(String(atual + 1))
                }}
                className="flex-1 bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 active:bg-[#0f6470] text-white font-black text-4xl py-4 rounded-xl transition-all shadow-md select-none"
              >
                +1
              </button>
            </div>
          </div>

          <div className="border-t border-[#DDE4EA]" />

          {/* Contador 2 */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-[#1A3344] text-sm font-semibold text-center">
              {tipoSelecionado.segunda_quantidade?.label}
            </p>
            <div className="bg-[#F2F5F7] border-2 border-[#DDE4EA] rounded-2xl w-full py-4 flex items-center justify-center gap-4">
              <span className="text-6xl font-black font-mono text-[#1A3344] tabular-nums w-24 text-center">
                {segundaQuantidade === '' ? '0' : segundaQuantidade}
              </span>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => {
                  const atual = parseInt(segundaQuantidade || '0')
                  if (atual > 0) setSegundaQuantidade(atual > 1 ? String(atual - 1) : '')
                }}
                className="bg-white border border-[#DDE4EA] hover:border-red-300 hover:text-red-400 active:scale-95 text-[#8FA3B0] font-bold text-xl px-5 py-4 rounded-xl transition-all"
              >
                −1
              </button>
              <button
                onClick={() => {
                  const atual = parseInt(segundaQuantidade || '0')
                  if (atual < 9999) setSegundaQuantidade(String(atual + 1))
                }}
                className="flex-1 bg-red-400 hover:bg-red-500 active:scale-95 text-white font-black text-4xl py-4 rounded-xl transition-all shadow-md select-none"
              >
                +1
              </button>
            </div>
          </div>

          {/* Navegação embutida — substitui a barra genérica */}
          <div className="flex gap-3 pt-2 border-t border-[#DDE4EA]">
            <button
              onClick={voltar}
              className="flex-1 bg-white border border-[#DDE4EA] hover:border-[#1E9FAC] hover:text-[#1E9FAC] active:scale-95 text-[#3D5568] font-semibold text-lg py-4 rounded-xl transition-all"
            >
              ← Voltar
            </button>
            <button
              onClick={avancar}
              disabled={parseInt(quantidade || '0') === 0}
              className="flex-1 bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 disabled:opacity-40 text-white font-bold text-lg py-4 rounded-xl transition-all"
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {/* Quantidade principal — contador +1 */}
      {etapaAtual === 'quantidade' && tipoSelecionado?.input === 'contador' && (
        <div className="flex flex-col items-center gap-6">
          <p className="text-[#1A3344] text-base font-semibold text-center">{labelQtdPrincipal}</p>

          {/* Visor do contador */}
          <div className="bg-[#F2F5F7] border-2 border-[#DDE4EA] rounded-2xl w-full py-6 flex flex-col items-center gap-1">
            <span className="text-7xl font-black font-mono text-[#1A3344] leading-none tabular-nums">
              {quantidade === '' ? '0' : quantidade}
            </span>
            <span className="text-[#8FA3B0] text-sm font-medium mt-1">
              {labelQtdPrincipal}
            </span>
          </div>

          {/* Botão +1 */}
          <button
            onClick={() => {
              const atual = parseInt(quantidade || '0')
              if (atual < 9999) setQuantidade(String(atual + 1))
            }}
            className="w-full bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 active:bg-[#0f6470] text-white font-black text-5xl py-10 rounded-2xl transition-all shadow-md select-none"
          >
            +1
          </button>

          {/* Botão desfazer */}
          {Number(quantidade || 0) > 0 && (
            <button
              onClick={() => {
                const atual = parseInt(quantidade || '0')
                setQuantidade(atual > 1 ? String(atual - 1) : '')
              }}
              className="text-[#8FA3B0] hover:text-red-400 text-sm font-medium transition-colors"
            >
              ← Desfazer último
            </button>
          )}
        </div>
      )}

      {/* Quantidade principal — teclado numérico */}
      {etapaAtual === 'quantidade' && tipoSelecionado && tipoSelecionado.input !== 'contador' && tipoSelecionado.input !== 'contador_duplo' && (
        <TecladoNumerico
          label={labelQtdPrincipal}
          valor={quantidade}
          onChange={setQuantidade}
          placeholder={tipoSelecionado.unidade === 'ml' ? 'ex: 5' : 'ex: 10'}
          maxLength={4}
          max={9999}
          autoFocus
          onEnter={() => { if (podeContinuar()) avancar() }}
        />
      )}

      {/* Segunda quantidade */}
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

      {/* Classificação */}
      {etapaAtual === 'classificacao' && (
        <div className="flex flex-col gap-4">
          <p className="text-[#1A3344] text-lg font-semibold text-center">Tipo de ocorrência</p>
          <div className="grid grid-cols-2 gap-3">
            {CLASSIFICACOES.map((c) => (
              <BotaoGrande
                key={c.valor}
                label={c.label}
                cor={c.cor}
                selecionado={classificacao === c.valor}
                onClick={() => {
                  setClassificacao(c.valor)
                  if (c.valor !== 'retrabalho') setTempoMinutos('')
                }}
              />
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

      {/* Tempo */}
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

      {/* Confirmar */}
      {etapaAtual === 'confirmar' && (
        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-bold text-center text-[#1A3344] mb-2">Confirmar apontamento</h3>
          <div className="bg-white border border-[#DDE4EA] rounded-xl p-5 flex flex-col gap-3 text-base">
            <Linha label="OP" valor={op} />
            {operador && <Linha label="Operador" valor={operador} />}
            <Linha label="Grupo" valor={grupoSelecionado ?? ''} />
            <Linha label="Tipo" valor={tipoSelecionado?.nome ?? ''} />
            <Linha label={labelQtdPrincipal} valor={quantidade} />
            {tipoSelecionado?.segunda_quantidade && segundaQuantidade && (
              <Linha label={tipoSelecionado.segunda_quantidade.label} valor={segundaQuantidade} />
            )}
            {tipoSelecionado?.classificacao_fixa && (
              <Linha label="Classificação" valor={tipoSelecionado.classificacao_fixa.toUpperCase()} />
            )}
            {classificacao && <Linha label="Classificação" valor={classificacao.toUpperCase()} />}
            {tempoMinutos && <Linha label="Tempo" valor={`${tempoMinutos} min`} />}
          </div>
          <button
            onClick={confirmar}
            disabled={salvando}
            className="bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 disabled:opacity-50 text-white font-bold text-2xl py-6 rounded-xl transition-all mt-2"
          >
            {salvando ? 'Salvando…' : '✓ Salvar'}
          </button>
        </div>
      )}

      {/* Navegação — oculta no contador_duplo (tem navegação própria embutida) */}
      <div className={`flex gap-3 mt-2 ${etapaAtual === 'quantidade' && tipoSelecionado?.input === 'contador_duplo' ? 'hidden' : ''}`}>
        {etapa > 0 && (
          <button
            onClick={voltar}
            className="flex-1 bg-white border border-[#DDE4EA] hover:border-[#1E9FAC] hover:text-[#1E9FAC] active:scale-95 text-[#3D5568] font-semibold text-lg py-4 rounded-xl transition-all"
          >
            ← Voltar
          </button>
        )}

        {etapaAtual !== 'grupo' && etapaAtual !== 'tipo' && etapaAtual !== 'confirmar' && (
          <button
            onClick={avancar}
            disabled={!podeContinuar()}
            className="flex-1 bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 disabled:opacity-40 text-white font-bold text-lg py-4 rounded-xl transition-all"
          >
            Continuar →
          </button>
        )}
      </div>
    </div>
  )
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between items-start gap-4 border-b border-[#F2F5F7] pb-2 last:border-0 last:pb-0">
      <span className="text-[#8FA3B0] shrink-0 font-medium">{label}</span>
      <span className="text-[#1A3344] font-semibold text-right">{valor}</span>
    </div>
  )
}
