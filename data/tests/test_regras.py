# -*- coding: utf-8 -*-
"""Testes unitários das regras de referência do checar_seed.py (PLAN §7.1–7.7, §7.9, §7.10)."""
import copy
import unittest
from datetime import timedelta
from decimal import Decimal

from _util import REF, dados_vazios, checar_seed

CPF = "000.000.900-00"
MESES = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]
ULT3 = MESES[3:]


class Mundo(object):
    """Cliente sintético cli-900 montado peça a peça para cada teste."""

    def __init__(self, declaradas=None, dependentes=(), eventos=()):
        self.d = copy.deepcopy(dados_vazios())
        self.n = 0
        decl = declaradas or [("inst-xp", ["INVESTIMENTOS"])]
        self.d["clientes"].append(dict(
            id="cli-900", nome="Teste", cpf=CPF, idade=40, profissao="x", cidade="x", perfil="MODERADO",
            assessorId="ass-001", ancora=False,
            instituicoesDeclaradas=[dict(instituicaoId=i, produtos=p) for i, p in decl],
            dependentes=[dict(nome=a, parentesco="FILHA", dataNascimento=b) for a, b in dependentes],
            eventosVida=[dict(id="evt-%d" % k, tipo="OUTRO", descricao="e", data=dt, origem="CADASTRO")
                         for k, dt in enumerate(eventos)]))
        self.consent("inst-xp", escopos=["CONTAS", "CARTOES", "CREDITO", "INVESTIMENTOS"], tipo="INTERNO")

    def _id(self):
        self.n += 1
        return "x-%d" % self.n

    def consent(self, inst, status="ATIVO", escopos=("CONTAS", "CARTOES", "CREDITO", "INVESTIMENTOS"),
                expira=None, tipo="OPEN_FINANCE"):
        k = dict(id=self._id(), clienteId="cli-900", instituicaoId=inst, tipo=tipo, status=status,
                 escopos=list(escopos))
        if expira is not None:
            k["expiraEm"] = (REF + timedelta(days=expira)).isoformat()
        self.d["consentimentos"].append(k)

    def conta(self, inst, saldo=0):
        cid = "cta-%s" % self._id()
        self.d["contas"].append(dict(id=cid, clienteId="cli-900", instituicaoId=inst,
                                     tipo="PAGAMENTO" if inst == "inst-xp" else "CORRENTE", saldo=Decimal(saldo)))
        return cid

    def tx(self, conta, data, valor, tipo="DEBITO", modalidade="CARTAO_DEBITO", desc="COMPRA DEBITO LOJA", doc=None):
        t = dict(id=self._id(), contaId=conta, data=data, valor=Decimal(valor), tipo=tipo, modalidade=modalidade,
                 descricao=desc)
        if doc:
            t["contraparteDocumento"] = doc
        self.d["transacoes"].append(t)

    def mensal(self, conta, valor, meses=MESES, dia="05", **kw):
        for m in meses:
            self.tx(conta, "%s-%s" % (m, dia), valor, **kw)

    def salario(self, conta, valor, meses=MESES, doc="11.111.111/0001-11", dia="05"):
        self.mensal(conta, valor, meses, dia, tipo="CREDITO", modalidade="TED", desc="SALARIO EMPRESA", doc=doc)

    def fatura(self, inst, valor, meses=MESES):
        for m in meses:
            self.d["faturas"].append(dict(id=self._id(), clienteId="cli-900", instituicaoId=inst, mesReferencia=m,
                                          valorTotal=Decimal(valor)))

    def inv(self, inst, produto, valor, emissor=None, liquidez=False, venc=None):
        p = dict(id=self._id(), clienteId="cli-900", instituicaoId=inst, produto=produto, nome="p",
                 valorAplicado=Decimal(valor), valorAtual=Decimal(valor), dataAplicacao="2025-01-01",
                 indexador="CDI", liquidezDiaria=liquidez)
        if emissor:
            p["emissorId"] = emissor
        if venc is not None:
            p["vencimento"] = (REF + timedelta(days=venc)).isoformat()
        self.d["investimentos"].append(p)

    def credito(self, inst, saldo):
        self.d["creditos"].append(dict(id=self._id(), clienteId="cli-900", instituicaoId=inst, tipo="PESSOAL",
                                       saldoDevedor=Decimal(saldo), parcelaMensal=Decimal(1), taxaAnual=Decimal("0.1")))

    def analise(self, conceder=()):
        return checar_seed.Analise(checar_seed.Base.de_dados(self.d, REF), "cli-900", conceder)


