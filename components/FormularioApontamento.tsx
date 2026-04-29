'use client'

import { useState } from 'react'
import { GRUPOS_DESPERDICIO, CLASSIFICACOES } from '@/lib/desperdicios'
import type { Classificacao, NovoApontamento } from '@/lib/types'
import EtapaIndicador from './EtapaIndicador'
import BotaoGrande from './BotaoGrande'
import TecladoNumerico from './TecladoNumerico'

const ETAPAS = ['Grupo', 'Tipo', 'OP', 'Quantidade', 'Classificação', 'Confirmar']

interface Props {
  onSalvar: (dados: NovoApontamento) => Promise<void>
}

export default function FormularioApontamento({ onSalvar }: Props) {
  const [etapa, setEtapa] = useState(0)
  const [grupoSelecionado, setGrupoSelecionado] = useState<string | null>(null)
  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null)
  const [numeroOP, setNumeroOP] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [classificacao, setClassificacao] = useState<Classificacao | null>(null)
  const [tempoMinutos, setTempoMinutos] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const grupo = GRUPOS_DESPERDICIO.find((g) => g.nome === grupoSelecionado)

  function resetar() {
    setEtapa(0)
    setGrupoSelecionado(null)
    setTipoSelecionado(null)
    setNumeroOP('')
    setQuantidade('')
    setClassificacao(null)
    setTempoMinutos('')
    setSucesso(false)
  }

  async function confirmar() {
    if (!grupoSelecionado || !tipoSelecionado || !numeroOP || !quantidade || !classificacao) return
    setSalvando(true)
    try {
      await onSalvar({
        grupo: grupoSelecionado,
        tipo_desperdicio: tipoSelecionado,
        numero_op: numeroOP.toUpperCase(),
        quantidade_pecas: parseInt(quantidade),
        classificacao,
        tempo_minutos: tempoMinutos ? parseInt(tempoMinutos) : null,
        observacao: null,
      })
      setSucesso(true)
    } finally {
      setSalvando(false)
    }
  }

  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <div className="text-8xl">✅</div>
        <h2 className="text-3xl font-bold text-green-400 text-center">Apontamento Salvo!</h2>
        <p className="text-slate-400 text-center text-lg">
          {tipoSelecionado} · OP {numeroOP.toUpperCase()} · {quantidade} peça(s)
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
      <EtapaIndicador etapaAtual={etapa} totalEtapas={ETAPAS.length} labels={ETAPAS} />

      {/* Etapa 0 — Grupo */}
      {etapa === 0 && (
        <div className="grid grid-cols-2 gap-3">
          {GRUPOS_DESPERDICIO.map((g) => (
            <BotaoGrande
              key={g.nome}
              label={g.nome}
              selecionado={grupoSelecionado === g.nome}
              onClick={() => {
                setGrupoSelecionado(g.nome)
                setTipoSelecionado(null)
                setEtapa(1)
              }}
            />
          ))}
        </div>
      )}

      {/* Etapa 1 — Tipo */}
      {etapa === 1 && grupo && (
        <div className="flex flex-col gap-3">
          <p className="text-slate-400 text-sm text-center mb-1">{grupo.nome}</p>
          {grupo.tipos.map((t) => (
            <BotaoGrande
              key={t}
              label={t}
              selecionado={tipoSelecionado === t}
              onClick={() => {
                setTipoSelecionado(t)
                setEtapa(2)
              }}
            />
          ))}
        </div>
      )}

      {/* Etapa 2 — Número da OP */}
      {etapa === 2 && (
        <TecladoNumerico
          label="Número da Ordem de Produção (OP)"
          valor={numeroOP}
          onChange={setNumeroOP}
          placeholder="ex: 000123456"
          maxLength={9}
        />
      )}

      {/* Etapa 3 — Quantidade */}
      {etapa === 3 && (
        <TecladoNumerico
          label="Quantidade de peças afetadas"
          valor={quantidade}
          onChange={setQuantidade}
          placeholder="ex: 10"
          max={9999}
          maxLength={4}
        />
      )}

      {/* Etapa 4 — Classificação + Tempo */}
      {etapa === 4 && (
        <div className="flex flex-col gap-4">
          <p className="text-slate-300 text-lg font-semibold text-center">Tipo de ocorrência</p>
          <div className="grid grid-cols-3 gap-3">
            {CLASSIFICACOES.map((c) => (
              <BotaoGrande
                key={c.valor}
                label={c.label}
                cor={c.cor}
                selecionado={classificacao === c.valor}
                onClick={() => setClassificacao(c.valor)}
              />
            ))}
          </div>

          <div className="mt-4">
            <TecladoNumerico
              label="Tempo gasto em minutos (opcional)"
              valor={tempoMinutos}
              onChange={setTempoMinutos}
              placeholder="—"
              max={999}
            />
          </div>
        </div>
      )}

      {/* Etapa 5 — Confirmação */}
      {etapa === 5 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-bold text-center text-white mb-2">Confirmar apontamento</h3>
          <div className="bg-slate-800 rounded-2xl p-5 flex flex-col gap-3 text-base">
            <Linha label="Grupo" valor={grupoSelecionado ?? ''} />
            <Linha label="Tipo" valor={tipoSelecionado ?? ''} />
            <Linha label="OP" valor={numeroOP.toUpperCase()} />
            <Linha label="Qtd. peças" valor={quantidade} />
            <Linha label="Classificação" valor={classificacao?.toUpperCase() ?? ''} />
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

      {/* Navegação inferior */}
      <div className="flex gap-3 mt-2">
        {etapa > 0 && (
          <button
            onClick={() => setEtapa((e) => e - 1)}
            className="flex-1 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-semibold text-lg py-4 rounded-2xl transition-all"
          >
            ← Voltar
          </button>
        )}

        {etapa === 2 && (
          <button
            onClick={() => { if (numeroOP) setEtapa(3) }}
            disabled={!numeroOP}
            className="flex-1 bg-blue-500 hover:bg-blue-600 active:scale-95 disabled:opacity-40 text-white font-bold text-lg py-4 rounded-2xl transition-all"
          >
            Continuar →
          </button>
        )}

        {etapa === 3 && (
          <button
            onClick={() => { if (quantidade) setEtapa(4) }}
            disabled={!quantidade}
            className="flex-1 bg-blue-500 hover:bg-blue-600 active:scale-95 disabled:opacity-40 text-white font-bold text-lg py-4 rounded-2xl transition-all"
          >
            Continuar →
          </button>
        )}

        {etapa === 4 && (
          <button
            onClick={() => { if (classificacao) setEtapa(5) }}
            disabled={!classificacao}
            className="flex-1 bg-blue-500 hover:bg-blue-600 active:scale-95 disabled:opacity-40 text-white font-bold text-lg py-4 rounded-2xl transition-all"
          >
            Revisar →
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
