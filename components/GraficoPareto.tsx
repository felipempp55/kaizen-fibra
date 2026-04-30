'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface DadoPareto {
  nome: string
  valor: number
  percentualAcumulado: number
}

interface Props {
  dados: DadoPareto[]
  corBarra?: string
  labelValor?: string
}

function truncar(texto: string, max = 22) {
  return texto.length > max ? texto.slice(0, max) + '…' : texto
}

export default function GraficoPareto({ dados, corBarra = '#3b82f6', labelValor = 'Qtd' }: Props) {
  if (dados.length === 0) {
    return <p className="text-slate-500 text-center py-10">Sem dados no período</p>
  }

  const dadosFormatados = dados.map(d => ({ ...d, nomeExibido: truncar(d.nome) }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={dadosFormatados} margin={{ top: 10, right: 50, left: 0, bottom: 70 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="nomeExibido"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
          labelStyle={{ color: '#e2e8f0' }}
          labelFormatter={(label) => dados.find(d => truncar(d.nome) === label)?.nome ?? label}
          formatter={(value, name) => [
            name === 'percentualAcumulado' ? `${value}%` : value,
            name === 'percentualAcumulado' ? 'Acumulado' : labelValor,
          ]}
        />
        <Bar yAxisId="left" dataKey="valor" fill={corBarra} radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="percentualAcumulado"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ fill: '#f59e0b', r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