def cat(desc, tipo="DEBITO", modalidade="CARTAO_DEBITO", doc=None):
    t = dict(descricao=desc, tipo=tipo, modalidade=modalidade)
    if doc:
        t["contraparteDocumento"] = doc
    return checar_seed.categorizar(t, CPF)


class TestCategorizacao(unittest.TestCase):  # §7.1
    def test_transferencia_propria_vence_tudo(self):
        self.assertEqual(cat("APLICACAO XP", doc=CPF), "TRANSFERENCIA_PROPRIA")
        self.assertEqual(cat("PIX RECEBIDO FULANO", tipo="CREDITO", modalidade="PIX", doc=CPF), "TRANSFERENCIA_PROPRIA")

    def test_aplicacao_e_resgate(self):
        self.assertEqual(cat("APLICACAO XP", modalidade="TED"), "APLICACAO")
        self.assertEqual(cat("RESGATE XP", tipo="CREDITO", modalidade="TED"), "RESGATE")

    def test_fatura_antes_de_boleto(self):
        self.assertEqual(cat("FATURA CARTAO AURORA", modalidade="BOLETO"), "PAGAMENTO_FATURA")

    def test_parcela_antes_de_conta_recorrente(self):
        self.assertEqual(cat("PARCELA FINANCIAMENTO", modalidade="DEBITO_AUTOMATICO"), "PARCELA_CREDITO")

    def test_conta_recorrente_por_modalidade_ou_descricao(self):
        self.assertEqual(cat("QUALQUER COISA", modalidade="BOLETO"), "CONTA_RECORRENTE")
        self.assertEqual(cat("SEGURO", modalidade="DEBITO_AUTOMATICO"), "CONTA_RECORRENTE")
        self.assertEqual(cat("CONDOMINIO", modalidade="PIX"), "CONTA_RECORRENTE")
        self.assertEqual(cat("PLANO DE SAUDE", modalidade="TED"), "CONTA_RECORRENTE")

    def test_credito_candidato_e_consumo(self):
        self.assertEqual(cat("SALARIO X", tipo="CREDITO", modalidade="TED"), "CREDITO_CANDIDATO_RENDA")
        self.assertEqual(cat("CONDOMINIO", tipo="CREDITO", modalidade="BOLETO"), "CREDITO_CANDIDATO_RENDA")
        self.assertEqual(cat("COMPRA DEBITO PADARIA"), "CONSUMO")
        self.assertEqual(cat("PIX ENVIADO JOAO", modalidade="PIX"), "CONSUMO")
        self.assertEqual(cat("TARIFA PACOTE", modalidade="TARIFA"), "CONSUMO")

    def test_banco_do_cartao(self):
        b = checar_seed.Base.de_dados(dados_vazios(), REF)
        self.assertEqual(b.banco_cartao("AURORA"), "inst-aurora")  # não a Aurora Financeira
        self.assertEqual(b.banco_cartao("IPE"), "inst-ipe")        # sem acento
        self.assertEqual(b.banco_cartao("XP"), "inst-xp")
        self.assertEqual(b.banco_cartao("HORIZONTE"), "inst-horizonte")
        self.assertIsNone(b.banco_cartao("NUBANCO"))

    def test_analise_nao_altera_os_dados_de_entrada(self):
        m = Mundo()
        c = m.conta("inst-xp")
        m.tx(c, "2026-09-01", 10)
        antes = copy.deepcopy(m.d["transacoes"])
        m.analise()
        self.assertEqual(m.d["transacoes"], antes)


