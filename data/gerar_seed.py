#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gerador do seed sintético do Copiloto do Assessor (PLAN §6).

Uso:
    python data/gerar_seed.py --data-referencia 2026-10-11 --saida backend/src/main/resources/seed

- Python 3.9+, só biblioteca padrão, random.seed(42) (determinístico).
- 6 clientes-âncora com valores exatos (§6.3) + 30 clientes de fundo (§6.4).
- Totais mensais exatos por categoria; só o "consumo" é repartido aleatoriamente em 8–15 transações.
- Datas de vencimento, expiração e aniversários relativas à data de referência.
- Dinheiro é tratado internamente em centavos (int) para garantir somas exatas.
"""
import argparse
import json
import os
import random
from datetime import date, timedelta

ASSESSOR = "ass-001"

INSTITUICOES = [
    # id, nome, conglomeradoId, conglomeradoNome, ehXp, sufixo
    ("inst-xp", "XP Investimentos", "cong-xp", "XP", True, "xp"),
    ("inst-aurora", "Banco Aurora", "cong-aurora", "Aurora", False, "aurora"),
    ("inst-aurora-fin", "Aurora Financeira", "cong-aurora", "Aurora", False, "aurora-fin"),
    ("inst-horizonte", "Banco Horizonte", "cong-horizonte", "Horizonte", False, "horizonte"),
    ("inst-ipe", "Banco Ipê", "cong-ipe", "Ipê", False, "ipe"),
]
SUFIXO = {i[0]: i[5] for i in INSTITUICOES}
CONG_INST = {i[0]: i[2] for i in INSTITUICOES}
# Nome usado na descrição "FATURA CARTAO <BANCO>"
NOME_CARTAO = {"inst-xp": "XP", "inst-aurora": "AURORA", "inst-horizonte": "HORIZONTE", "inst-ipe": "IPE"}

EMISSORES = [
    ("emi-xp", "XP Investimentos", "cong-xp", "BANCO"),
    ("emi-aurora", "Banco Aurora", "cong-aurora", "BANCO"),
    ("emi-aurora-fin", "Aurora Financeira", "cong-aurora", "BANCO"),
    ("emi-horizonte", "Banco Horizonte", "cong-horizonte", "BANCO"),
    ("emi-ipe", "Banco Ipê", "cong-ipe", "BANCO"),
    ("emi-tesouro", "Tesouro Nacional", "cong-tesouro", "TESOURO"),
    ("emi-agrosul", "Agro Sul Sementes S.A.", "cong-agrosul", "EMPRESA"),
]
CONG_EMI = {e[0]: e[2] for e in EMISSORES}
EMISSOR_DO_BANCO = {"inst-aurora": "emi-aurora", "inst-aurora-fin": "emi-aurora-fin",
                    "inst-horizonte": "emi-horizonte", "inst-ipe": "emi-ipe", "inst-xp": "emi-xp"}
NOME_BANCO = {"emi-xp": "XP", "emi-aurora": "Banco Aurora", "emi-aurora-fin": "Aurora Financeira",
              "emi-horizonte": "Banco Horizonte", "emi-ipe": "Banco Ipê"}

ESCOPO_DO_PRODUTO = {"CONTA": "CONTAS", "CARTAO": "CARTOES", "CREDITO": "CREDITO", "INVESTIMENTOS": "INVESTIMENTOS"}
ORDEM_ESCOPOS = ["CONTAS", "CARTOES", "CREDITO", "INVESTIMENTOS"]
CNPJ_XP = "00.900.000/0001-00"

LOJAS = ["SUPERMERCADO BOM PRECO", "PADARIA PAO DOURADO", "FARMACIA VIDA SAUDAVEL", "POSTO ESTRELA DO SUL",
         "RESTAURANTE SABOR CASEIRO", "HORTIFRUTI VERDE VALE", "LIVRARIA PAGINA NOVA", "PET SHOP AMIGO FIEL",
         "LOJA CASA E CONFORTO", "ACOUGUE BOI DE OURO", "CAFETERIA GRAO NOBRE", "MERCADO DA ESQUINA"]
NOMES_PIX = ["JOAO PEREIRA", "MARIA SOUZA", "CARLA MENDES", "RAFAEL DIAS", "LUCIANA FARIA", "PAULO RIBEIRO",
             "FERNANDA LOPES", "GUSTAVO MOURA"]


def cents(reais):
    return int(round(reais * 100))


def money(c):
    """Centavos -> número JSON em reais (int quando inteiro, senão no máximo 2 casas)."""
    return c // 100 if c % 100 == 0 else round(c / 100.0, 2)


def iso(d):
    return d.isoformat()


def aniversario_em(ref, dias, ano_nasc):
    alvo = ref + timedelta(days=dias)
    dia = alvo.day
    if alvo.month == 2 and dia == 29:
        dia = 28
    return date(ano_nasc, alvo.month, dia)


def proximo_aniversario(nasc, ref):
    for ano in (ref.year, ref.year + 1):
        dia = nasc.day
        if nasc.month == 2 and dia == 29:
            dia = 28
        d = date(ano, nasc.month, dia)
        if d >= ref:
            return d
    return None


class Seed(object):
    def __init__(self, ref):
        self.ref = ref
        self.meses = []
        base = ref.year * 12 + (ref.month - 1)
        for k in range(6, 0, -1):
            v = base - k
            self.meses.append((v // 12, v % 12 + 1))
        self.instituicoes = [dict(id=i[0], nome=i[1], conglomeradoId=i[2], conglomeradoNome=i[3], ehXp=i[4])
                             for i in INSTITUICOES]
        self.emissores = [dict(id=e[0], nome=e[1], conglomeradoId=e[2], tipo=e[3]) for e in EMISSORES]
        self.clientes, self.consentimentos, self.contas, self.transacoes = [], [], [], []
        self.faturas, self.creditos, self.investimentos = [], [], []
        self._tx = {}
        self._inv = {}
        self._docs = {}

    # ---------- utilitários ----------
    def doc_pagador(self, nome):
        if nome not in self._docs:
            n = len(self._docs) + 1
            self._docs[nome] = "00.%03d.%03d/0001-%02d" % (100 + n, n, n % 100)
        return self._docs[nome]

    @staticmethod
    def num(cid):
        return cid.split("-")[1]

    def d(self, ym, dia):
        return date(ym[0], ym[1], dia)

    # ---------- entidades ----------
    def cliente(self, cid, nome, idade, profissao, cidade, perfil, ancora, declaradas, dependentes=(), eventos=()):
        n = int(self.num(cid))
        cpf = "000.%03d.%03d-%02d" % (n // 1000, n % 1000, n % 100)
        self.clientes.append(dict(
            id=cid, nome=nome, cpf=cpf, idade=idade, profissao=profissao, cidade=cidade, perfil=perfil,
            assessorId=ASSESSOR, ancora=ancora,
            instituicoesDeclaradas=[dict(instituicaoId=i, produtos=list(p)) for i, p in declaradas],
            dependentes=[dict(nome=a, parentesco=b, dataNascimento=iso(c)) for a, b, c in dependentes],
            eventosVida=[dict(id="evt-%s-%02d" % (self.num(cid), k + 1), tipo=t, descricao=ds, data=iso(dt),
                              origem=o) for k, (t, ds, dt, o) in enumerate(eventos)],
        ))
        return cpf

    def consentimento(self, cid, inst, status, escopos=None, produtos=None, expira_dias=None):
        if escopos is None:
            escopos = [ESCOPO_DO_PRODUTO[p] for p in produtos]
        escopos = [e for e in ORDEM_ESCOPOS if e in escopos]
        c = dict(id="con-%s-%s" % (self.num(cid), SUFIXO[inst]), clienteId=cid, instituicaoId=inst,
                 tipo="INTERNO" if inst == "inst-xp" else "OPEN_FINANCE", status=status, escopos=escopos)
        if inst == "inst-xp":
            c["concedidoEm"] = iso(self.ref - timedelta(days=1000))
        elif status == "ATIVO":
            exp = self.ref + timedelta(days=expira_dias)
            c["concedidoEm"] = iso(exp - timedelta(days=365))
            c["expiraEm"] = iso(exp)
        self.consentimentos.append(c)

    def conta(self, cid, inst, saldo_reais=None, saldo_c=None):
        tipo = "PAGAMENTO" if inst == "inst-xp" else "CORRENTE"
        cta = "cta-%s-%s" % (self.num(cid), SUFIXO[inst])
        sc = saldo_c if saldo_c is not None else cents(saldo_reais)
        self.contas.append(dict(id=cta, clienteId=cid, instituicaoId=inst, tipo=tipo, saldo=money(sc)))
        return cta

    def tx(self, cta, dt, valor_c, tipo, modalidade, descricao, doc=None, nome=None):
        assert valor_c > 0
        self._tx.setdefault(cta, []).append((dt, valor_c, tipo, modalidade, descricao, doc, nome))

    def mensal(self, cta, dia, valor_reais, tipo, modalidade, descricao, doc=None, nome=None, valor_c=None):
        vc = valor_c if valor_c is not None else cents(valor_reais)
        for ym in self.meses:
            self.tx(cta, self.d(ym, dia), vc, tipo, modalidade, descricao, doc, nome)

    def renda(self, cta, dia, valor, descricao, pagador, modalidade="TED"):
        self.mensal(cta, dia, valor, "CREDITO", modalidade, descricao, self.doc_pagador(pagador), pagador)

    def conta_rec(self, cta, desc, valor, dia, modalidade="BOLETO"):
        self.mensal(cta, dia, valor, "DEBITO", modalidade, desc)

    def consumo(self, cta, total_reais=None, total_c=None):
        total = total_c if total_c is not None else cents(total_reais)
        for ym in self.meses:
            n = random.randint(8, 15)
            minimo = max(1, min(1000, total // (n * 4)))
            while True:
                cortes = sorted(random.sample(range(1, total), n - 1))
                partes = [b - a for a, b in zip([0] + cortes, cortes + [total])]
                if min(partes) >= minimo:
                    break
            dias = sorted(random.randint(1, 28) for _ in range(n))
            for dia, v in zip(dias, partes):
                if random.random() < 0.65:
                    self.tx(cta, self.d(ym, dia), v, "DEBITO", "CARTAO_DEBITO", "COMPRA DEBITO " + random.choice(LOJAS))
                else:
                    nm = random.choice(NOMES_PIX)
                    self.tx(cta, self.d(ym, dia), v, "DEBITO", "PIX", "PIX ENVIADO " + nm, None, nm)

    def pagar_fatura(self, cta, inst_cartao, valor, dia=12):
        self.mensal(cta, dia, valor, "DEBITO", "BOLETO", "FATURA CARTAO " + NOME_CARTAO[inst_cartao])

    def aplicacao_xp(self, cta, valor, dia=6):
        self.mensal(cta, dia, valor, "DEBITO", "TED", "APLICACAO XP", CNPJ_XP, "XP INVESTIMENTOS")

    def fatura(self, cid, inst, valor_reais=None, valor_c=None):
        vc = valor_c if valor_c is not None else cents(valor_reais)
        for ym in self.meses:
            mes = "%04d-%02d" % ym
            self.faturas.append(dict(id="fat-%s-%s-%s" % (self.num(cid), SUFIXO[inst], mes), clienteId=cid,
                                     instituicaoId=inst, mesReferencia=mes, valorTotal=money(vc)))

    def credito(self, cid, inst, tipo, saldo, parcela, taxa):
        self.creditos.append(dict(id="cre-%s-%s" % (self.num(cid), SUFIXO[inst]), clienteId=cid,
                                  instituicaoId=inst, tipo=tipo, saldoDevedor=money(cents(saldo)),
                                  parcelaMensal=money(cents(parcela)), taxaAnual=taxa))

    def inv(self, cid, inst, produto, nome, valor_atual, indexador, taxa=None, emissor=None, vencimento=None,
            liquidez=False, aplicado_em_dias=None, rend=None, valor_c=None):
        k = self._inv.get(cid, 0) + 1
        self._inv[cid] = k
        vc = valor_c if valor_c is not None else cents(valor_atual)
        if rend is None:
            rend = random.uniform(0.03, 0.14)
        aplicado = int(round(vc / (1.0 + rend)))
        if aplicado_em_dias is None:
            aplicado_em_dias = random.randint(120, 1100)
        p = dict(id="inv-%s-%02d" % (self.num(cid), k), clienteId=cid, instituicaoId=inst)
        if emissor:
            p["emissorId"] = emissor
        p.update(produto=produto, nome=nome, valorAplicado=money(aplicado), valorAtual=money(vc),
                 dataAplicacao=iso(self.ref - timedelta(days=aplicado_em_dias)))
        if vencimento:
            p["vencimento"] = iso(vencimento)
        p["indexador"] = indexador
        if taxa:
            p["taxa"] = taxa
        p["liquidezDiaria"] = liquidez
        self.investimentos.append(p)

    def finalizar_transacoes(self):
        for cta in sorted(self._tx):
            itens = sorted(self._tx[cta], key=lambda t: (t[0], t[2] != "CREDITO"))
            for k, (dt, vc, tipo, mod, desc, doc, nome) in enumerate(itens):
                t = dict(id="tx-%s-%04d" % (cta[4:], k + 1), contaId=cta, data=iso(dt), valor=money(vc),
                         tipo=tipo, modalidade=mod, descricao=desc)
                if doc:
                    t["contraparteDocumento"] = doc
                if nome:
                    t["contraparteNome"] = nome
                self.transacoes.append(t)

    def dados(self):
        """Arquivos do seed como dicts (nome do arquivo sem .json -> lista de objetos)."""
        return dict(instituicoes=self.instituicoes, emissores=self.emissores, clientes=self.clientes,
                    consentimentos=self.consentimentos, contas=self.contas, transacoes=self.transacoes,
                    faturas=self.faturas, creditos=self.creditos, investimentos=self.investimentos)

    def gravar(self, saida, verbose=True):
        os.makedirs(saida, exist_ok=True)
        for nome, dados in self.dados().items():
            with open(os.path.join(saida, nome + ".json"), "w", encoding="utf-8", newline="\n") as f:
                json.dump(dados, f, ensure_ascii=False, indent=2)
                f.write("\n")
            if verbose:
                print("  %-20s %5d registros" % (nome + ".json", len(dados)))


# =====================================================================
# Âncoras (§6.3)
# =====================================================================
def ancoras(s):
    ref = s.ref
    D = lambda n: ref + timedelta(days=n)  # noqa: E731
    selic_venc = date(ref.year + 3, 3, 1)
    ipca_venc = date(ref.year + 9, 5, 15)

    # ---- cli-001 Dra. Marina Costa ----
    c = "cli-001"
    s.cliente(c, "Dra. Marina Costa", 42, "Médica cardiologista", "Ribeirão Preto/SP", "ARROJADO", True,
              [("inst-xp", ["INVESTIMENTOS"]), ("inst-aurora", ["CONTA", "CARTAO", "CREDITO"]),
               ("inst-horizonte", ["INVESTIMENTOS"])],
              dependentes=[("Sofia", "FILHA", aniversario_em(ref, 5, 2014)),
                           ("Pedro", "FILHO", date(2017, 3, 2))])
    s.consentimento(c, "inst-xp", "ATIVO", escopos=ORDEM_ESCOPOS)
    s.consentimento(c, "inst-aurora", "ATIVO", produtos=["CONTA", "CARTAO", "CREDITO"], expira_dias=300)
    s.consentimento(c, "inst-horizonte", "PENDENTE", escopos=["INVESTIMENTOS"])
    a = s.conta(c, "inst-aurora", 85000)
    s.renda(a, 5, 38000, "SALARIO HOSPITAL SANTA CLARA", "HOSPITAL SANTA CLARA")
    s.conta_rec(a, "CONDOMINIO", 2800, 10)
    s.conta_rec(a, "ENERGIA", 450, 15, "DEBITO_AUTOMATICO")
    s.conta_rec(a, "INTERNET", 150, 20, "DEBITO_AUTOMATICO")
    s.conta_rec(a, "ESCOLA", 3200, 7)
    s.mensal(a, 15, 6500, "DEBITO", "DEBITO_AUTOMATICO", "PARCELA FINANCIAMENTO")
    s.consumo(a, 1900)
    s.pagar_fatura(a, "inst-aurora", 9000)
    s.aplicacao_xp(a, 5000)
    s.fatura(c, "inst-aurora", 9000)
    s.credito(c, "inst-aurora", "IMOBILIARIO", 620000, 6500, 0.105)
    s.inv(c, "inst-xp", "TESOURO", "Tesouro IPCA+ %d" % ipca_venc.year, 280000, "IPCA", "IPCA + 6,20% a.a.",
          "emi-tesouro", ipca_venc, False, 820, 0.12)
    s.inv(c, "inst-xp", "FUNDO", "Fundo Multimercado Alfa Macro FIM", 260000, "NA", None, None, None, False, 700, 0.09)
    s.inv(c, "inst-xp", "CDB", "CDB Banco Ipê %d" % (ref.year + 2), 160000, "CDI", "112% do CDI", "emi-ipe",
          date(ref.year + 2, 6, 15), False, 480, 0.15)
    s.inv(c, "inst-xp", "CDB", "CDB Liquidez Diária Banco Ipê", 70000, "CDI", "100% do CDI", "emi-ipe",
          D(730), True, 300, 0.07)
    s.inv(c, "inst-xp", "ACAO", "Carteira de ações", 130000, "NA", None, None, None, False, 900, 0.10)
    s.inv(c, "inst-horizonte", "CDB", "CDB Banco Horizonte %d" % (ref.year + 2), 650000, "CDI", "118% do CDI",
          "emi-horizonte", D(640), False, 400, 0.11)

    # ---- cli-002 Carlos Andrade ----
    c = "cli-002"
    s.cliente(c, "Carlos Andrade", 61, "Empresário (embalagens)", "Campinas/SP", "CONSERVADOR", True,
              [("inst-xp", ["CONTA", "CARTAO", "INVESTIMENTOS"]), ("inst-aurora", ["CONTA"])])
    s.consentimento(c, "inst-xp", "ATIVO", escopos=ORDEM_ESCOPOS)
    s.consentimento(c, "inst-aurora", "ATIVO", produtos=["CONTA"], expira_dias=10)
    x = s.conta(c, "inst-xp", 18000)
    s.renda(x, 1, 25000, "PRO LABORE ANDRADE EMBALAGENS", "ANDRADE EMBALAGENS LTDA")
    s.conta_rec(x, "CONDOMINIO", 1900, 10)
    s.conta_rec(x, "ENERGIA", 600, 15, "DEBITO_AUTOMATICO")
    s.conta_rec(x, "PLANO DE SAUDE", 2400, 8)
    s.consumo(x, 2500)
    s.pagar_fatura(x, "inst-xp", 5000)
    s.fatura(c, "inst-xp", 5000)
    a = s.conta(c, "inst-aurora", 3000)
    s.conta_rec(a, "AGUA", 200, 15, "DEBITO_AUTOMATICO")
    s.consumo(a, 1000)
    s.inv(c, "inst-xp", "CDB", "CDB Banco Ipê %d" % D(20).year, 240000, "PRE", "13,10% a.a.", "emi-ipe",
          D(20), False, 1075, 0.36)
    s.inv(c, "inst-xp", "LCA", "LCA Banco Aurora", 200000, "CDI", "94% do CDI", "emi-aurora", D(410), False, 320, 0.08)
    s.inv(c, "inst-xp", "TESOURO", "Tesouro Selic %d" % selic_venc.year, 800000, "SELIC", "SELIC + 0,06% a.a.",
          "emi-tesouro", selic_venc, True, 900, 0.20)
    s.inv(c, "inst-xp", "FUNDO", "Fundo Renda Fixa Beta FI", 400000, "NA", None, None, None, False, 600, 0.13)

    # ---- cli-003 Juliana Prado ----
    c = "cli-003"
    s.cliente(c, "Juliana Prado", 29, "Engenheira de software", "São José dos Campos/SP", "MODERADO", True,
              [("inst-xp", ["INVESTIMENTOS"]), ("inst-ipe", ["CONTA"]), ("inst-aurora", ["CARTAO"])])
    s.consentimento(c, "inst-xp", "ATIVO", escopos=ORDEM_ESCOPOS)
    s.consentimento(c, "inst-ipe", "ATIVO", produtos=["CONTA"], expira_dias=200)
    s.consentimento(c, "inst-aurora", "PENDENTE", escopos=["CARTOES"])
    i = s.conta(c, "inst-ipe", 22000)
    s.renda(i, 5, 14000, "SALARIO TECHVALE SISTEMAS", "TECHVALE SISTEMAS LTDA")
    s.conta_rec(i, "ALUGUEL", 2900, 10)
    s.conta_rec(i, "ENERGIA", 180, 15, "DEBITO_AUTOMATICO")
    s.conta_rec(i, "INTERNET", 120, 20, "DEBITO_AUTOMATICO")
    s.conta_rec(i, "ACADEMIA", 150, 3, "DEBITO_AUTOMATICO")
    s.consumo(i, 2650)
    s.pagar_fatura(i, "inst-aurora", 3000)
    s.aplicacao_xp(i, 1000)
    s.fatura(c, "inst-aurora", 3000)
    s.inv(c, "inst-xp", "CDB", "CDB Liquidez Diária Banco Ipê", 5000, "CDI", "100% do CDI", "emi-ipe",
          D(730), True, 150, 0.04)
    s.inv(c, "inst-xp", "FUNDO", "Fundo Multimercado Alfa Macro FIM", 35000, "NA", None, None, None, False, 400, 0.08)
    s.inv(c, "inst-xp", "TESOURO", "Tesouro IPCA+ %d" % ipca_venc.year, 20000, "IPCA", "IPCA + 6,40% a.a.",
          "emi-tesouro", ipca_venc, False, 500, 0.09)

    # ---- cli-004 Patrícia Gomes ----
    c = "cli-004"
    s.cliente(c, "Patrícia Gomes", 68, "Professora aposentada", "Bauru/SP", "CONSERVADOR", True,
              [("inst-xp", ["INVESTIMENTOS"]), ("inst-aurora", ["CONTA", "INVESTIMENTOS"]),
               ("inst-aurora-fin", ["INVESTIMENTOS"])])
    s.consentimento(c, "inst-xp", "ATIVO", escopos=ORDEM_ESCOPOS)
    s.consentimento(c, "inst-aurora", "ATIVO", produtos=["CONTA", "INVESTIMENTOS"], expira_dias=250)
    s.consentimento(c, "inst-aurora-fin", "ATIVO", produtos=["INVESTIMENTOS"], expira_dias=280)
    a = s.conta(c, "inst-aurora", 6000)
    s.renda(a, 25, 8500, "INSS BENEFICIO", "INSS", modalidade="OUTRO")
    s.conta_rec(a, "ENERGIA", 220, 15, "DEBITO_AUTOMATICO")
    s.conta_rec(a, "AGUA", 90, 15, "DEBITO_AUTOMATICO")
    s.conta_rec(a, "TELEFONE", 110, 20, "DEBITO_AUTOMATICO")
    s.conta_rec(a, "PLANO DE SAUDE", 1800, 8)
    s.consumo(a, 1780)
    s.inv(c, "inst-aurora", "POUPANCA", "Poupança Banco Aurora", 150000, "NA", "Regra da poupança",
          "emi-aurora", None, True, 1500, 0.18)
    s.inv(c, "inst-aurora-fin", "LCI", "LCI Aurora Financeira", 174000, "CDI", "92% do CDI", "emi-aurora-fin",
          D(300), False, 430, 0.10)
    s.inv(c, "inst-xp", "TESOURO", "Tesouro Selic %d" % selic_venc.year, 400000, "SELIC", "SELIC + 0,06% a.a.",
          "emi-tesouro", selic_venc, True, 800, 0.19)

    # ---- cli-005 Roberto Lima ----
    c = "cli-005"
    s.cliente(c, "Roberto Lima", 50, "Produtor rural", "Sertãozinho/SP", "MODERADO", True,
              [("inst-xp", ["INVESTIMENTOS"]), ("inst-ipe", ["CONTA", "CARTAO", "CREDITO"])],
              dependentes=[("Ana", "FILHA", date(2002, 12, 1))],
              eventos=[("CASAMENTO", "Casamento da Ana", date(2027, 3, 20), "CADASTRO")])
    s.consentimento(c, "inst-xp", "ATIVO", escopos=ORDEM_ESCOPOS)
    s.consentimento(c, "inst-ipe", "ATIVO", produtos=["CONTA", "CARTAO", "CREDITO"], expira_dias=330)
    i = s.conta(c, "inst-ipe", 25000)
    s.renda(i, 10, 20000, "PRO LABORE FAZENDA BOA VISTA", "FAZENDA BOA VISTA AGROPECUARIA LTDA")
    s.conta_rec(i, "ENERGIA", 900, 15, "DEBITO_AUTOMATICO")
    s.conta_rec(i, "PLANO DE SAUDE", 2000, 8)
    s.conta_rec(i, "ESCOLA", 2500, 7)
    s.consumo(i, 4600)
    s.pagar_fatura(i, "inst-ipe", 5000)
    s.mensal(i, 15, 4000, "DEBITO", "DEBITO_AUTOMATICO", "PARCELA FINANCIAMENTO")
    s.fatura(c, "inst-ipe", 5000)
    s.credito(c, "inst-ipe", "RURAL", 350000, 4000, 0.085)
    s.inv(c, "inst-xp", "CRA", "CRA Agro Sul Sementes %d" % (ref.year + 3), 900000, "IPCA", "IPCA + 7,20% a.a.",
          "emi-agrosul", D(1100), False, 520, 0.11)
    s.inv(c, "inst-xp", "TESOURO", "Tesouro Selic %d" % selic_venc.year, 600000, "SELIC", "SELIC + 0,06% a.a.",
          "emi-tesouro", selic_venc, True, 700, 0.17)
    s.inv(c, "inst-xp", "FUNDO", "Fundo Multimercado Alfa Macro FIM", 300000, "NA", None, None, None, False, 650, 0.07)
    s.inv(c, "inst-xp", "LCA", "LCA Banco Horizonte", 200000, "CDI", "95% do CDI", "emi-horizonte",
          D(500), False, 380, 0.09)

    # ---- cli-006 Lucas Ferreira ----
    c = "cli-006"
    s.cliente(c, "Lucas Ferreira", 35, "Dentista, dono de clínica", "Piracicaba/SP", "AGRESSIVO", True,
              [("inst-xp", ["CONTA", "CARTAO", "INVESTIMENTOS"])],
              eventos=[("OUTRO", "Abertura da 2ª clínica", date(2027, 1, 15), "NOTA_REUNIAO")])
    s.consentimento(c, "inst-xp", "ATIVO", escopos=ORDEM_ESCOPOS)
    x = s.conta(c, "inst-xp", 12000)
    s.renda(x, 5, 22000, "PRO LABORE CLINICA SORRISO PLENO", "CLINICA SORRISO PLENO LTDA")
    s.conta_rec(x, "CONDOMINIO", 1500, 10)
    s.conta_rec(x, "ENERGIA", 300, 15, "DEBITO_AUTOMATICO")
    s.conta_rec(x, "INTERNET", 150, 20, "DEBITO_AUTOMATICO")
    s.conta_rec(x, "PLANO DE SAUDE", 1050, 8)
    s.consumo(x, 3500)
    s.pagar_fatura(x, "inst-xp", 6000)
    s.fatura(c, "inst-xp", 6000)
    s.inv(c, "inst-xp", "ACAO", "Carteira de ações", 300000, "NA", None, None, None, False, 750, 0.14)
    s.inv(c, "inst-xp", "FUNDO", "Fundo Multimercado Alfa Macro FIM", 200000, "NA", None, None, None, False, 500, 0.08)
    s.inv(c, "inst-xp", "TESOURO", "Tesouro Selic %d" % selic_venc.year, 100000, "SELIC", "SELIC + 0,06% a.a.",
          "emi-tesouro", selic_venc, True, 350, 0.08)


# =====================================================================
# Clientes de fundo (§6.4)
# =====================================================================
NOMES_FUNDO = [
    ("Ana Beatriz Rocha", "F"), ("Bruno Carvalho", "M"), ("Camila Teixeira", "F"), ("Diego Martins", "M"),
    ("Eduarda Nunes", "F"), ("Felipe Araújo", "M"), ("Gabriela Moreira", "F"), ("Henrique Batista", "M"),
    ("Isabela Cardoso", "F"), ("João Vitor Almeida", "M"), ("Larissa Barbosa", "F"), ("Marcelo Pinto", "M"),
    ("Natália Correia", "F"), ("Otávio Ramos", "M"), ("Priscila Vieira", "F"), ("Renato Monteiro", "M"),
    ("Sabrina Duarte", "F"), ("Thiago Fonseca", "M"), ("Vanessa Campos", "F"), ("William Castro", "M"),
    ("Yasmin Freitas", "F"), ("André Sampaio", "M"), ("Bianca Machado", "F"), ("Caio Rezende", "M"),
    ("Daniela Siqueira", "F"), ("Eduardo Brandão", "M"), ("Fabiana Queiroz", "F"), ("Gustavo Peixoto", "M"),
    ("Helena Assunção", "F"), ("Igor Tavares", "M"),
]
PROFISSOES = ["Advogado(a)", "Arquiteto(a)", "Analista financeiro(a)", "Engenheiro(a) civil", "Professor(a)",
              "Gerente comercial", "Designer", "Farmacêutico(a)", "Contador(a)", "Empresário(a) (varejo)",
              "Psicólogo(a)", "Fisioterapeuta", "Servidor(a) público(a)", "Consultor(a) de TI", "Veterinário(a)"]
CIDADES = ["São Paulo/SP", "Campinas/SP", "Santos/SP", "Ribeirão Preto/SP", "Sorocaba/SP", "Belo Horizonte/MG",
           "Curitiba/PR", "Florianópolis/SC", "Porto Alegre/RS", "Rio de Janeiro/RJ", "Goiânia/GO", "Uberlândia/MG"]
EMPRESAS = ["NOVA ERA LOGISTICA", "GRUPO SOLARIS", "CONSTRUTORA PEDRA FORTE", "LABORATORIO VITALIS",
            "ESCRITORIO MOURA E ASSOCIADOS", "TECNOVA SOFTWARE", "REDE BEM ESTAR", "METALURGICA ACO VIVO",
            "COLEGIO HORIZONTE DO SABER", "PREFEITURA DE VILA SERENA", "AGENCIA CRIATIVA LUME",
            "CLINICA PRIMAVERA", "DISTRIBUIDORA SAO BENTO", "CONSULTORIA PRISMA"]
DEP_NOMES = {"FILHA": ["Laura", "Alice", "Manuela", "Valentina", "Beatriz", "Clara"],
             "FILHO": ["Miguel", "Arthur", "Heitor", "Davi", "Bernardo", "Theo"]}

XP_PRINCIPAL = {2, 7, 12, 17, 22, 27}   # 6/30 = 20% com renda na conta XP
SECUNDARIA = {4, 14, 24}                # XP com conta de pagamento usada, mas sem renda
FGC_TETO_FUNDO = cents(230000)           # margem abaixo de 250 mil por conglomerado
ELEGIVEL_TOTAL_MAX = cents(900000)       # margem abaixo do teto global de 1 milhão


def r(v, passo):
    return int(round(v / float(passo))) * passo


def fundo(s):
    ref = s.ref
    D = lambda n: ref + timedelta(days=n)  # noqa: E731
    bancos = ["inst-aurora", "inst-horizonte", "inst-ipe"]
    for k in range(30):
        cid = "cli-%03d" % (101 + k)
        nome, _sexo = NOMES_FUNDO[k]
        tipo = "XP" if k in XP_PRINCIPAL else ("SEC" if k in SECUNDARIA else "BANCO")
        idade = random.randint(27, 70)
        perfil = random.choice(["CONSERVADOR", "MODERADO", "MODERADO", "ARROJADO", "AGRESSIVO"])
        renda = random.randrange(7000, 40001, 500)

        # fonte de renda
        if idade >= 63 and random.random() < 0.6:
            desc_renda, pagador, dia_renda, mod_renda = "INSS BENEFICIO", "INSS", 25, "OUTRO"
        else:
            emp = random.choice(EMPRESAS)
            if random.random() < 0.35:
                desc_renda, pagador = "PRO LABORE " + emp, emp + " LTDA"
            else:
                desc_renda, pagador = "SALARIO " + emp, emp + " LTDA"
            dia_renda, mod_renda = random.choice([1, 5, 5, 6, 10, 20]), "TED"

        # custo de vida composto (centavos), alvo 45–75% da renda
        alvo = renda * random.uniform(0.45, 0.75)
        contas = [(random.choice(["ALUGUEL", "CONDOMINIO"]), r(alvo * random.uniform(0.15, 0.25), 10), 10, "BOLETO"),
                  ("ENERGIA", max(80, r(alvo * random.uniform(0.02, 0.05), 10)), 15, "DEBITO_AUTOMATICO"),
                  ("INTERNET", random.choice([100, 120, 150, 180, 200]), 20, "DEBITO_AUTOMATICO")]
        if random.random() < 0.5:
            contas.append(("AGUA", random.choice([70, 90, 120, 150]), 15, "DEBITO_AUTOMATICO"))
        if random.random() < 0.3:
            contas.append(("TELEFONE", random.choice([60, 90, 110]), 20, "DEBITO_AUTOMATICO"))
        if random.random() < 0.5:
            contas.append(("PLANO DE SAUDE", r(alvo * random.uniform(0.07, 0.13), 10), 8, "BOLETO"))
        if idade < 55 and random.random() < 0.35:
            contas.append(("ESCOLA", r(alvo * random.uniform(0.10, 0.16), 10), 7, "BOLETO"))
        if random.random() < 0.4:
            contas.append(("ACADEMIA", random.choice([99, 129, 150, 199, 250]), 3, "DEBITO_AUTOMATICO"))
        tem_cartao = random.random() < 0.65
        fatura = r(alvo * random.uniform(0.15, 0.28), 50) if tem_cartao else 0
        tem_credito = tipo != "XP" and random.random() < 0.3
        parcela = r(alvo * random.uniform(0.08, 0.14), 10) if tem_credito else 0
        soma = sum(c[1] for c in contas) + fatura + parcela
        consumo = max(r(alvo - soma, 10), r(alvo * 0.12, 10), 400)
        custo = soma + consumo
        custo_c = cents(custo)
        saldo_total_c = cents(r(custo * random.uniform(0.30, 0.95), 100))

        banco = random.choice(bancos)

        declaradas = []
        consent = []  # (inst, status, produtos/escopos, dias)
        fgc = {}
        elegivel = [0]

        def fgc_add(cong, vc):
            fgc[cong] = fgc.get(cong, 0) + vc
            elegivel[0] += vc

        def fgc_cabe(cong, vc):
            return fgc.get(cong, 0) + vc <= FGC_TETO_FUNDO and elegivel[0] + vc <= ELEGIVEL_TOTAL_MAX

        # dependentes e eventos
        deps = []
        if 30 <= idade <= 60 and random.random() < 0.5:
            for _ in range(random.randint(1, 2)):
                par = random.choice(["FILHA", "FILHO"])
                while True:
                    ano = random.randint(max(1990, ref.year - idade + 22), ref.year - 1)
                    nasc = date(ano, random.randint(1, 12), random.randint(1, 28))
                    prox = proximo_aniversario(nasc, ref)
                    if (prox - ref).days >= 15 and nasc < ref:
                        break
                deps.append((random.choice(DEP_NOMES[par]), par, nasc))
        eventos = []
        if random.random() < 0.3:
            t, ds = random.choice([("FERIAS", "Viagem de férias em família"), ("MUDANCA", "Mudança de apartamento"),
                                   ("APOSENTADORIA", "Planejamento de aposentadoria"),
                                   ("CASAMENTO", "Casamento planejado")])
            eventos.append((t, ds, D(random.randint(40, 300)), random.choice(["CADASTRO", "NOTA_REUNIAO"])))

        s.cliente(cid, nome, idade, random.choice(PROFISSOES), random.choice(CIDADES), perfil, False, [], deps,
                  eventos)
        cli = s.clientes[-1]
        cpf = cli["cpf"]

        # ---------- contas e transações ----------
        if tipo == "XP":
            x = s.conta(cid, "inst-xp", saldo_c=saldo_total_c)
            s.renda(x, dia_renda, renda, desc_renda, pagador, mod_renda)
            for desc, v, dia, mod in contas:
                s.conta_rec(x, desc, v, dia, mod)
            s.consumo(x, consumo)
            if tem_cartao:
                s.pagar_fatura(x, "inst-xp", fatura)
                s.fatura(cid, "inst-xp", fatura)
            xp_prod = ["CONTA"] + (["CARTAO"] if tem_cartao else []) + ["INVESTIMENTOS"]
            declaradas.append(("inst-xp", xp_prod))
        else:
            if tipo == "SEC":
                saldo_xp_c = cents(r(saldo_total_c / 100.0 * random.uniform(0.2, 0.4), 100))
                saldo_banco_c = saldo_total_c - saldo_xp_c
            else:
                saldo_banco_c = saldo_total_c
            fgc_add(CONG_INST[banco], saldo_banco_c)
            b = s.conta(cid, banco, saldo_c=saldo_banco_c)
            s.renda(b, dia_renda, renda, desc_renda, pagador, mod_renda)
            for desc, v, dia, mod in contas:
                s.conta_rec(b, desc, v, dia, mod)
            prods = ["CONTA"]
            if tem_cartao:
                s.pagar_fatura(b, banco, fatura)
                s.fatura(cid, banco, fatura)
                prods.append("CARTAO")
            if tem_credito:
                s.mensal(b, 15, parcela, "DEBITO", "DEBITO_AUTOMATICO", "PARCELA FINANCIAMENTO")
                tcred = random.choice(["VEICULO", "PESSOAL", "IMOBILIARIO", "CONSIGNADO"])
                meses_rest = {"VEICULO": 36, "PESSOAL": 24, "IMOBILIARIO": 180, "CONSIGNADO": 48}[tcred]
                taxa = {"VEICULO": 0.165, "PESSOAL": 0.29, "IMOBILIARIO": 0.108, "CONSIGNADO": 0.21}[tcred]
                s.credito(cid, banco, tcred, r(parcela * meses_rest * random.uniform(0.6, 0.9), 100), parcela, taxa)
                prods.append("CREDITO")
            sobra = renda - custo
            if tipo == "SEC":
                consumo_xp = r(consumo * random.uniform(0.3, 0.5), 10)
                s.consumo(b, consumo - consumo_xp)
                x = s.conta(cid, "inst-xp", saldo_c=saldo_xp_c)
                nome_up = nome.upper()
                s.mensal(b, 6, consumo_xp, "DEBITO", "PIX", "PIX ENVIADO " + nome_up, cpf, nome_up)
                s.mensal(x, 6, consumo_xp, "CREDITO", "PIX", "PIX RECEBIDO " + nome_up, cpf, nome_up)
                s.consumo(x, consumo_xp)
                declaradas.append(("inst-xp", ["CONTA", "INVESTIMENTOS"]))
            else:
                s.consumo(b, consumo)
                declaradas.append(("inst-xp", ["INVESTIMENTOS"]))
            if sobra > 2500 and random.random() < 0.6:
                s.aplicacao_xp(b, r(sobra * random.uniform(0.2, 0.5), 100))
            declaradas.append((banco, prods))
            consent.append((banco, "ATIVO", prods, random.randint(60, 360)))

        # ---------- investimentos ----------
        riqueza = renda / 15000.0
        # liquidez garantida: Tesouro Selic na XP ≥ 6,5× custo − saldos (e uma folga)
        selic = r(max(0, 6.5 * custo - saldo_total_c / 100.0) + custo * random.uniform(0.5, 4.0), 1000)
        selic = max(selic, 20000)
        selic_venc = date(ref.year + random.choice([2, 3, 4]), 3, 1)
        s.inv(cid, "inst-xp", "TESOURO", "Tesouro Selic %d" % selic_venc.year, selic, "SELIC",
              "SELIC + 0,06% a.a.", "emi-tesouro", selic_venc, True)
        total_inv = selic
        if random.random() < 0.4:
            emi = random.choice(["emi-ipe", "emi-horizonte", "emi-aurora", "emi-xp"])
            v = r(random.uniform(10000, 80000), 1000)
            if fgc_cabe(CONG_EMI[emi], cents(v)):
                fgc_add(CONG_EMI[emi], cents(v))
                s.inv(cid, "inst-xp", "CDB", "CDB Liquidez Diária " + NOME_BANCO[emi], v, "CDI", "100% do CDI",
                      emi, D(random.randint(400, 1100)), True)
                total_inv += v
        if random.random() < 0.7:
            v = r(random.uniform(20000, 250000) * riqueza, 1000)
            s.inv(cid, "inst-xp", "FUNDO", random.choice(["Fundo Multimercado Alfa Macro FIM",
                                                         "Fundo Renda Fixa Beta FI", "Fundo Crédito Privado Gama FIC"]),
                  v, "NA")
            total_inv += v
        p_acao = {"CONSERVADOR": 0.1, "MODERADO": 0.5, "ARROJADO": 0.9, "AGRESSIVO": 0.95}[perfil]
        if random.random() < p_acao:
            v = r(random.uniform(10000, 200000) * riqueza, 1000)
            s.inv(cid, "inst-xp", "ACAO", "Carteira de ações", v, "NA")
            total_inv += v
        if random.random() < 0.5:
            v = r(random.uniform(20000, 200000) * riqueza, 1000)
            ano = ref.year + random.choice([3, 6, 9])
            s.inv(cid, "inst-xp", "TESOURO", "Tesouro IPCA+ %d" % ano, v, "IPCA", "IPCA + 6,10% a.a.",
                  "emi-tesouro", date(ano, 5, 15))
            total_inv += v
        if random.random() < 0.2:
            v = r(random.uniform(15000, 120000) * riqueza, 1000)
            s.inv(cid, "inst-xp", "PREVIDENCIA", "Previdência PGBL Renda Fixa", v, "NA")
            total_inv += v
        if random.random() < 0.6:
            prod = random.choice(["CDB", "LCA", "LCI"])
            emi = random.choice(["emi-ipe", "emi-horizonte", "emi-aurora", "emi-aurora-fin"])
            v = r(random.uniform(20000, 180000) * min(riqueza, 1.5), 1000)
            if fgc_cabe(CONG_EMI[emi], cents(v)):
                fgc_add(CONG_EMI[emi], cents(v))
                taxa = {"CDB": "108% do CDI", "LCA": "93% do CDI", "LCI": "91% do CDI"}[prod]
                s.inv(cid, "inst-xp", prod, "%s %s" % (prod, NOME_BANCO[emi]), v, "CDI", taxa, emi,
                      D(random.randint(120, 1500)))
                total_inv += v
        # instituição extra (só investimentos), ATIVA ou PENDENTE
        if tipo != "XP" and random.random() < 0.45 or tipo == "XP" and random.random() < 0.5:
            extra = random.choice([b_ for b_ in bancos + ["inst-aurora-fin"]
                                   if b_ != banco and CONG_INST[b_] != CONG_INST[banco] or tipo == "XP"])
            emi = EMISSOR_DO_BANCO[extra]
            prod = "LCI" if extra == "inst-aurora-fin" else random.choice(["CDB", "CDB", "LCA"])
            v = r(random.uniform(30000, 150000), 1000)
            if fgc_cabe(CONG_EMI[emi], cents(v)):
                fgc_add(CONG_EMI[emi], cents(v))
                s.inv(cid, extra, prod, "%s %s" % (prod, NOME_BANCO[emi]), v, "CDI", "105% do CDI", emi,
                      D(random.randint(150, 1500)))
                declaradas.append((extra, ["INVESTIMENTOS"]))
                status = "ATIVO" if random.random() < 0.7 else "PENDENTE"
                consent.append((extra, status, ["INVESTIMENTOS"], random.randint(60, 360)))
                total_inv += v
        # CRA pequeno (≤ 8% do patrimônio) para variedade, sem disparar concentração
        if perfil in ("MODERADO", "ARROJADO") and random.random() < 0.2:
            v = r((total_inv + saldo_total_c / 100.0) * random.uniform(0.03, 0.08), 1000)
            if v >= 5000:
                s.inv(cid, "inst-xp", "CRA", "CRA Agro Sul Sementes %d" % (ref.year + 4), v, "IPCA",
                      "IPCA + 7,00% a.a.", "emi-agrosul", D(random.randint(900, 1500)))

        # declaradas e consentimentos (XP primeiro)
        cli["instituicoesDeclaradas"] = [dict(instituicaoId=i, produtos=p)
                                         for i, p in sorted(declaradas, key=lambda d_: d_[0] != "inst-xp")]
        s.consentimento(cid, "inst-xp", "ATIVO", escopos=ORDEM_ESCOPOS)
        for inst, status, prods, dias in consent:
            if status == "ATIVO":
                s.consentimento(cid, inst, "ATIVO", produtos=prods, expira_dias=dias)
            else:
                s.consentimento(cid, inst, "PENDENTE", produtos=prods)



def gerar(ref):
    """Gera o seed completo em memória para a data de referência (determinístico: random.seed(42))."""
    random.seed(42)
    s = Seed(ref)
    ancoras(s)
    fundo(s)
    s.finalizar_transacoes()
    return s


def main():
    ap = argparse.ArgumentParser(description="Gera o seed sintético do Copiloto do Assessor.")
    ap.add_argument("--data-referencia", default="2026-10-11")
    ap.add_argument("--saida", default="backend/src/main/resources/seed")
    args = ap.parse_args()
    ref = date.fromisoformat(args.data_referencia)
    s = gerar(ref)
    print("Seed (ref %s, meses %s..%s) -> %s" % (ref, "%04d-%02d" % s.meses[0], "%04d-%02d" % s.meses[-1], args.saida))
    s.gravar(args.saida)


if __name__ == "__main__":
    main()
