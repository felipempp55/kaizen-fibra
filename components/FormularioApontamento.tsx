'use client'

import { useState } from 'react'
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
  if (tipo.segunda_quantidade) base.push('segunda_quantidade')
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
          : (tipoSelecionado.segunda_quantidade && segundaQuantidade
              ? parseInt(segundaQuantidade)
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
      case 'quantidade': return quantidade.length > 0
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

      {/* Quantidade principal */}
      {etapaAtual === 'quantidade' && tipoSelecionado && (
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
            <Linha label="Operador" valor={operador} />
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

      {/* Navegação */}
      <div className="flex gap-3 mt-2">
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