class TestRenda(unittest.TestCase):  # §7.2
    def test_recorrente_em_3_meses(self):
        m = Mundo()
        c = m.conta("inst-xp")
        m.salario(c, 10000, MESES[:3], dia="07")
        a = m.analise()
        self.assertEqual(a.renda, 10000)
        self.assertEqual(a.fontes[0]["diaDoMes"], 7)
        self.assertEqual(a.fontes[0]["instituicaoId"], "inst-xp")

    def test_dois_meses_nao_e_renda(self):
        m = Mundo()
        c = m.conta("inst-xp")
        m.salario(c, 10000, MESES[:2])
        self.assertEqual(m.analise().renda, 0)

    def test_tolerancia_15_por_cento_da_mediana(self):
        m = Mundo()
        c = m.conta("inst-xp")
        for mes, v in zip(MESES[:3], (10000, 11500, 8500)):  # ±15% exatos: aceita
            m.tx(c, mes + "-05", v, tipo="CREDITO", modalidade="TED", desc="SALARIO", doc="D1")
        for mes, v in zip(MESES[:3], (10000, 11600, 8400)):  # fora: só 1 mês ok
            m.tx(c, mes + "-05", v, tipo="CREDITO", modalidade="TED", desc="FREELA", doc="D2")
        a = m.analise()
        self.assertEqual([f["valorMensal"] for f in a.fontes], [10000])

    def test_valor_mensal_e_mediana_e_soma_das_fontes(self):
        m = Mundo()
        c = m.conta("inst-xp")
        for mes, v in zip(MESES, (9000, 10000, 10000, 10500, 10000, 9800)):
            m.tx(c, mes + "-05", v, tipo="CREDITO", modalidade="TED", desc="SALARIO", doc="D1")
        m.salario(c, 3000, doc="D2")
        a = m.analise()
        self.assertEqual(a.renda, 13000)
        self.assertEqual(sorted(f["valorMensal"] for f in a.fontes), [3000, 10000])

    def test_transferencia_propria_nao_e_renda(self):
        m = Mundo()
        c = m.conta("inst-xp")
        m.mensal(c, 5000, tipo="CREDITO", modalidade="PIX", desc="PIX RECEBIDO TESTE", doc=CPF)
        self.assertEqual(m.analise().renda, 0)


