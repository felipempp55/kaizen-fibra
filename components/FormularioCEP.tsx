'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { CTQS, type CTQ } from '@/lib/ctqs'
import type { NovaCEPColeta, AmostraCEP, DadosIniciaisCEP } from '@/lib/types'
import EtapaIndicador from './EtapaIndicador'
import TecladoNumerico from './TecladoNumerico'

type EtapaCEP = 'ctq' | 'dados' | 'amostras' | 'confirmar'

const LABELS_ETAPA: Record<EtapaCEP, string> = {
  ctq: 'Selecionar CTQ',
  dados: 'Dados Gerais',
  amostras: 'Amostras',
  confirmar: 'Confirmar',
}

const SEQUENCIA: EtapaCEP[] = ['ctq', 'dados', 'amostras', 'confirmar']

interface ResultadoAtributo { numero: number; resultado: 'ok' | 'nok' | null }
interface ValorVariavel { numero: number; valor: string }

interface Props {
  dadosIniciais?: DadosIniciaisCEP
  onSalvar: (dados: NovaCEPColeta, rascunhoId?: string) => Promise<void>
  onPausar: (dados: NovaCEPColeta, rascunhoId?: string) => Promise<void>
}

function montar_atributos(total: number, preenchidas: AmostraCEP[]): ResultadoAtributo[] {
  return Array.from({ length: total }, (_, i) => {
    const encontrado = preenchidas.find(a => a.numero === i + 1)
    return { numero: i + 1, resultado: (encontrado?.resultado ?? null) as 'ok' | 'nok' | null }
  })
}

function montar_variaveis(total: number, preenchidas: AmostraCEP[]): ValorVariavel[] {
  return Array.from({ length: total }, (_, i) => {
    const encontrado = preenchidas.find(a => a.numero === i + 1)
    return { numero: i + 1, valor: encontrado?.valor != null ? String(encontrado.valor) : '' }
  })
}

