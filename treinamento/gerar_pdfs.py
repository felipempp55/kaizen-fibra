# -*- coding: utf-8 -*-
"""
Gerador de PDFs de treinamento — Sistema Kaizen Fibra (MSB)
Documento 1: Manual de Treinamento Completo
Documento 2: Guia Rápido de Bolso
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import Flowable
from reportlab.pdfgen import canvas

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Paleta de cores ───────────────────────────────────────────────────────────
AZUL_MSB    = colors.HexColor('#1E40AF')   # azul escuro
AZUL_CLARO  = colors.HexColor('#DBEAFE')
VERDE       = colors.HexColor('#15803D')
VERDE_CLARO = colors.HexColor('#DCFCE7')
AMARELO     = colors.HexColor('#CA8A04')
AMARELO_CL  = colors.HexColor('#FEF9C3')
VERMELHO    = colors.HexColor('#DC2626')
VERMELHO_CL = colors.HexColor('#FEE2E2')
CINZA       = colors.HexColor('#6B7280')
CINZA_CLARO = colors.HexColor('#F3F4F6')
CINZA_BRD   = colors.HexColor('#D1D5DB')
LARANJA     = colors.HexColor('#EA580C')
LARANJA_CL  = colors.HexColor('#FFEDD5')
BRANCO      = colors.white
PRETO       = colors.black


# ── Caixa colorida (atenção / dica) ──────────────────────────────────────────
class CaixaInfo(Flowable):
    def __init__(self, titulo, texto, bg=AZUL_CLARO, border=AZUL_MSB, w=None):
        super().__init__()
        self.titulo = titulo
        self.texto  = texto
        self.bg     = bg
        self.border = border
        self._w     = w or (A4[0] - 4*cm)

    def wrap(self, aw, ah):
        self.width = min(self._w, aw)
        return self.width, self._calcHeight()

    def _calcHeight(self):
        lines_titulo = max(1, len(self.titulo) // 55 + 1)
        lines_texto  = max(1, len(self.texto)  // 70 + 1)
        return (lines_titulo + lines_texto) * 14 + 28

    def draw(self):
        h = self._calcHeight()
        c = self.canv
        c.setFillColor(self.bg)
        c.roundRect(0, 0, self.width, h, 6, fill=1, stroke=0)
        c.setStrokeColor(self.border)
        c.setLineWidth(2)
        c.roundRect(0, 0, self.width, h, 6, fill=0, stroke=1)
        # barra lateral esquerda
        c.setFillColor(self.border)
        c.rect(0, 0, 5, h, fill=1, stroke=0)
        # título
        c.setFillColor(self.border)
        c.setFont('Helvetica-Bold', 10)
        c.drawString(14, h - 18, self.titulo)
        # texto
        c.setFillColor(PRETO)
        c.setFont('Helvetica', 9)
        y = h - 32
        for line in self._wrap_text(self.texto, 95):
            c.drawString(14, y, line)
            y -= 13

    def _wrap_text(self, text, width):
        words = text.split()
        lines, line = [], ''
        for w in words:
            if len(line) + len(w) + 1 <= width:
                line = (line + ' ' + w).strip()
            else:
                if line: lines.append(line)
                line = w
        if line: lines.append(line)
        return lines


# ── Estilos compartilhados ────────────────────────────────────────────────────
def estilos():
    base = getSampleStyleSheet()
    s = {}

    s['titulo_doc'] = ParagraphStyle('titulo_doc',
        fontSize=26, fontName='Helvetica-Bold',
        textColor=BRANCO, alignment=TA_CENTER, spaceAfter=4)

    s['subtitulo_doc'] = ParagraphStyle('subtitulo_doc',
        fontSize=13, fontName='Helvetica',
        textColor=BRANCO, alignment=TA_CENTER, spaceAfter=2)

    s['h1'] = ParagraphStyle('h1',
        fontSize=16, fontName='Helvetica-Bold',
        textColor=AZUL_MSB, spaceBefore=18, spaceAfter=8,
        borderPad=4)

    s['h2'] = ParagraphStyle('h2',
        fontSize=13, fontName='Helvetica-Bold',
        textColor=VERDE, spaceBefore=14, spaceAfter=6)

    s['h3'] = ParagraphStyle('h3',
        fontSize=11, fontName='Helvetica-Bold',
        textColor=AZUL_MSB, spaceBefore=10, spaceAfter=4)

    s['corpo'] = ParagraphStyle('corpo',
        fontSize=10, fontName='Helvetica',
        textColor=PRETO, spaceBefore=4, spaceAfter=4,
        leading=15, alignment=TA_JUSTIFY)

    s['corpo_bold'] = ParagraphStyle('corpo_bold',
        fontSize=10, fontName='Helvetica-Bold',
        textColor=PRETO, spaceBefore=4, spaceAfter=4, leading=15)

    s['item'] = ParagraphStyle('item',
        fontSize=10, fontName='Helvetica',
        textColor=PRETO, spaceBefore=3, spaceAfter=3,
        leading=14, leftIndent=16)

    s['passo'] = ParagraphStyle('passo',
        fontSize=11, fontName='Helvetica-Bold',
        textColor=BRANCO, alignment=TA_CENTER)

    s['rodape'] = ParagraphStyle('rodape',
        fontSize=8, fontName='Helvetica',
        textColor=CINZA, alignment=TA_CENTER)

    s['capa_empresa'] = ParagraphStyle('capa_empresa',
        fontSize=11, fontName='Helvetica',
        textColor=BRANCO, alignment=TA_CENTER)

    return s


# ═══════════════════════════════════════════════════════════════════════════════
#  DOCUMENTO 1 — MANUAL DE TREINAMENTO
# ═══════════════════════════════════════════════════════════════════════════════

def gerar_manual():
    path = os.path.join(OUT_DIR, 'Manual_Treinamento_MSB_Fibra.pdf')
    doc  = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=2.2*cm, rightMargin=2.2*cm,
        topMargin=2.5*cm,  bottomMargin=2.2*cm,
        title='Manual de Treinamento — Sistema Kaizen Fibra',
        author='MSB — Medical System do Brasil',
    )

    S  = estilos()
    W  = A4[0] - 4.4*cm   # largura útil
    story = []

    # ── CAPA ─────────────────────────────────────────────────────────────────
    # Retângulo de capa via Table com fundo azul
    capa_data = [[
        Paragraph('Sistema Kaizen Fibra', S['titulo_doc']),
    ]]
    capa_table = Table(capa_data, colWidths=[W])
    capa_table.setStyle(TableStyle([
        ('BACKGROUND',  (0,0), (-1,-1), AZUL_MSB),
        ('TOPPADDING',  (0,0), (-1,-1), 28),
        ('BOTTOMPADDING',(0,0),(-1,-1), 10),
        ('ROUNDEDCORNERS', [8]),
    ]))
    story.append(capa_table)
    story.append(Spacer(1, 6))

    sub_data = [[
        Paragraph('Manual de Uso — Apontamento de Desperdícios', S['subtitulo_doc']),
    ]]
    sub_table = Table(sub_data, colWidths=[W])
    sub_table.setStyle(TableStyle([
        ('BACKGROUND',  (0,0), (-1,-1), AZUL_MSB),
        ('TOPPADDING',  (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0),(-1,-1), 6),
    ]))
    story.append(sub_table)
    story.append(Spacer(1, 4))

    empresa_data = [[
        Paragraph('MSB · Medical System do Brasil', S['capa_empresa']),
    ]]
    emp_table = Table(empresa_data, colWidths=[W])
    emp_table.setStyle(TableStyle([
        ('BACKGROUND',  (0,0), (-1,-1), CINZA),
        ('TOPPADDING',  (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0),(-1,-1), 6),
    ]))
    story.append(emp_table)
    story.append(Spacer(1, 20))

    # Caixa de boas-vindas
    story.append(CaixaInfo(
        '👋  Olá! Este manual é para você.',
        'Este guia foi feito especialmente para as operadoras da linha de produção. '
        'Aqui você vai aprender a usar o sistema Kaizen Fibra no tablet de forma simples e rápida. '
        'Não precisa saber nada de informática — é só seguir os passos!',
        bg=VERDE_CLARO, border=VERDE, w=W
    ))
    story.append(Spacer(1, 16))

    # Índice visual
    indice_itens = [
        ('1.', 'O que é esse sistema?',            '2'),
        ('2.', 'Como ligar o tablet e abrir o site','2'),
        ('3.', 'Abrindo a Ordem de Produção (OP)',  '3'),
        ('4.', 'Fazendo um apontamento',            '4'),
        ('5.', 'O cronômetro de retrabalho',        '6'),
        ('6.', 'Dúvidas frequentes',                '7'),
        ('7.', 'O que fazer se der errado',         '8'),
    ]
    indice_data = [[Paragraph(f'<b>{n}</b>  {t}', S['corpo']),
                    Paragraph(f'pág. {p}', S['corpo'])]
                   for n, t, p in indice_itens]
    indice_table = Table(indice_data, colWidths=[W*0.85, W*0.15])
    indice_table.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), CINZA_CLARO),
        ('BACKGROUND',   (0,0), (-1,-1), BRANCO),
        ('ROWBACKGROUNDS',(0,0),(-1,-1), [CINZA_CLARO, BRANCO]),
        ('LINEBELOW',    (0,0), (-1,-2), 0.5, CINZA_BRD),
        ('TOPPADDING',   (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0), (-1,-1), 6),
        ('LEFTPADDING',  (0,0), (0,-1), 8),
        ('ALIGN',        (1,0), (1,-1), 'RIGHT'),
        ('FONTNAME',     (1,0), (1,-1), 'Helvetica-Bold'),
        ('TEXTCOLOR',    (1,0), (1,-1), AZUL_MSB),
    ]))
    story.append(indice_table)
    story.append(PageBreak())

    # ── SEÇÃO 1: O que é esse sistema? ───────────────────────────────────────
    story.append(numero_secao('1', 'O que é esse sistema?', S, W))
    story.append(Paragraph(
        'O <b>Kaizen Fibra</b> é um sistema que serve para <b>registrar os desperdícios</b> que acontecem '
        'durante a fabricação dos conectores de fibra óptica. Pense nele como um <b>caderno digital</b>: '
        'sempre que uma peça for perdida ou precisar de retrabalho, você anota no sistema.',
        S['corpo']))
    story.append(Spacer(1, 8))
    story.append(Paragraph('Por que isso é importante?', S['h3']))
    motivos = [
        '✅  Ajuda a identificar onde estão os maiores problemas na produção.',
        '✅  Mostra para a supervisão e qualidade o que precisa melhorar.',
        '✅  Permite calcular quanto cada desperdício está custando para a empresa.',
        '✅  Torna o trabalho de todos mais organizado e rastreável.',
    ]
    for m in motivos:
        story.append(Paragraph(m, S['item']))
    story.append(Spacer(1, 8))
    story.append(CaixaInfo(
        '💡  Boa notícia!',
        'O sistema é muito simples. Você só vai tocar na tela do tablet para escolher as opções — '
        'não precisa digitar quase nada.',
        bg=VERDE_CLARO, border=VERDE, w=W
    ))
    story.append(Spacer(1, 18))

    # ── SEÇÃO 2: Como ligar o tablet ─────────────────────────────────────────
    story.append(numero_secao('2', 'Como ligar o tablet e abrir o site', S, W))
    passos_tablet = [
        ('1', 'Ligue o tablet (botão lateral ou superior).'),
        ('2', 'Aguarde a tela inicial aparecer.'),
        ('3', 'Toque no ícone do navegador (Google Chrome ou similar).'),
        ('4', 'O site do Kaizen Fibra deve abrir automaticamente.\n'
              'Se não abrir, pergunte para a supervisão o endereço do site.'),
    ]
    story.extend(passos_visuais(passos_tablet, S, W))
    story.append(Spacer(1, 8))
    story.append(CaixaInfo(
        '⚠️  Atenção',
        'O tablet precisa estar conectado ao Wi-Fi da fábrica. Se a tela aparecer em branco ou '
        'mostrar "Sem conexão", avise a supervisão.',
        bg=AMARELO_CL, border=AMARELO, w=W
    ))
    story.append(PageBreak())

    # ── SEÇÃO 3: Abrindo a Ordem de Produção ─────────────────────────────────
    story.append(numero_secao('3', 'Abrindo a Ordem de Produção (OP)', S, W))
    story.append(Paragraph(
        'A <b>Ordem de Produção (OP)</b> é o número que identifica o lote de peças que você está '
        'fabricando agora. Pense nela como o "número do pedido" do dia.',
        S['corpo']))
    story.append(Spacer(1, 10))

    story.append(Paragraph('Quando há uma OP já aberta:', S['h3']))
    story.append(Paragraph(
        'Se alguém já abriu a OP antes de você, a tela principal vai mostrar o número da OP '
        'e um botão <b>"+ Novo Apontamento"</b>. É só clicar nesse botão e começar a apontar!',
        S['corpo']))
    story.append(Spacer(1, 10))

    story.append(Paragraph('Quando não há OP aberta:', S['h3']))
    story.append(Paragraph(
        'A tela vai mostrar um botão <b>"Abrir Ordem de Produção"</b>. Siga os passos abaixo:',
        S['corpo']))
    story.append(Spacer(1, 6))

    passos_op = [
        ('1', 'Toque em "Abrir Ordem de Produção".'),
        ('2', 'Digite o número da OP (exemplo: OP26000369).\n'
              'Esse número está na folha de produção que o supervisor entregou.'),
        ('3', 'Escolha o tipo de fibra: F272 ou F365.\n'
              'Essa informação também está na folha de produção.'),
        ('4', 'Digite o tamanho da OP (quantidade total de peças do lote).'),
        ('5', 'Toque em "Iniciar Apontamentos". Pronto! A OP está aberta.'),
    ]
    story.extend(passos_visuais(passos_op, S, W))
    story.append(Spacer(1, 8))

    story.append(CaixaInfo(
        '💡  Dica',
        'Não sabe o tipo de fibra ou o tamanho da OP? Pergunte para o supervisor antes de '
        'abrir. Essas informações ficam na folha de produção.',
        bg=AZUL_CLARO, border=AZUL_MSB, w=W
    ))
    story.append(Spacer(1, 8))

    story.append(CaixaInfo(
        '⚠️  Importante',
        'Todos os tablets vão mostrar a mesma OP automaticamente. '
        'Se você abrir uma OP nova, todos os colegas vão ver também.',
        bg=AMARELO_CL, border=AMARELO, w=W
    ))
    story.append(PageBreak())

    # ── SEÇÃO 4: Fazendo um apontamento ──────────────────────────────────────
    story.append(numero_secao('4', 'Fazendo um apontamento', S, W))
    story.append(Paragraph(
        'Um <b>apontamento</b> é o registro de um desperdício que aconteceu. '
        'Sempre que uma peça for perdida ou precisar de retrabalho, você precisa fazer um apontamento.',
        S['corpo']))
    story.append(Spacer(1, 10))

    story.append(Paragraph('Passo a passo:', S['h2']))
    passos_apoint = [
        ('1', 'Na tela principal, toque em "+ Novo Apontamento".'),
        ('2', 'Escolha o GRUPO do desperdício (veja a tabela abaixo).'),
        ('3', 'Escolha o TIPO do desperdício dentro do grupo.'),
        ('4', 'Escolha o seu NOME na lista de operadoras.'),
        ('5', 'Informe a quantidade de peças (ou ml, dependendo do tipo).'),
        ('6', 'Se aparecer a opção, classifique como PERDA ou RETRABALHO.'),
        ('7', 'Toque em "Confirmar". O apontamento foi salvo!'),
    ]
    story.extend(passos_visuais(passos_apoint, S, W))
    story.append(Spacer(1, 12))

    # Tabela de grupos e tipos
    story.append(Paragraph('Tabela de Grupos e Tipos de Desperdício:', S['h3']))
    story.append(Spacer(1, 4))

    grupos_data = [
        ['GRUPO', 'TIPO DE DESPERDÍCIO', 'O QUE REGISTRAR'],
        ['Epóxi',
         'Entupimento do Ferrule',
         'Peças que não puderam ser usadas por entupimento'],
        ['',
         'Qtd desperdiçada de Epóxi',
         'Quantidade de epóxi desperdiçada (em ml)'],
        ['Polimento',
         'Manual',
         'Peças que precisaram de repolimento manual'],
        ['',
         'Máquina',
         'Retrabalhos e peças perdidas na máquina de polir'],
        ['Problemas\nDimensionais',
         'Recuo de Fibra',
         'Peças descartadas por recuo de fibra'],
        ['',
         'Polim. Recartilhado SMA',
         'Peças que precisaram de polimento extra no SMA'],
        ['',
         'Crimpagem',
         'Peças perdidas ou enviadas à manutenção na crimpagem'],
        ['Clivagem',
         'Clivagem com Defeito',
         'Peças com defeito de clivagem (perdidas ou retrabalho)'],
    ]
    col_w = [W*0.18, W*0.30, W*0.52]
    t = Table(grupos_data, colWidths=col_w)
    t.setStyle(TableStyle([
        # Cabeçalho
        ('BACKGROUND',   (0,0), (-1,0), AZUL_MSB),
        ('TEXTCOLOR',    (0,0), (-1,0), BRANCO),
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,0), 9),
        ('ALIGN',        (0,0), (-1,0), 'CENTER'),
        ('TOPPADDING',   (0,0), (-1,0), 7),
        ('BOTTOMPADDING',(0,0), (-1,0), 7),
        # Corpo
        ('FONTSIZE',     (0,1), (-1,-1), 8.5),
        ('TOPPADDING',   (0,1), (-1,-1), 5),
        ('BOTTOMPADDING',(0,1), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 6),
        # Agrupamento visual por grupo
        ('BACKGROUND', (0,1), (-1,2), AZUL_CLARO),
        ('BACKGROUND', (0,3), (-1,4), VERDE_CLARO),
        ('BACKGROUND', (0,5), (-1,7), AMARELO_CL),
        ('BACKGROUND', (0,8), (-1,8), LARANJA_CL),
        # Merge células de grupo (simular com span)
        ('SPAN',         (0,1), (0,2)),
        ('SPAN',         (0,3), (0,4)),
        ('SPAN',         (0,5), (0,7)),
        ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
        ('FONTNAME',     (0,1), (0,-1), 'Helvetica-Bold'),
        ('GRID',         (0,0), (-1,-1), 0.5, CINZA_BRD),
    ]))
    story.append(t)
    story.append(Spacer(1, 12))

    # Perda vs Retrabalho
    story.append(Paragraph('Perda ou Retrabalho? Entenda a diferença:', S['h3']))
    pv_data = [
        ['🗑️  PERDA', '🔧  RETRABALHO'],
        ['A peça foi para o lixo.\nNão tem como recuperar.',
         'A peça precisou ser refeita,\nmas foi aproveitada no final.'],
        ['Exemplo: ferrule entupido que\nquebrou ao tentar desmontar.',
         'Exemplo: peça que saiu do\npolimento com defeito e foi\nrepolida com sucesso.'],
    ]
    pv_table = Table(pv_data, colWidths=[W/2 - 4, W/2 - 4], spaceBefore=4)
    pv_table.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (0,0), VERMELHO),
        ('BACKGROUND',   (1,0), (1,0), VERDE),
        ('TEXTCOLOR',    (0,0), (-1,0), BRANCO),
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,-1), 9),
        ('ALIGN',        (0,0), (-1,0), 'CENTER'),
        ('BACKGROUND',   (0,1), (0,2), VERMELHO_CL),
        ('BACKGROUND',   (1,1), (1,2), VERDE_CLARO),
        ('GRID',         (0,0), (-1,-1), 0.5, CINZA_BRD),
        ('TOPPADDING',   (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0), (-1,-1), 6),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('VALIGN',       (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(pv_table)
    story.append(PageBreak())

    # ── SEÇÃO 5: Cronômetro de Retrabalho ────────────────────────────────────
    story.append(numero_secao('5', 'O cronômetro de retrabalho', S, W))
    story.append(Paragraph(
        'Quando você vai fazer um <b>retrabalho manual de polimento</b>, o sistema tem um '
        '<b>cronômetro</b> para medir quanto tempo você gastou. Isso ajuda a calcular o custo '
        'do retrabalho para a empresa.',
        S['corpo']))
    story.append(Spacer(1, 10))

    story.append(Paragraph('Como usar o cronômetro:', S['h3']))
    passos_timer = [
        ('1', 'Na tela de apontamento, você vai ver o cronômetro no topo.'),
        ('2', 'Toque em "Iniciar" quando começar o retrabalho.'),
        ('3', 'O número vai começar a contar (00:00, 00:01, 00:02...).'),
        ('4', 'Se precisar parar por um momento, toque em "Pausar".\n'
              'O tempo fica salvo. Toque em "Retomar" quando voltar.'),
        ('5', 'Quando terminar o retrabalho, toque em "Concluir".\n'
              'O tempo é salvo automaticamente no sistema!'),
    ]
    story.extend(passos_visuais(passos_timer, S, W))
    story.append(Spacer(1, 10))

    # Botões do timer visualmente
    botoes_data = [
        ['▶  INICIAR', '⏸  PAUSAR', '▶  RETOMAR', '✔  CONCLUIR'],
        ['Começa a\ncontar', 'Para o\ncronômetro', 'Continua\nda pausa', 'Salva o\ntempo'],
    ]
    bt = Table(botoes_data, colWidths=[W/4-2]*4)
    bt.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (0,0), VERDE),
        ('BACKGROUND',   (1,0), (1,0), AMARELO),
        ('BACKGROUND',   (2,0), (2,0), AZUL_MSB),
        ('BACKGROUND',   (3,0), (3,0), VERMELHO),
        ('TEXTCOLOR',    (0,0), (-1,0), BRANCO),
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,-1), 9),
        ('ALIGN',        (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING',   (0,0), (-1,-1), 7),
        ('BOTTOMPADDING',(0,0), (-1,-1), 7),
        ('GRID',         (0,0), (-1,-1), 0.5, CINZA_BRD),
        ('BACKGROUND',   (0,1), (-1,1), CINZA_CLARO),
        ('FONTSIZE',     (0,1), (-1,1), 8),
    ]))
    story.append(bt)
    story.append(Spacer(1, 10))

    story.append(CaixaInfo(
        '⚠️  Atenção — Não esqueça de concluir!',
        'Se você fechar o aplicativo ou sair da tela sem clicar em "Concluir", '
        'o tempo NÃO será salvo. Sempre clique em Concluir quando terminar o retrabalho.',
        bg=VERMELHO_CL, border=VERMELHO, w=W
    ))
    story.append(Spacer(1, 10))

    story.append(CaixaInfo(
        '💡  Para que serve esse dado?',
        'O tempo registrado é usado para calcular o custo de hora-homem do retrabalho. '
        'Esses dados aparecem no painel de controle da qualidade para ajudar a identificar '
        'onde o retrabalho está consumindo mais tempo e dinheiro.',
        bg=AZUL_CLARO, border=AZUL_MSB, w=W
    ))
    story.append(PageBreak())

    # ── SEÇÃO 6: Dúvidas frequentes ──────────────────────────────────────────
    story.append(numero_secao('6', 'Dúvidas frequentes', S, W))

    faqs = [
        ('Posso fazer mais de um apontamento ao mesmo dia?',
         'Sim! Você pode fazer quantos apontamentos precisar durante o turno. '
         'Cada desperdício que acontecer deve ter o seu próprio apontamento.'),

        ('Posso usar qualquer tablet?',
         'Sim. Todos os tablets mostram as mesmas informações. '
         'Se a Maria abriu a OP no tablet 1, você já vai ver ela no tablet 2.'),

        ('E se eu apontar errado?',
         'Avise imediatamente a supervisão ou a qualidade. '
         'Somente elas podem corrigir ou cancelar apontamentos no sistema.'),

        ('Preciso esperar a OP terminar para fazer os apontamentos?',
         'Não! Faça o apontamento logo que o desperdício acontecer, '
         'enquanto você ainda lembra dos detalhes.'),

        ('Meu nome não aparece na lista — o que faço?',
         'Avise a supervisão. O seu nome precisa ser cadastrado no sistema.'),

        ('O que é "quantidade em ml"?',
         'Alguns desperdícios como o Epóxi são medidos em mililitros (ml) '
         'em vez de peças. O próprio sistema vai pedir o tipo certo de medida.'),

        ('Posso fechar a OP?',
         'Somente a supervisão pode fechar ou cancelar uma OP. '
         'Essa ação precisa de senha especial.'),
    ]

    for i, (pergunta, resposta) in enumerate(faqs):
        cor_bg = AZUL_CLARO if i % 2 == 0 else CINZA_CLARO
        faq_data = [[
            Paragraph(f'❓  {pergunta}', S['corpo_bold']),
        ],[
            Paragraph(f'✔  {resposta}', S['corpo']),
        ]]
        faq_t = Table(faq_data, colWidths=[W])
        faq_t.setStyle(TableStyle([
            ('BACKGROUND',   (0,0), (-1,0), cor_bg),
            ('BACKGROUND',   (0,1), (-1,1), BRANCO),
            ('TOPPADDING',   (0,0), (-1,-1), 6),
            ('BOTTOMPADDING',(0,0), (-1,-1), 6),
            ('LEFTPADDING',  (0,0), (-1,-1), 10),
            ('LINEBELOW',    (0,1), (-1,1), 0.5, CINZA_BRD),
        ]))
        story.append(faq_t)
        story.append(Spacer(1, 4))

    story.append(PageBreak())

    # ── SEÇÃO 7: O que fazer se der errado ───────────────────────────────────
    story.append(numero_secao('7', 'O que fazer se der errado', S, W))
    story.append(Paragraph(
        'Não entre em pânico! Abaixo estão as situações mais comuns e o que fazer em cada uma.',
        S['corpo']))
    story.append(Spacer(1, 10))

    problemas = [
        ('🖥️  A tela ficou branca ou travou',
         [
             'Aguarde 10 segundos.',
             'Se não voltar: feche o navegador e abra novamente.',
             'Se ainda não funcionar: desligue e ligue o tablet novamente.',
             'Seus dados NÃO serão perdidos — tudo já está salvo na nuvem.',
         ],
         CINZA_CLARO, CINZA),

        ('📶  Apareceu "Sem conexão"',
         [
             'Verifique se o Wi-Fi do tablet está ligado.',
             'Peça para a supervisão verificar a rede.',
             'Não feche o aplicativo — aguarde a conexão voltar.',
         ],
         AMARELO_CL, AMARELO),

        ('🔑  Precisa finalizar a OP mas não tem senha',
         [
             'Somente supervisão e qualidade têm essa senha.',
             'Chame a pessoa responsável para finalizar.',
             'Você pode continuar fazendo apontamentos normalmente enquanto aguarda.',
         ],
         AZUL_CLARO, AZUL_MSB),

        ('❌  Apontei errado (número errado, nome errado)',
         [
             'Avise a supervisão imediatamente.',
             'Não tente corrigir por conta própria.',
             'A supervisão vai corrigir com a senha de acesso.',
         ],
         VERMELHO_CL, VERMELHO),

        ('🔋  O tablet desligou no meio do apontamento',
         [
             'Ligue o tablet novamente.',
             'Abra o site — a OP ainda estará aberta (os outros tablets mantêm os dados).',
             'Continue de onde parou.',
         ],
         LARANJA_CL, LARANJA),
    ]

    for titulo, itens, bg, border in problemas:
        items_texto = '  •  ' + '\n  •  '.join(itens)
        story.append(KeepTogether([
            CaixaInfo(titulo, items_texto, bg=bg, border=border, w=W),
            Spacer(1, 8),
        ]))

    story.append(Spacer(1, 10))

    # Contato de suporte
    suporte_data = [[
        Paragraph('📞  Contato de Suporte / Supervisão', S['h3']),
    ],[
        Paragraph('Nome: ___________________________________', S['corpo']),
    ],[
        Paragraph('Ramal / WhatsApp: _______________________', S['corpo']),
    ],[
        Paragraph('Horário de atendimento: _________________', S['corpo']),
    ]]
    sup_t = Table(suporte_data, colWidths=[W])
    sup_t.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), AZUL_MSB),
        ('TEXTCOLOR',    (0,0), (-1,0), BRANCO),
        ('BACKGROUND',   (0,1), (-1,-1), CINZA_CLARO),
        ('TOPPADDING',   (0,0), (-1,-1), 8),
        ('BOTTOMPADDING',(0,0), (-1,-1), 8),
        ('LEFTPADDING',  (0,0), (-1,-1), 10),
        ('BOX',          (0,0), (-1,-1), 1, AZUL_MSB),
        ('LINEBELOW',    (0,1), (-1,-2), 0.5, CINZA_BRD),
    ]))
    story.append(sup_t)

    # Rodapé final
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width=W, color=CINZA_BRD))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        'MSB · Medical System do Brasil  —  Sistema Kaizen Fibra  —  Versão 1.0  —  2026',
        S['rodape']))

    # Build PDF
    doc.build(story, onFirstPage=rodape_manual, onLaterPages=rodape_manual)
    print(f'✅  Manual gerado: {path}')
    return path


def numero_secao(num, titulo, S, W):
    data = [[
        Paragraph(f'<b>{num}</b>', ParagraphStyle('ns',
            fontSize=16, fontName='Helvetica-Bold',
            textColor=BRANCO, alignment=TA_CENTER)),
        Paragraph(titulo, ParagraphStyle('nt',
            fontSize=14, fontName='Helvetica-Bold',
            textColor=BRANCO, leading=18)),
    ]]
    t = Table(data, colWidths=[1.2*cm, W - 1.2*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (0,0), AZUL_MSB),
        ('BACKGROUND',   (1,0), (1,0), AZUL_MSB),
        ('TOPPADDING',   (0,0), (-1,-1), 9),
        ('BOTTOMPADDING',(0,0), (-1,-1), 9),
        ('LEFTPADDING',  (0,0), (0,0), 4),
        ('LEFTPADDING',  (1,0), (1,0), 10),
        ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [5]),
    ]))
    return t


def passos_visuais(passos, S, W):
    els = []
    for num, texto in passos:
        linhas = texto.split('\n')
        principal = linhas[0]
        complemento = '\n'.join(linhas[1:]) if len(linhas) > 1 else ''

        cel_num = Paragraph(f'<b>{num}</b>', ParagraphStyle('pn',
            fontSize=13, fontName='Helvetica-Bold',
            textColor=BRANCO, alignment=TA_CENTER, leading=16))
        cel_texto = Paragraph(principal, S['corpo_bold'])

        row1 = [[cel_num, cel_texto]]
        t = Table(row1, colWidths=[0.8*cm, W - 0.8*cm])
        t.setStyle(TableStyle([
            ('BACKGROUND',   (0,0), (0,0), AZUL_MSB),
            ('BACKGROUND',   (1,0), (1,0), CINZA_CLARO),
            ('TOPPADDING',   (0,0), (-1,-1), 7),
            ('BOTTOMPADDING',(0,0), (-1,-1), 7),
            ('LEFTPADDING',  (1,0), (1,0), 10),
            ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
        ]))
        els.append(t)

        if complemento:
            comp_data = [['', Paragraph(complemento, S['item'])]]
            ct = Table(comp_data, colWidths=[0.8*cm, W - 0.8*cm])
            ct.setStyle(TableStyle([
                ('BACKGROUND',   (0,0), (-1,-1), CINZA_CLARO),
                ('TOPPADDING',   (0,0), (-1,-1), 2),
                ('BOTTOMPADDING',(0,0), (-1,-1), 5),
                ('LEFTPADDING',  (1,0), (1,0), 10),
            ]))
            els.append(ct)

        els.append(Spacer(1, 4))
    return els


def rodape_manual(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.setFillColor(CINZA)
    canvas_obj.drawString(2.2*cm, 1.4*cm, 'MSB · Sistema Kaizen Fibra — Manual de Treinamento')
    canvas_obj.drawRightString(A4[0] - 2.2*cm, 1.4*cm, f'Página {doc.page}')
    canvas_obj.restoreState()


# ═══════════════════════════════════════════════════════════════════════════════
#  DOCUMENTO 2 — GUIA RÁPIDO DE BOLSO
# ═══════════════════════════════════════════════════════════════════════════════

def gerar_guia_rapido():
    path = os.path.join(OUT_DIR, 'Guia_Rapido_MSB_Fibra.pdf')
    doc  = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=1.8*cm, rightMargin=1.8*cm,
        topMargin=1.8*cm,  bottomMargin=1.8*cm,
        title='Guia Rápido — Sistema Kaizen Fibra',
        author='MSB — Medical System do Brasil',
    )

    S  = estilos()
    W  = A4[0] - 3.6*cm
    story = []

    # ── Cabeçalho colorido ────────────────────────────────────────────────────
    cabec_data = [[
        Paragraph('⚡  GUIA RÁPIDO', ParagraphStyle('gr_t',
            fontSize=20, fontName='Helvetica-Bold',
            textColor=BRANCO, alignment=TA_CENTER)),
        Paragraph('Apontamento de Desperdícios\nMSB · Kaizen Fibra', ParagraphStyle('gr_s',
            fontSize=10, fontName='Helvetica',
            textColor=BRANCO, alignment=TA_LEFT, leading=14)),
    ]]
    ch = Table(cabec_data, colWidths=[W*0.45, W*0.55])
    ch.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), AZUL_MSB),
        ('TOPPADDING',   (0,0), (-1,-1), 12),
        ('BOTTOMPADDING',(0,0), (-1,-1), 12),
        ('LEFTPADDING',  (0,0), (0,0), 10),
        ('LEFTPADDING',  (1,0), (1,0), 16),
        ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [6]),
    ]))
    story.append(ch)
    story.append(Spacer(1, 10))

    # ── Passos rápidos ────────────────────────────────────────────────────────
    title_passos = Table([[Paragraph('PASSO A PASSO — FAZER UM APONTAMENTO', ParagraphStyle('tp',
        fontSize=11, fontName='Helvetica-Bold', textColor=BRANCO, alignment=TA_CENTER))]],
        colWidths=[W])
    title_passos.setStyle(TableStyle([
        ('BACKGROUND', (0,0),(-1,-1), VERDE),
        ('TOPPADDING', (0,0),(-1,-1), 6),
        ('BOTTOMPADDING',(0,0),(-1,-1), 6),
    ]))
    story.append(title_passos)
    story.append(Spacer(1, 2))

    passos_rapidos = [
        ('1', '➕', 'Toque em "+ Novo Apontamento" na tela principal.'),
        ('2', '📂', 'Escolha o GRUPO do desperdício.'),
        ('3', '📋', 'Escolha o TIPO do desperdício.'),
        ('4', '👤', 'Selecione o seu NOME.'),
        ('5', '🔢', 'Informe a QUANTIDADE (peças ou ml).'),
        ('6', '🏷️', 'Classifique: PERDA ou RETRABALHO (se aparecer).'),
        ('7', '✅', 'Toque em "Confirmar". Pronto!'),
    ]

    for num, emoji, texto in passos_rapidos:
        row = [[
            Paragraph(f'<b>{num}</b>', ParagraphStyle('rn',
                fontSize=14, fontName='Helvetica-Bold',
                textColor=BRANCO, alignment=TA_CENTER)),
            Paragraph(emoji, ParagraphStyle('re',
                fontSize=14, alignment=TA_CENTER)),
            Paragraph(texto, ParagraphStyle('rt',
                fontSize=9.5, fontName='Helvetica',
                textColor=PRETO, leading=13)),
        ]]
        t = Table(row, colWidths=[0.7*cm, 0.9*cm, W - 1.6*cm])
        bg = AZUL_CLARO if int(num) % 2 == 0 else BRANCO
        t.setStyle(TableStyle([
            ('BACKGROUND',   (0,0), (0,0), AZUL_MSB),
            ('BACKGROUND',   (1,0), (2,0), bg),
            ('TOPPADDING',   (0,0), (-1,-1), 6),
            ('BOTTOMPADDING',(0,0), (-1,-1), 6),
            ('LEFTPADDING',  (2,0), (2,0), 8),
            ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
            ('LINEBELOW',    (0,0), (-1,0), 0.3, CINZA_BRD),
        ]))
        story.append(t)

    story.append(Spacer(1, 10))

    # ── Abrir OP ─────────────────────────────────────────────────────────────
    title_op = Table([[Paragraph('ABRIR ORDEM DE PRODUÇÃO (OP)', ParagraphStyle('top',
        fontSize=11, fontName='Helvetica-Bold', textColor=BRANCO, alignment=TA_CENTER))]],
        colWidths=[W])
    title_op.setStyle(TableStyle([
        ('BACKGROUND', (0,0),(-1,-1), LARANJA),
        ('TOPPADDING', (0,0),(-1,-1), 6),
        ('BOTTOMPADDING',(0,0),(-1,-1), 6),
    ]))
    story.append(title_op)
    story.append(Spacer(1, 2))

    op_passos = [
        'Toque em "Abrir Ordem de Produção".',
        'Digite o NÚMERO da OP (ex: OP26000369).',
        'Escolha o TIPO DE FIBRA: F272 ou F365.',
        'Informe o TAMANHO DA OP (total de peças).',
        'Toque em "Iniciar Apontamentos".',
    ]
    op_data = [[Paragraph(f'{'✅' if i%2==0 else '▶'}  {p}', ParagraphStyle('op',
        fontSize=9, fontName='Helvetica', leading=13))]
               for i, p in enumerate(op_passos)]
    op_t = Table(op_data, colWidths=[W])
    op_t.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0,0),(-1,-1), [LARANJA_CL, BRANCO]),
        ('TOPPADDING',    (0,0),(-1,-1), 5),
        ('BOTTOMPADDING', (0,0),(-1,-1), 5),
        ('LEFTPADDING',   (0,0),(-1,-1), 10),
        ('LINEBELOW',     (0,0),(-1,-2), 0.3, CINZA_BRD),
    ]))
    story.append(op_t)
    story.append(Spacer(1, 10))

    # ── Tabela grupos (compacta) ──────────────────────────────────────────────
    title_tab = Table([[Paragraph('GRUPOS E TIPOS DE DESPERDÍCIO', ParagraphStyle('ttab',
        fontSize=11, fontName='Helvetica-Bold', textColor=BRANCO, alignment=TA_CENTER))]],
        colWidths=[W])
    title_tab.setStyle(TableStyle([
        ('BACKGROUND', (0,0),(-1,-1), CINZA),
        ('TOPPADDING', (0,0),(-1,-1), 6),
        ('BOTTOMPADDING',(0,0),(-1,-1), 6),
    ]))
    story.append(title_tab)
    story.append(Spacer(1, 2))

    grupos_rapido = [
        ('GRUPO',            'TIPOS',                                    CINZA,       BRANCO),
        ('Epóxi',            'Entupimento do Ferrule  |  Qtd de Epóxi', AZUL_CLARO,  PRETO),
        ('Polimento',        'Manual  |  Máquina',                      VERDE_CLARO, PRETO),
        ('Prob. Dimensionais','Recuo de Fibra  |  Recartilhado SMA  |  Crimpagem', AMARELO_CL, PRETO),
        ('Clivagem',         'Clivagem com Defeito',                    LARANJA_CL,  PRETO),
    ]
    gd = []
    for grupo, tipos, bg, fg in grupos_rapido:
        gd.append([
            Paragraph(f'<b>{grupo}</b>', ParagraphStyle('gg',
                fontSize=9, fontName='Helvetica-Bold', textColor=fg)),
            Paragraph(tipos, ParagraphStyle('gt',
                fontSize=8.5, fontName='Helvetica', textColor=fg)),
        ])
    gt = Table(gd, colWidths=[W*0.28, W*0.72])
    gt.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), CINZA),
        ('TEXTCOLOR',    (0,0), (-1,0), BRANCO),
        ('BACKGROUND',   (0,1), (-1,1), AZUL_CLARO),
        ('BACKGROUND',   (0,2), (-1,2), VERDE_CLARO),
        ('BACKGROUND',   (0,3), (-1,3), AMARELO_CL),
        ('BACKGROUND',   (0,4), (-1,4), LARANJA_CL),
        ('TOPPADDING',   (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0), (-1,-1), 6),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('GRID',         (0,0), (-1,-1), 0.4, CINZA_BRD),
        ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(gt)
    story.append(Spacer(1, 10))

    # ── Cronômetro ────────────────────────────────────────────────────────────
    cron_data = [[
        Paragraph('⏱️  CRONÔMETRO DE RETRABALHO', ParagraphStyle('ct',
            fontSize=10, fontName='Helvetica-Bold', textColor=BRANCO, alignment=TA_CENTER)),
    ]]
    cron_t = Table(cron_data, colWidths=[W])
    cron_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0),(-1,-1), AZUL_MSB),
        ('TOPPADDING', (0,0),(-1,-1), 6),
        ('BOTTOMPADDING',(0,0),(-1,-1), 6),
    ]))
    story.append(cron_t)
    story.append(Spacer(1, 2))

    cron_steps = [
        ('▶ INICIAR',   'quando começar o retrabalho'),
        ('⏸ PAUSAR',    'para parar temporariamente'),
        ('▶ RETOMAR',   'para continuar após a pausa'),
        ('✔ CONCLUIR',  'ao terminar — salva automaticamente'),
    ]
    cron_s_data = [[
        Paragraph(f'<b>{b}</b>', ParagraphStyle('cb',
            fontSize=8.5, fontName='Helvetica-Bold', textColor=AZUL_MSB)),
        Paragraph(d, ParagraphStyle('cd',
            fontSize=8.5, fontName='Helvetica')),
    ] for b, d in cron_steps]
    cs_t = Table(cron_s_data, colWidths=[W*0.35, W*0.65])
    cs_t.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0,0),(-1,-1), [AZUL_CLARO, BRANCO]),
        ('TOPPADDING',    (0,0),(-1,-1), 5),
        ('BOTTOMPADDING', (0,0),(-1,-1), 5),
        ('LEFTPADDING',   (0,0),(-1,-1), 8),
        ('GRID',          (0,0),(-1,-1), 0.3, CINZA_BRD),
    ]))
    story.append(cs_t)
    story.append(Spacer(1, 10))

    # ── Emergências ───────────────────────────────────────────────────────────
    emerg_data = [[
        Paragraph('🆘  SE DER ERRADO', ParagraphStyle('et',
            fontSize=10, fontName='Helvetica-Bold', textColor=BRANCO, alignment=TA_CENTER)),
    ]]
    emerg_t = Table(emerg_data, colWidths=[W])
    emerg_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0),(-1,-1), VERMELHO),
        ('TOPPADDING', (0,0),(-1,-1), 6),
        ('BOTTOMPADDING',(0,0),(-1,-1), 6),
    ]))
    story.append(emerg_t)
    story.append(Spacer(1, 2))

    emergencias = [
        ('🖥️ Tela branca ou travada',    'Feche e reabra o navegador. Se persistir, reinicie o tablet.'),
        ('📶 Sem conexão',               'Verifique o Wi-Fi. Avise a supervisão se não resolver.'),
        ('❌ Apontou errado',            'Avise a supervisão imediatamente. Não tente corrigir sozinha.'),
        ('🔋 Tablet desligou',           'Ligue novamente — a OP continua aberta, não perde dados.'),
        ('🔑 Precisa fechar a OP',       'Chame a supervisão — ela tem a senha.'),
    ]
    em_data = [[
        Paragraph(f'<b>{prob}</b>', ParagraphStyle('ep',
            fontSize=8.5, fontName='Helvetica-Bold')),
        Paragraph(sol, ParagraphStyle('es',
            fontSize=8.5, fontName='Helvetica')),
    ] for prob, sol in emergencias]
    em_t = Table(em_data, colWidths=[W*0.32, W*0.68])
    em_t.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0,0),(-1,-1), [VERMELHO_CL, BRANCO]),
        ('TOPPADDING',    (0,0),(-1,-1), 5),
        ('BOTTOMPADDING', (0,0),(-1,-1), 5),
        ('LEFTPADDING',   (0,0),(-1,-1), 8),
        ('GRID',          (0,0),(-1,-1), 0.3, CINZA_BRD),
    ]))
    story.append(em_t)
    story.append(Spacer(1, 10))

    # ── Contato de suporte ────────────────────────────────────────────────────
    suporte_data = [[
        Paragraph('📞  SUPORTE / SUPERVISÃO', ParagraphStyle('st',
            fontSize=10, fontName='Helvetica-Bold', textColor=BRANCO, alignment=TA_CENTER)),
    ],[
        Paragraph(
            'Nome: _______________________________     '
            'Ramal/WhatsApp: ___________________\n\n'
            'Horário: ____________________________     '
            'E-mail: ____________________________',
            ParagraphStyle('sc', fontSize=9, fontName='Helvetica', leading=16)),
    ]]
    sp_t = Table(suporte_data, colWidths=[W])
    sp_t.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), AZUL_MSB),
        ('BACKGROUND',   (0,1), (-1,1), CINZA_CLARO),
        ('TOPPADDING',   (0,0), (-1,-1), 7),
        ('BOTTOMPADDING',(0,0), (-1,-1), 7),
        ('LEFTPADDING',  (0,0), (-1,-1), 10),
        ('BOX',          (0,0), (-1,-1), 1.5, AZUL_MSB),
    ]))
    story.append(sp_t)

    # Rodapé
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width=W, color=CINZA_BRD))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        'MSB · Medical System do Brasil  —  Sistema Kaizen Fibra  —  Versão 1.0  —  2026  '
        '|  Em caso de dúvidas, consulte o Manual Completo.',
        S['rodape']))

    doc.build(story)
    print(f'✅  Guia rápido gerado: {path}')
    return path


if __name__ == '__main__':
    gerar_manual()
    gerar_guia_rapido()
    print('\n🎉  Ambos os PDFs foram gerados com sucesso!')