class TestFluxoCaixa(unittest.TestCase):  # §7.3
    def _base(self, cartao_visivel):
        m = Mundo(declaradas=[("inst-xp", ["INVESTIMENTOS"]), ("inst-ipe", ["CONTA"]), ("inst-aurora", ["CARTAO"])])
        m.consent("inst-ipe", escopos=["CONTAS"], expira=200)
        m.consent("inst-aurora", status="ATIVO" if cartao_visivel else "PENDENTE", escopos=["CARTOES"],
                  expira=200 if cartao_visivel else None)
        c = m.conta("inst-ipe", 22000)
        m.salario(c, 14000)
        m.mensal(c, 2900, modalidade="BOLETO", desc="ALUGUEL")
        m.mensal(c, 500, modalidade="DEBITO_AUTOMATICO", desc="PARCELA FINANCIAMENTO")
        m.mensal(c, 1000)  # consumo
        m.mensal(c, 3000, modalidade="BOLETO", desc="FATURA CARTAO AURORA")
        m.mensal(c, 1000, modalidade="TED", desc="APLICACAO XP")
        m.fatura("inst-aurora", 3300)
        m.inv("inst-xp", "CDB", 5000, "emi-ipe", liquidez=True)
        return m

    def test_proxy_quando_cartao_nao_visivel(self):
        a = self._base(False).analise()
        self.assertEqual(a.custo, 2900 + 500 + 1000 + 3000)
        self.assertTrue(a.parcial)

    def test_fatura_visivel_substitui_pagamento(self):
        a = self._base(True).analise()
        self.assertEqual(a.custo, 2900 + 500 + 1000 + 3300)
        self.assertFalse(a.parcial)

    def test_conceder_pendente_tem_o_mesmo_efeito(self):
        a = self._base(False).analise(conceder=("inst-aurora",))
        self.assertEqual(a.custo, 2900 + 500 + 1000 + 3300)

    def test_so_ultimos_3_meses_e_media(self):
        m = Mundo()
        c = m.conta("inst-xp", 0)
        m.tx(c, "2026-04-10", 90000)          # fora da janela de custo
        m.tx(c, "2026-10-01", 90000)          # mês de referência: fora
        m.tx(c, "2026-07-10", 1000)
        m.tx(c, "2026-09-10", 2000)
        self.assertEqual(m.analise().custo, 1000)

    def test_capacidade_liquidez_reserva(self):
        a = self._base(False).analise()
        self.assertEqual(a.capacidade, 14000 - 7400)
        self.assertEqual(a.liquidez, 22000 + 5000)
        self.assertEqual(a.reserva, Decimal("3.6"))  # 27000/7400 = 3,648... -> 3,6

    def test_reserva_arredonda_uma_casa(self):
        m = Mundo()
        c = m.conta("inst-xp", 85000)
        m.mensal(c, 24000, meses=ULT3)
        m.inv("inst-xp", "CDB", 70000, "emi-ipe", liquidez=True)
        m.inv("inst-xp", "TESOURO", 1000000, "emi-tesouro", liquidez=False)
        self.assertEqual(m.analise().reserva, Decimal("6.5"))


class TestPrincipalidade(unittest.TestCase):  # §7.4
    def test_renormaliza_componentes_zerados(self):
        m = Mundo(declaradas=[("inst-xp", ["INVESTIMENTOS"]), ("inst-aurora", ["CONTA"])])
        m.consent("inst-aurora", escopos=["CONTAS"], expira=200)
        c = m.conta("inst-aurora", 1000)
        m.salario(c, 10000)
        m.mensal(c, 1000, modalidade="BOLETO", desc="ENERGIA")
        m.inv("inst-xp", "TESOURO", 100000, "emi-tesouro")
        a = m.analise()
        # sem cartão e sem crédito: pesos 0,30+0,20+0,15+0,15 = 0,80
        self.assertEqual(a.principal, "inst-aurora")
        self.assertEqual(a.scores["inst-aurora"]["score"], Decimal("100") * Decimal("0.65") / Decimal("0.80"))
        self.assertEqual(a.scores["inst-xp"]["score"], Decimal("100") * Decimal("0.15") / Decimal("0.80"))
        self.assertEqual(sum(a.scores["inst-xp"]["contrib"].values()), a.scores["inst-xp"]["score"])
        self.assertEqual(a.posicao_xp, "SO_INVESTIMENTOS")

    def test_aplicacao_e_transferencia_propria_fora_da_movimentacao(self):
        m = Mundo(declaradas=[("inst-xp", ["INVESTIMENTOS"]), ("inst-aurora", ["CONTA"])])
        m.consent("inst-aurora", escopos=["CONTAS"], expira=200)
        c = m.conta("inst-aurora")
        m.mensal(c, 1000)
        m.mensal(c, 50000, modalidade="TED", desc="APLICACAO XP")
        m.mensal(c, 50000, modalidade="PIX", desc="PIX ENVIADO TESTE", doc=CPF)
        x = m.conta("inst-xp")
        m.mensal(x, 50000, tipo="CREDITO", modalidade="PIX", desc="PIX RECEBIDO", doc=CPF)
        m.mensal(x, 100)
        a = m.analise()
        self.assertEqual(a.scores["inst-aurora"]["shares"]["movimentacao"], Decimal(3000) / Decimal(3300))
        self.assertEqual(a.posicao_xp, "SECUNDARIA")

    def test_xp_principal(self):
        m = Mundo(declaradas=[("inst-xp", ["CONTA", "INVESTIMENTOS"])])
        c = m.conta("inst-xp", 1000)
        m.salario(c, 10000)
        m.mensal(c, 1000)
        m.inv("inst-xp", "TESOURO", 100000, "emi-tesouro")
        a = m.analise()
        self.assertEqual((a.principal, a.posicao_xp), ("inst-xp", "PRINCIPAL"))
        self.assertEqual(checar_seed.q2(a.scores["inst-xp"]["score"]), 100)

    def test_ausente(self):
        m = Mundo(declaradas=[("inst-xp", ["INVESTIMENTOS"]), ("inst-aurora", ["CONTA"])])
        m.consent("inst-aurora", escopos=["CONTAS"], expira=200)
        c = m.conta("inst-aurora")
        m.salario(c, 10000)
        self.assertEqual(m.analise().posicao_xp, "AUSENTE")