export default function FormularioCEP({ dadosIniciais, onSalvar, onPausar }: Props) {
  // Se vier com dadosIniciais (retomando rascunho), começa na etapa "amostras"
  const etapaInicial = dadosIniciais ? SEQUENCIA.indexOf('amostras') : 0

  const ctqInicial = dadosIniciais
    ? CTQS.find(c => c.id === dadosIniciais.ctq_id) ?? null
    : null

  const [etapa, setEtapa] = useState(etapaInicial)
  const [ctq, setCtq] = useState<CTQ | null>(ctqInicial)
  const [instrumento, setInstrumento] = useState(dadosIniciais?.instrumento ?? '')
  const [dataColeta, setDataColeta] = useState(dadosIniciais?.dataColeta ?? new Date().toISOString().split('T')[0])
  const [numeroOP, setNumeroOP] = useState(dadosIniciais?.numeroOP ?? '')
  const [nomeOperador, setNomeOperador] = useState(dadosIniciais?.nomeOperador ?? '')

  const [atributos, setAtributos] = useState<ResultadoAtributo[]>(() =>
    dadosIniciais
      ? montar_atributos(dadosIniciais.totalAmostras, dadosIniciais.amostrasPreenchidas)
      : []
  )
  const [variaveis, setVariaveis] = useState<ValorVariavel[]>(() =>
    dadosIniciais
      ? montar_variaveis(dadosIniciais.totalAmostras, dadosIniciais.amostrasPreenchidas)
      : []
  )

  const primeiroVazioInicial = dadosIniciais
    ? (dadosIniciais.tipo === 'atributo'
        ? Math.max(0, montar_atributos(dadosIniciais.totalAmostras, dadosIniciais.amostrasPreenchidas).findIndex(a => a.resultado === null))
        : Math.max(0, montar_variaveis(dadosIniciais.totalAmostras, dadosIniciais.amostrasPreenchidas).findIndex(v => v.valor === ''))
      )
    : 0

  const [indiceAtual, setIndiceAtual] = useState(primeiroVazioInicial < 0 ? 0 : primeiroVazioInicial)
  const [valorDigitado, setValorDigitado] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [pausando, setPausando] = useState(false)
  const [resultado, setResultado] = useState<'salvo' | 'pausado' | null>(null)

  // Input oculto para capturar teclado físico no teclado decimal (amostras variável)
  const decimalInputRef = useRef<HTMLInputElement>(null)

  const etapaAtual = SEQUENCIA[etapa]

  // Foca o input decimal sempre que muda de amostra ou entra na etapa variável
  useEffect(() => {
    if (etapaAtual === 'amostras' && ctq?.tipo === 'variavel') {
      decimalInputRef.current?.focus()
    }
  }, [etapaAtual, ctq?.tipo, indiceAtual])
  const rascunhoId = dadosIniciais?.rascunhoId

  function avancar() { setEtapa(e => Math.min(e + 1, SEQUENCIA.length - 1)) }
  function voltar() { setEtapa(e => Math.max(e - 1, 0)) }

  function selecionarCTQ(c: CTQ) {
    setCtq(c)
    setInstrumento(c.instrumento)
    setAtributos(Array.from({ length: c.totalAmostras }, (_, i) => ({ numero: i + 1, resultado: null })))
    setVariaveis(Array.from({ length: c.totalAmostras }, (_, i) => ({ numero: i + 1, valor: '' })))
    setIndiceAtual(0)
    setValorDigitado('')
    avancar()
  }

  // ── Atributo ──────────────────────────────────────────────────────────────
  function definirAtributo(index: number, resultado: 'ok' | 'nok') {
    const novas = [...atributos]
    novas[index] = { ...novas[index], resultado }
    setAtributos(novas)
    const prox = novas.findIndex((a, i) => i > index && a.resultado === null)
    if (prox >= 0) { setIndiceAtual(prox); return }
    const qualquer = novas.findIndex(a => a.resultado === null)
    if (qualquer >= 0) setIndiceAtual(qualquer)
  }

  // ── Variável ──────────────────────────────────────────────────────────────
  function salvarEAvancarVariavel() {
    const v = valorDigitado.trim()
    if (!v && !variaveis[indiceAtual]?.valor) return
    const novas = [...variaveis]
    novas[indiceAtual] = { ...novas[indiceAtual], valor: v || novas[indiceAtual].valor }
    setVariaveis(novas)
    setValorDigitado('')
    if (indiceAtual < novas.length - 1) setIndiceAtual(i => i + 1)
  }

  function navegarVariavel(novoIndice: number) {
    if (valorDigitado.trim()) {
      const novas = [...variaveis]
      novas[indiceAtual] = { ...novas[indiceAtual], valor: valorDigitado.trim() }
      setVariaveis(novas)
    }
    setIndiceAtual(novoIndice)
    setValorDigitado(variaveis[novoIndice]?.valor || '')
  }

  // ── Estatísticas ──────────────────────────────────────────────────────────
  const preenchidas = useMemo(() => {
    if (!ctq) return 0
    if (ctq.tipo === 'atributo') return atributos.filter(a => a.resultado !== null).length
    return variaveis.filter(v => v.valor !== '').length
  }, [ctq, atributos, variaveis])

  const statsAtributo = useMemo(() => ({
    ok: atributos.filter(a => a.resultado === 'ok').length,
    nok: atributos.filter(a => a.resultado === 'nok').length,
  }), [atributos])

  const statsVariavel = useMemo(() => {
    const valores = variaveis.filter(v => v.valor !== '').map(v => parseFloat(v.valor))
    if (valores.length === 0) return null
    const media = valores.reduce((s, v) => s + v, 0) / valores.length
    const desvio = Math.sqrt(valores.reduce((s, v) => s + Math.pow(v - media, 2), 0) / valores.length)
    return { media: +media.toFixed(4), desvio: +desvio.toFixed(4), minimo: Math.min(...valores), maximo: Math.max(...valores) }
  }, [variaveis])

  // ── Montar payload ────────────────────────────────────────────────────────
  function montarPayload(status: 'finalizado' | 'rascunho'): NovaCEPColeta {
    if (!ctq) throw new Error('CTQ não selecionado')
    const amostras: AmostraCEP[] = ctq.tipo === 'atributo'
      ? atributos.filter(a => a.resultado !== null).map(a => ({ numero: a.numero, resultado: a.resultado! }))
      : variaveis.filter(v => v.valor !== '').map(v => ({ numero: v.numero, valor: parseFloat(v.valor) }))

    return {
      ctq_id: ctq.id, ctq_nome: ctq.nome, tipo: ctq.tipo,
      instrumento, data_coleta: dataColeta,
      numero_op: numeroOP.toUpperCase(), nome_operador: nomeOperador.trim(),
      total_amostras: ctq.totalAmostras,
      total_ok: ctq.tipo === 'atributo' ? statsAtributo.ok : null,
      total_nok: ctq.tipo === 'atributo' ? statsAtributo.nok : null,
      media: statsVariavel?.media ?? null, desvio_padrao: statsVariavel?.desvio ?? null,
      valor_minimo: statsVariavel?.minimo ?? null, valor_maximo: statsVariavel?.maximo ?? null,
      amostras, status,
    }
  }

  async function confirmar() {
    setSalvando(true)
    try {
      await onSalvar(montarPayload('finalizado'), rascunhoId)
      setResultado('salvo')
    } catch {
      // erro tratado pela página pai via setErro
    } finally {
      setSalvando(false)
    }
  }

  async function pausar() {
    setPausando(true)
    try {
      await onPausar(montarPayload('rascunho'), rascunhoId)
      setResultado('pausado')
    } catch {
      // erro tratado pela página pai via setErro
    } finally {
      setPausando(false)
    }
  }

  function resetar() {
    setEtapa(0); setCtq(null); setInstrumento(''); setNumeroOP(''); setNomeOperador('')
    setDataColeta(new Date().toISOString().split('T')[0])
    setAtributos([]); setVariaveis([]); setIndiceAtual(0); setValorDigitado(''); setResultado(null)
  }

  // ── Tela de sucesso / pausado ─────────────────────────────────────────────
  if (resultado === 'salvo') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <div className="text-8xl">✅</div>
        <h2 className="text-3xl font-bold text-[#1E9FAC] text-center">Coleta Salva!</h2>
        <p className="text-[#8FA3B0] text-center">
          {ctq?.nome} · OP {numeroOP.toUpperCase()} · {preenchidas} amostras
        </p>
        <button onClick={resetar} className="mt-4 bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 text-white font-bold text-xl px-10 py-5 rounded-xl transition-all">
          Nova Coleta
        </button>
      </div>
    )
  }

  if (resultado === 'pausado') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <div className="text-8xl">⏸️</div>
        <h2 className="text-3xl font-bold text-[#1A3344] text-center">Coleta Pausada</h2>
        <p className="text-[#8FA3B0] text-center">
          {preenchidas} de {ctq?.totalAmostras} amostras salvas. Você pode continuar depois na tela de CEP.
        </p>
        <button onClick={resetar} className="mt-4 bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 text-white font-bold text-xl px-10 py-5 rounded-xl transition-all">
          Fechar
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <EtapaIndicador etapaAtual={etapa} totalEtapas={SEQUENCIA.length} labels={SEQUENCIA.map(s => LABELS_ETAPA[s])} />

      {/* Badge "Continuando rascunho" */}
      {rascunhoId && etapaAtual === 'amostras' && (
        <div className="bg-[#E6F6F8] border border-[#1E9FAC] rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="text-[#1E9FAC] text-lg">🔄</span>
          <div>
            <p className="text-[#1A3344] text-sm font-bold">Continuando coleta pausada</p>
            <p className="text-[#8FA3B0] text-xs">OP {numeroOP.toUpperCase()} · {nomeOperador}</p>
          </div>
        </div>
      )}

      {/* ── Etapa 1: Seleção de CTQ ──────────────────────────────────────── */}
      {etapaAtual === 'ctq' && (
        <div className="flex flex-col gap-3">
          <p className="text-[#8FA3B0] text-sm text-center font-medium mb-1">Selecione o CTQ a coletar</p>
          {CTQS.map(c => (
            <button
              key={c.id}
              onClick={() => selecionarCTQ(c)}
              className="w-full rounded-xl border-2 px-5 py-4 text-left transition-all active:scale-[0.99] bg-white border-[#DDE4EA] hover:border-[#1E9FAC] text-[#1A3344]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-bold text-base leading-tight">{c.nome}</p>
                  <p className="text-xs mt-1 text-[#8FA3B0] leading-snug">{c.instrucao}</p>
                </div>
                <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md mt-0.5 ${
                  c.tipo === 'atributo' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {c.tipo === 'atributo' ? 'Atributo' : 'Variável'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Etapa 2: Dados Gerais ─────────────────────────────────────────── */}
      {etapaAtual === 'dados' && ctq && (
        <div className="flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">📋 Instrução</p>
            <p className="text-amber-900 text-sm leading-snug">{ctq.instrucao}</p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[#1A3344] text-sm font-semibold">Nome do Operador</label>
            <input type="text" value={nomeOperador} onChange={e => setNomeOperador(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && numeroOP && nomeOperador.trim() && instrumento.trim()) avancar() }}
              placeholder="Digite o nome do operador"
              className="bg-white border-2 border-[#DDE4EA] text-[#1A3344] text-base px-4 py-3 rounded-xl focus:border-[#1E9FAC] focus:outline-none placeholder:text-[#DDE4EA]" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[#1A3344] text-sm font-semibold">Instrumento</label>
            <input type="text" value={instrumento} onChange={e => setInstrumento(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && numeroOP && nomeOperador.trim() && instrumento.trim()) avancar() }}
              placeholder="Nome ou código do instrumento"
              className="bg-white border-2 border-[#DDE4EA] text-[#1A3344] text-base px-4 py-3 rounded-xl focus:border-[#1E9FAC] focus:outline-none placeholder:text-[#DDE4EA]" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[#1A3344] text-sm font-semibold">Data da Coleta</label>
            <input type="date" value={dataColeta} onChange={e => setDataColeta(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && numeroOP && nomeOperador.trim() && instrumento.trim()) avancar() }}
              className="bg-white border-2 border-[#DDE4EA] text-[#1A3344] text-base px-4 py-3 rounded-xl focus:border-[#1E9FAC] focus:outline-none" />
          </div>
          <TecladoNumerico label="Número da Ordem de Produção (OP)" valor={numeroOP}
            onChange={setNumeroOP} placeholder="ex: 000123456" maxLength={9}
            onEnter={() => { if (numeroOP && nomeOperador.trim() && instrumento.trim()) avancar() }} />
        </div>
      )}

      {/* ── Etapa 3: Amostras — Atributo ─────────────────────────────────── */}
      {etapaAtual === 'amostras' && ctq?.tipo === 'atributo' && (
        <div className="flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">📋 Instrução</p>
            <p className="text-amber-900 text-sm leading-snug">{ctq.instrucao}</p>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-[#8FA3B0] font-medium">{preenchidas} / {ctq.totalAmostras} coletadas</span>
            <div className="flex gap-3">
              <span className="text-[#1E9FAC] font-bold">✓ {statsAtributo.ok} OK</span>
              <span className="text-red-500 font-bold">✗ {statsAtributo.nok} NOK</span>
            </div>
          </div>

          <div className="bg-white border-2 border-[#1E9FAC] rounded-2xl p-6 flex flex-col items-center gap-4">
            <p className="text-[#8FA3B0] text-sm font-medium">Amostra</p>
            <p className="text-7xl font-black text-[#1A3344] leading-none">{atributos[indiceAtual]?.numero}</p>
            {atributos[indiceAtual]?.resultado && (
              <span className={`text-sm font-bold px-4 py-1 rounded-full ${
                atributos[indiceAtual].resultado === 'ok' ? 'bg-[#E6F6F8] text-[#1E9FAC]' : 'bg-red-100 text-red-600'
              }`}>
                {atributos[indiceAtual].resultado === 'ok' ? '✓ OK' : '✗ NOK'}
              </span>
            )}
            <div className="grid grid-cols-2 gap-3 w-full">
              <button onClick={() => definirAtributo(indiceAtual, 'ok')}
                className={`py-5 rounded-xl font-black text-xl transition-all active:scale-95 border-2 ${
                  atributos[indiceAtual]?.resultado === 'ok'
                    ? 'bg-[#1E9FAC] border-[#1E9FAC] text-white'
                    : 'bg-white border-[#DDE4EA] text-[#1A3344] hover:border-[#1E9FAC] hover:text-[#1E9FAC]'
                }`}>
                ✓ OK
              </button>
              <button onClick={() => definirAtributo(indiceAtual, 'nok')}
                className={`py-5 rounded-xl font-black text-xl transition-all active:scale-95 border-2 ${
                  atributos[indiceAtual]?.resultado === 'nok'
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'bg-white border-[#DDE4EA] text-[#1A3344] hover:border-red-400 hover:text-red-500'
                }`}>
                ✗ NOK
              </button>
            </div>
          </div>

          {/* Mini-grade */}
          <div className="grid grid-cols-7 gap-1">
            {atributos.map((a, i) => (
              <button key={a.numero} onClick={() => setIndiceAtual(i)}
                className={`h-9 rounded text-xs font-bold transition-all ${i === indiceAtual ? 'ring-2 ring-[#1E9FAC] ring-offset-1' : ''} ${
                  a.resultado === 'ok' ? 'bg-[#1E9FAC] text-white' :
                  a.resultado === 'nok' ? 'bg-red-500 text-white' :
                  'bg-[#F2F5F7] text-[#8FA3B0]'
                }`}>
                {a.numero}
              </button>
            ))}
          </div>

          {/* Botões de ação da coleta */}
          {preenchidas > 0 && (
            <div className="flex gap-3 mt-1">
              <button onClick={pausar} disabled={pausando}
                className="flex-1 bg-white border-2 border-[#DDE4EA] hover:border-[#1A3344] active:scale-95 disabled:opacity-40 text-[#1A3344] font-bold py-4 rounded-xl transition-all text-sm">
                {pausando ? 'Salvando…' : '⏸ Pausar Coleta'}
              </button>
              <button onClick={avancar}
                className="flex-1 bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 text-white font-bold py-4 rounded-xl transition-all text-sm">
                Finalizar →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Etapa 3: Amostras — Variável ─────────────────────────────────── */}
      {etapaAtual === 'amostras' && ctq?.tipo === 'variavel' && (
        <div className="flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">📋 Instrução</p>
            <p className="text-amber-900 text-sm leading-snug">{ctq.instrucao}</p>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-[#8FA3B0] font-medium">{preenchidas} / {ctq.totalAmostras} coletadas</span>
            <span className="text-[#1A3344] font-bold">Amostra {variaveis[indiceAtual]?.numero}</span>
          </div>

          <div
            className="bg-white border-2 border-[#1E9FAC] rounded-2xl px-6 py-5 flex flex-col items-center gap-1 cursor-text select-none"
            onClick={() => decimalInputRef.current?.focus()}
          >
            <p className="text-[#8FA3B0] text-xs font-medium">Amostra {variaveis[indiceAtual]?.numero} de {ctq.totalAmostras}</p>
            <div className="text-5xl font-black font-mono text-[#1A3344] min-h-[56px] flex items-center">
              {valorDigitado || variaveis[indiceAtual]?.valor
                ? <span>{valorDigitado || variaveis[indiceAtual]?.valor}</span>
                : <span className="text-[#DDE4EA]">—</span>}
            </div>
          </div>

          {/* Input oculto — captura teclado físico (inputMode=none evita teclado virtual) */}
          <input
            ref={decimalInputRef}
            type="text"
            inputMode="none"
            readOnly
            aria-hidden="true"
            tabIndex={-1}
            className="sr-only"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                salvarEAvancarVariavel()
                setTimeout(() => decimalInputRef.current?.focus(), 30)
                return
              }
              if (e.key === 'Backspace') { setValorDigitado(v => v.slice(0, -1)); return }
              if (e.key === '.' || e.key === ',') {
                if (!valorDigitado.includes('.')) setValorDigitado(v => v + '.')
                return
              }
              if (e.key >= '0' && e.key <= '9') {
                setValorDigitado(v => v + e.key)
              }
            }}
          />

          {/* Teclado decimal */}
          <div className="grid grid-cols-3 gap-3">
            {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(t => (
              <button key={t} type="button"
                onClick={() => {
                  if (t === '⌫') { setValorDigitado(v => v.slice(0, -1)); decimalInputRef.current?.focus(); return }
                  if (t === '.' && valorDigitado.includes('.')) { decimalInputRef.current?.focus(); return }
                  setValorDigitado(v => v + t)
                  decimalInputRef.current?.focus()
                }}
                className={`h-14 rounded-xl text-xl font-bold transition-all active:scale-95 border ${
                  t === '⌫'
                    ? 'bg-[#DDE4EA] hover:bg-[#c8d3db] text-[#3D5568] border-transparent'
                    : 'bg-white hover:bg-[#E6F6F8] hover:border-[#1E9FAC] text-[#1A3344] border-[#DDE4EA]'
                }`}>
                {t}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            {indiceAtual > 0 && (
              <button onClick={() => navegarVariavel(indiceAtual - 1)}
                className="flex-1 bg-white border border-[#DDE4EA] hover:border-[#1E9FAC] hover:text-[#1E9FAC] active:scale-95 text-[#3D5568] font-semibold py-4 rounded-xl transition-all">
                ← Anterior
              </button>
            )}
            <button onClick={salvarEAvancarVariavel}
              disabled={!valorDigitado && !variaveis[indiceAtual]?.valor}
              className="flex-1 bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 disabled:opacity-40 text-white font-bold py-4 rounded-xl transition-all">
              {indiceAtual < variaveis.length - 1 ? 'Próxima →' : '✓ Última'}
            </button>
          </div>

          {/* Mini-grade */}
          <div className="grid grid-cols-7 gap-1">
            {variaveis.map((v, i) => (
              <button key={v.numero} onClick={() => navegarVariavel(i)}
                className={`h-9 rounded text-xs font-bold transition-all ${i === indiceAtual ? 'ring-2 ring-[#1E9FAC] ring-offset-1' : ''} ${
                  v.valor !== '' ? 'bg-[#1E9FAC] text-white' : 'bg-[#F2F5F7] text-[#8FA3B0]'
                }`}>
                {v.numero}
              </button>
            ))}
          </div>

          {/* Botões de ação da coleta */}
          {preenchidas > 0 && (
            <div className="flex gap-3 mt-1">
              <button onClick={pausar} disabled={pausando}
                className="flex-1 bg-white border-2 border-[#DDE4EA] hover:border-[#1A3344] active:scale-95 disabled:opacity-40 text-[#1A3344] font-bold py-4 rounded-xl transition-all text-sm">
                {pausando ? 'Salvando…' : '⏸ Pausar Coleta'}
              </button>
              <button onClick={avancar}
                className="flex-1 bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 text-white font-bold py-4 rounded-xl transition-all text-sm">
                Finalizar →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Etapa 4: Confirmar ────────────────────────────────────────────── */}
      {etapaAtual === 'confirmar' && ctq && (
        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-bold text-center text-[#1A3344] mb-2">Confirmar Coleta CEP</h3>

          {preenchidas < ctq.totalAmostras && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="text-amber-600 text-lg">⚠️</span>
              <p className="text-amber-800 text-sm">
                <strong>{preenchidas} de {ctq.totalAmostras}</strong> amostras coletadas. Coleta parcial será salva como finalizada.
              </p>
            </div>
          )}

          <div className="bg-white border border-[#DDE4EA] rounded-xl p-5 flex flex-col gap-3 text-base">
            <Linha label="CTQ" valor={ctq.nome} />
            <Linha label="Tipo" valor={ctq.tipo === 'atributo' ? 'Atributo (OK/NOK)' : 'Variável (Medida)'} />
            <Linha label="Operador" valor={nomeOperador} />
            <Linha label="OP" valor={numeroOP.toUpperCase()} />
            <Linha label="Instrumento" valor={instrumento} />
            <Linha label="Data" valor={new Date(dataColeta + 'T12:00:00').toLocaleDateString('pt-BR')} />
            <Linha label="Amostras Coletadas" valor={`${preenchidas} / ${ctq.totalAmostras}`} />
            {ctq.tipo === 'atributo' && (
              <>
                <Linha label="✓ OK" valor={`${statsAtributo.ok}`} />
                <Linha label="✗ NOK" valor={`${statsAtributo.nok}`} />
              </>
            )}
            {ctq.tipo === 'variavel' && statsVariavel && (
              <>
                <Linha label="Média" valor={`${statsVariavel.media}`} />
                <Linha label="Desvio Padrão" valor={`${statsVariavel.desvio}`} />
                <Linha label="Mín / Máx" valor={`${statsVariavel.minimo} / ${statsVariavel.maximo}`} />
              </>
            )}
          </div>
          <button onClick={confirmar} disabled={salvando}
            className="bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 disabled:opacity-50 text-white font-bold text-2xl py-6 rounded-xl transition-all mt-2">
            {salvando ? 'Salvando…' : '✓ Salvar Coleta'}
          </button>
          <button onClick={voltar}
            className="bg-white border border-[#DDE4EA] hover:border-[#1E9FAC] hover:text-[#1E9FAC] active:scale-95 text-[#3D5568] font-semibold text-lg py-4 rounded-xl transition-all">
            ← Voltar
          </button>
        </div>
      )}

      {/* Voltar (etapa dados) */}
      {etapaAtual === 'dados' && (
        <div className="flex gap-3 mt-2">
          <button onClick={voltar}
            className="flex-1 bg-white border border-[#DDE4EA] hover:border-[#1E9FAC] hover:text-[#1E9FAC] active:scale-95 text-[#3D5568] font-semibold text-lg py-4 rounded-xl transition-all">
            ← Voltar
          </button>
          <button onClick={avancar}
            disabled={!numeroOP || !nomeOperador.trim() || !instrumento.trim()}
            className="flex-1 bg-[#1E9FAC] hover:bg-[#157A86] active:scale-95 disabled:opacity-40 text-white font-bold text-lg py-4 rounded-xl transition-all">
            Continuar →
          </button>
        </div>
      )}
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
