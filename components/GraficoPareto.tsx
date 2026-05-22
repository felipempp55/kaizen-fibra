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

export default function GraficoPareto({ dados, corBarra = '#56A4BB', labelValor = 'Qtd' }: Props) {
  if (dados.length === 0) {
    return <p className="text-center py-10" style={{ color: '#607A89', fontSize: 14 }}>Sem dados no período</p>
  }

  const dadosFormatados = dados.map(d => ({ ...d, nomeExibido: truncar(d.nome) }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={dadosFormatados} margin={{ top: 10, right: 52, left: 0, bottom: 72 }}>
        <defs>
          <linearGradient id={`gradPareto-${corBarra.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={corBarra} stopOpacity={1}   />
            <stop offset="100%" stopColor={corBarra} stopOpacity={0.7} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#ECF1F4" vertical={false} />

        <XAxis
          dataKey="nomeExibido"
          tick={{ fill: '#607A89', fontSize: 11, fontFamily: 'var(--font-body)' }}
          axisLine={false}
          tickLine={false}
          angle={-35}
          textAnchor="end"
          interval={0}
        />

        <YAxis
          yAxisId="left"
          tick={{ fill: '#607A89', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />

        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tick={{ fill: '#607A89', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />

        <Tooltip
          contentStyle={{
            backgroundColor: '#1F3744',
            border: '1px solid #56A4BB',
            borderRadius: 10,
            fontSize: 12,
            boxShadow: '0 4px 16px rgba(31,55,68,0.18)',
          }}
          labelStyle={{ color: '#ffffff', fontWeight: 700, marginBottom: 4 }}
          itemStyle={{ color: '#b3d4e0' }}
          labelFormatter={(label) => dados.find(d => truncar(d.nome) === label)?.nome ?? label}
          formatter={(value, name) => [
            name === 'percentualAcumulado' ? `${value}%` : value,
            name === 'percentualAcumulado' ? 'Acumulado' : labelValor,
          ]}
        />

        <Bar
          yAxisId="left"
          dataKey="valor"
          fill={`url(#gradPareto-${corBarra.replace('#', '')})`}
          radius={[5, 5, 0, 0]}
          maxBarSize={56}
        />

        <Line
          yAxisId="right"
          type="monotone"
          dataKey="percentualAcumulado"
          stroke="#D4A155"
          strokeWidth={2.5}
          dot={{ fill: '#D4A155', stroke: '#fff', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: '#D4A155' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