class TestFgc(unittest.TestCase):  # §7.5
    def test_conglomerado_soma_emissores_e_conta_corrente(self):
        m = Mundo(declaradas=[("inst-xp", ["INVESTIMENTOS"]), ("inst-aurora", ["CONTA", "INVESTIMENTOS"]),
                              ("inst-aurora-fin", ["INVESTIMENTOS"])])
        m.consent("inst-aurora", escopos=["CONTAS", "INVESTIMENTOS"], expira=200)
        m.consent("inst-aurora-fin", escopos=["INVESTIMENTOS"], expira=200)
        m.conta("inst-aurora", 6000)
        m.inv("inst-aurora", "POUPANCA", 150000, "emi-aurora", liquidez=True)
        m.inv("inst-aurora-fin", "LCI", 174000, "emi-aurora-fin")
        a = m.analise()
        self.assertEqual(a.fgc["cong-aurora"], 330000)
        self.assertEqual([(x["chave"], x["valor"]) for x in a.alerta("FGC_EXCEDIDO")], [("cong-aurora", 80000)])

    def test_emissor_vale_nao_custodiante_e_pagamento_fora(self):
        m = Mundo(declaradas=[("inst-xp", ["CONTA", "INVESTIMENTOS"])])
        m.conta("inst-xp", 500000)                         # PAGAMENTO: não entra
        m.inv("inst-xp", "CDB", 240000, "emi-ipe")         # custodiado na XP, conta para o Ipê
        m.inv("inst-xp", "CDB", 20000, "emi-ipe")
        m.inv("inst-xp", "TESOURO", 900000, "emi-tesouro")  # não elegível
        m.inv("inst-xp", "CRA", 300000, "emi-agrosul")      # não elegível
        m.inv("inst-xp", "FUNDO", 300000)
        a = m.analise()
        self.assertEqual(a.fgc, {"cong-ipe": 260000})
        self.assertEqual([x["valor"] for x in a.alerta("FGC_EXCEDIDO")], [10000])

    def test_limite_exato_nao_dispara(self):
        m = Mundo()
        m.inv("inst-xp", "LCA", 250000, "emi-horizonte")
        self.assertEqual(m.analise().alerta("FGC_EXCEDIDO"), [])

    def test_teto_global(self):
        m = Mundo()
        for e in ("emi-ipe", "emi-horizonte", "emi-aurora", "emi-xp"):
            m.inv("inst-xp", "CDB", 250000, e)
        self.assertEqual(m.analise().alerta("FGC_TETO_GLOBAL"), [])
        m.inv("inst-xp", "RDB", 1, "emi-xp")
        a = m.analise()
        self.assertEqual(len(a.alerta("FGC_TETO_GLOBAL")), 1)
        self.assertEqual(a.alerta("FGC_TETO_GLOBAL")[0]["sev"], "MEDIA")


