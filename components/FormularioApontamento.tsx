'use client'

import { useState } from 'react'
import { GRUPOS_DESPERDICIO } from '@/lib/desperdicios'
import type { Classificacao, NovoApontamento, TipoDesperdicio } from '@/lib/types'
import EtapaIndicador from './EtapaIndicador'
import BotaoGrande from './BotaoGrande'
import TecladoNumerico from './TecladoNumerico'

type TipoEtapa = 'grupo' | 'tipo' | 'op_operador' | 'quantidade' | 'classificacao' | 'tempo' | 'confirmar'

const LABELS_ETAPA: Record<TipoEtapa, string> = {
  grupo: 'Grupo',
  tipo: 'Tipo',
  op_operador: 'OP / Operador',
  quantidade: 'Quantidade',
  classificacao: 'Classificação',
  tempo: 'Tempo',
  confirmar: 'Confirmar',
}

function getSequencia(tipo: TipoDesperdicio | null): TipoEtapa[] {
  const base: TipoEtapa[] = ['grupo', 'tipo', 'op_operador', 'quantidade']
  if (!tipo) return [...base, 'confirmar']
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
  onSalvar: (dados: NovoApontamento) => Promise<void>
}

export default function FormularioApontamento({ onSalvar }: Props) {
  const [etapa, setEtapa] = useState(0)
  const [grupoSelecionado, setGrupoSelecionado] = useState<string | null>(null)
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoDesperdicio | null>(null)
  const [nomeOperador, setNomeOperador] = useState('')
  const [numeroOP, setNumeroOP] = useState('')
  const [quantidade, setQuantidade] = useState('')
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
    setNomeOperador('')
    setNumeroOP('')
    setQuantidade('')
    setClassificacao(null)
    setTempoMinutos('')
    setSucesso(false)
  }

  async function confirmar() {
    if (!grupoSelecionado || !tipoSelecionado || !numeroOP || !nomeOperador.trim() || !quantidade) return
    setSalvando(true)
    try {
      await onSalvar({
        grupo: grupoSelecionado,
        tipo_desperdicio: tipoSelecionado.nome,
        nome_operador: nomeOperador.trim(),
        numero_op: numeroOP.toUpperCase(),
        quantidade_pecas: tipoSelecionado.unidade === 'pecas' ? parseInt(quantidade) : null,
        quantidade_ml: tipoSelecionado.unidade === 'ml' ? parseInt(quantidade) : null,
        classificacao: tipoSelecionado.classificacao !== 'nenhum' ? classificacao : null,
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
      case 'op_operador': return !!numeroOP && !!nomeOperador.trim()
      case 'quantidade': return !!quantidade
      case 'classificacao': return !!classificacao
      case 'tempo': return !!tempoMinutos
      default: return true
    }
  }

  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <div className="text-8xl">✅</div>
        <h2 className="text-3xl font-bold text-green-400 text-center">Apontamento Salvo!</h2>
        <p className="text-slate-400 text-center text-lg">
          {tipoSelecionado?.nome} · OP {numeroOP.toUpperCase()} · {quantidade} {tipoSelecionado?.unidade === 'ml' ? 'ml' : 'peça(s)'}
        </p>
        <button
          onClick={resetar}
          className="mt-4 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-bold text-xl px-10 py-5 rounded-2xl transition-all"
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
          <p className="text-slate-400 text-sm text-center mb-1">{grupo.nome}</p>
          {grupo.tipos.map((t) => (
            <BotaoGrande
              key={t.nome}
              label={t.nome}
              selecionado={tipoSelecionado?.nome === t.nome}
              onClick={() => {
                setTipoSelecionado(t)
                setClassificacao(null)
                setTempoMinutos('')
                avancar()
              }}
            />
          ))}
        </div>
      )}

      {/* OP + Operador */}
      {etapaAtual === 'op_operador' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-slate-300 text-sm font-semibold">Nome do Operador</label>
            <input
              type="text"
              value={nomeOperador}
              onChange={(e) => setNomeOperador(e.target.value)}
              placeholder="Digite o nome do operador"
              className="bg-slate-800 text-white text-lg px-4 py-4 rounded-2xl border border-slate-600 focus:border-blue-500 focus:outline-none placeholder:text-slate-500"
            />
          </div>
          <TecladoNumerico
            label="Número da Ordem de Produção (OP)"
            valor={numeroOP}
            onChange={setNumeroOP}
            placeholder="ex: 000123456"
            maxLength={9}
          />
        </div>
      )}

      {/* Quantidade */}
      {etapaAtual === 'quantidade' && tipoSelecionado && (
        <TecladoNumerico
          label={tipoSelecionado.unidade === 'ml'
            ? 'Quantidade desperdiçada (ml)'
            : 'Quantidade de peças afetadas'}
          valor={quantidade}
          onChange={setQuantidade}
          placeholder={tipoSelecionado.unidade === 'ml' ? 'ex: 5' : 'ex: 10'}
          maxLength={4}
          max={9999}
        />
      )}

      {/* Classificação */}
      {etapaAtual === 'classificacao' && (
        <div className="flex flex-col gap-4">
          <p className="text-slate-300 text-lg font-semibold text-center">Tipo de ocorrência</p>
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
              />
            </div>
          )}
        </div>
      )}

      {/* Tempo (step separado — apenas para tipos com tempo='sempre') */}
      {etapaAtual === 'tempo' && (
        <TecladoNumerico
          label="Tempo total gasto (minutos)"
          valor={tempoMinutos}
          onChange={setTempoMinutos}
          placeholder="ex: 30"
          max={999}
          maxLength={3}
        />
      )}

      {/* Confirmar */}
      {etapaAtual === 'confirmar' && (
        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-bold text-center text-white mb-2">Confirmar apontamento</h3>
          <div className="bg-slate-800 rounded-2xl p-5 flex flex-col gap-3 text-base">
            <Linha label="Grupo" valor={grupoSelecionado ?? ''} />
            <Linha label="Tipo" valor={tipoSelecionado?.nome ?? ''} />
            <Linha label="Operador" valor={nomeOperador} />
            <Linha label="OP" valor={numeroOP.toUpperCase()} />
            <Linha
              label={tipoSelecionado?.unidade === 'ml' ? 'Quantidade (ml)' : 'Qtd. peças'}
              valor={quantidade}
            />
            {classificacao && <Linha label="Classificação" valor={classificacao.toUpperCase()} />}
            {tempoMinutos && <Linha label="Tempo" valor={`${tempoMinutos} min`} />}
          </div>
          <button
            onClick={confirmar}
            disabled={salvando}
            className="bg-green-500 hover:bg-green-600 active:scale-95 disabled:opacity-50 text-white font-bold text-2xl py-6 rounded-2xl transition-all mt-2"
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
            className="flex-1 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-semibold text-lg py-4 rounded-2xl transition-all"
          >
            ← Voltar
          </button>
        )}

        {etapaAtual !== 'grupo' && etapaAtual !== 'tipo' && etapaAtual !== 'confirmar' && (
          <button
            onClick={avancar}
            disabled={!podeContinuar()}
            className="flex-1 bg-blue-500 hover:bg-blue-600 active:scale-95 disabled:opacity-40 text-white font-bold text-lg py-4 rounded-2xl transition-all"
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
    <div className="flex justify-between items-start gap-4">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-white font-semibold text-right">{valor}</span>
    </div>
  )
}