class TestExposicao(unittest.TestCase):  # §7.6
    def test_excesso_fgc_de_banco_media(self):
        m = Mundo()
        m.inv("inst-xp", "CDB", 650000, "emi-horizonte")
        m.inv("inst-xp", "FUNDO", 985000)
        al = m.analise().alerta("CONCENTRACAO_EMISSOR")
        self.assertEqual([(x["chave"], x["sev"], x["valor"]) for x in al], [("cong-horizonte", "MEDIA", 400000)])
        self.assertEqual(round(al[0]["pct"], 4), Decimal("0.2446"))

    def test_banco_acima_de_35_alta(self):
        m = Mundo()
        m.inv("inst-xp", "CDB", 650000, "emi-horizonte")
        m.inv("inst-xp", "FUNDO", 400000)
        self.assertEqual(m.analise().alerta("CONCENTRACAO_EMISSOR")[0]["sev"], "ALTA")

    def test_empresa_acima_de_20_alta(self):
        m = Mundo()
        m.inv("inst-xp", "CRA", 210000, "emi-agrosul")
        m.inv("inst-xp", "FUNDO", 790000)
        al = m.analise().alerta("CONCENTRACAO_EMISSOR")
        self.assertEqual([(x["chave"], x["sev"]) for x in al], [("cong-agrosul", "ALTA")])

    def test_ate_20_nao_dispara_e_patrimonio_inclui_saldos(self):
        m = Mundo(declaradas=[("inst-xp", ["CONTA", "INVESTIMENTOS"])])
        m.inv("inst-xp", "CRA", 200000, "emi-agrosul")
        m.inv("inst-xp", "FUNDO", 700000)
        m.conta("inst-xp", 100000)
        a = m.analise()
        self.assertEqual(a.patrimonio, 1000000)
        self.assertEqual(a.alerta("CONCENTRACAO_EMISSOR"), [])


class TestDemaisAlertas(unittest.TestCase):  # §7.7
    def test_vencimento_ate_30_dias(self):
        m = Mundo()
        m.inv("inst-xp", "CDB", 100000, "emi-ipe", venc=30)
        m.inv("inst-xp", "CDB", 100000, "emi-horizonte", venc=31)
        self.assertEqual(len(m.analise().alerta("VENCIMENTO_PROXIMO")), 1)

    def test_saldo_parado_limiar(self):
        for saldo, dispara in ((19999, False), (20000, True)):
            m = Mundo(declaradas=[("inst-xp", ["CONTA", "INVESTIMENTOS"])])
            c = m.conta("inst-xp", saldo)
            m.mensal(c, 10000, meses=ULT3)
            al = m.analise().alerta("SALDO_PARADO")
            self.assertEqual(bool(al), dispara, saldo)

    def test_renda_fora_xp_exige_capacidade_2000(self):
        for gasto, dispara in ((8001, False), (8000, True)):
            m = Mundo(declaradas=[("inst-xp", ["INVESTIMENTOS"]), ("inst-ipe", ["CONTA"])])
            m.consent("inst-ipe", escopos=["CONTAS"], expira=200)
            c = m.conta("inst-ipe")
            m.salario(c, 10000)
            m.mensal(c, gasto)
            self.assertEqual(bool(m.analise().alerta("RENDA_FORA_XP")), dispara, gasto)

    def test_consentimento_expirando_15_dias_so_ativo(self):
        m = Mundo(declaradas=[("inst-xp", ["INVESTIMENTOS"]), ("inst-ipe", ["CONTA"]), ("inst-aurora", ["CONTA"])])
        m.consent("inst-ipe", escopos=["CONTAS"], expira=15)
        m.consent("inst-aurora", escopos=["CONTAS"], expira=16)
        self.assertEqual([x["chave"] for x in m.analise().alerta("CONSENTIMENTO_EXPIRANDO")], ["inst-ipe"])

    def test_evento_vida_7_dias(self):
        m = Mundo(dependentes=[("Sofia", "2014-10-18"), ("Pedro", "2017-10-19"), ("Ana", "2010-10-10")],
                  eventos=[(REF + timedelta(days=7)).isoformat(), (REF + timedelta(days=8)).isoformat()])
        al = m.analise().alerta("EVENTO_VIDA_PROXIMO")
        self.assertEqual(sorted(str(x["chave"]) for x in al), ["Sofia", "evt-0"])

    def test_reserva_insuficiente(self):
        m = Mundo(declaradas=[("inst-xp", ["CONTA", "INVESTIMENTOS"])])
        c = m.conta("inst-xp", 5900)
        m.mensal(c, 1000, meses=ULT3)
        self.assertEqual(len(m.analise().alerta("RESERVA_INSUFICIENTE")), 1)
        m.d["contas"][0]["saldo"] = Decimal(5950)  # 5,95 -> 6,0 (arredondado): não dispara
        self.assertEqual(m.analise().alerta("RESERVA_INSUFICIENTE"), [])


class TestPrioridade(unittest.TestCase):  # §7.9
    def test_formulas(self):
        P = checar_seed.pontos
        self.assertEqual(P(dict(tipo="FGC_EXCEDIDO", valor=Decimal(400000))), 55)
        self.assertEqual(P(dict(tipo="FGC_EXCEDIDO", valor=Decimal(80000))), 39)
        self.assertEqual(P(dict(tipo="FGC_EXCEDIDO", valor=Decimal(5000000))), 60)
        self.assertEqual(P(dict(tipo="FGC_TETO_GLOBAL", valor=Decimal(1))), 10)
        self.assertEqual(P(dict(tipo="CONCENTRACAO_EMISSOR", sev="MEDIA")), 15)
        self.assertEqual(P(dict(tipo="CONCENTRACAO_EMISSOR", sev="ALTA")), 25)
        self.assertEqual(P(dict(tipo="VENCIMENTO_PROXIMO", valor=Decimal(240000))), Decimal("19.8"))
        self.assertEqual(P(dict(tipo="VENCIMENTO_PROXIMO", valor=Decimal(9000000))), 25)
        self.assertEqual(P(dict(tipo="SALDO_PARADO", valor=Decimal(61000))), Decimal("16.1"))
        self.assertEqual(P(dict(tipo="SALDO_PARADO", valor=Decimal(500000))), 20)
        for t, v in (("RENDA_FORA_XP", 10), ("CONSENTIMENTO_EXPIRANDO", 10), ("RESERVA_INSUFICIENTE", 8),
                     ("EVENTO_VIDA_PROXIMO", 8)):
            self.assertEqual(P(dict(tipo=t, valor=None)), v)

    def test_bonus_so_investimentos_e_teto_100(self):
        m = Mundo()
        m.inv("inst-xp", "CDB", 2000000, "emi-horizonte", venc=10)
        a = m.analise()
        self.assertEqual(a.posicao_xp, "SO_INVESTIMENTOS")
        self.assertIn(("BONUS_SO_INVESTIMENTOS", 5), a.motivos)
        self.assertGreater(sum(p for _, p in a.motivos), 100)
        self.assertEqual(a.prioridade, 100)


class TestJornada(unittest.TestCase):  # §7.10
    def test_niveis(self):
        m = Mundo(declaradas=[("inst-xp", ["INVESTIMENTOS"]), ("inst-aurora", ["CONTA"]), ("inst-ipe", ["CONTA"])])
        m.consent("inst-aurora", status="PENDENTE", escopos=["CONTAS"])
        m.consent("inst-ipe", status="PENDENTE", escopos=["CONTAS"])
        m.inv("inst-xp", "FUNDO", 1000)
        self.assertEqual(m.analise().nivel, 1)
        self.assertEqual(m.analise(("inst-aurora",)).nivel, 2)
        self.assertEqual(m.analise(("inst-aurora", "inst-ipe")).nivel, 3)


if __name__ == "__main__":
    unittest.main()
