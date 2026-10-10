# -*- coding: utf-8 -*-
"""Testes do gerador de seed (PLAN §4.1, §6.2, §6.3, §6.4)."""
import json
import os
import shutil
import tempfile
import unittest
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from _util import REF, seed, gerar_seed

# §4.1 — campos obrigatórios e opcionais por arquivo
CAMPOS = {
    "instituicoes": ({"id", "nome", "conglomeradoId", "conglomeradoNome", "ehXp"}, set()),
    "emissores": ({"id", "nome", "conglomeradoId", "tipo"}, set()),
    "clientes": ({"id", "nome", "cpf", "idade", "profissao", "cidade", "perfil", "assessorId", "ancora",
                  "instituicoesDeclaradas", "dependentes", "eventosVida"}, set()),
    "consentimentos": ({"id", "clienteId", "instituicaoId", "tipo", "status", "escopos"}, {"concedidoEm", "expiraEm"}),
    "contas": ({"id", "clienteId", "instituicaoId", "tipo", "saldo"}, set()),
    "transacoes": ({"id", "contaId", "data", "valor", "tipo", "modalidade", "descricao"},
                   {"contraparteDocumento", "contraparteNome"}),
    "faturas": ({"id", "clienteId", "instituicaoId", "mesReferencia", "valorTotal"}, set()),
    "creditos": ({"id", "clienteId", "instituicaoId", "tipo", "saldoDevedor", "parcelaMensal", "taxaAnual"}, set()),
    "investimentos": ({"id", "clienteId", "instituicaoId", "produto", "nome", "valorAplicado", "valorAtual",
                       "dataAplicacao", "indexador", "liquidezDiaria"}, {"emissorId", "vencimento", "taxa"}),
}
DINHEIRO = {"contas": ["saldo"], "transacoes": ["valor"], "faturas": ["valorTotal"],
            "creditos": ["saldoDevedor", "parcelaMensal"], "investimentos": ["valorAplicado", "valorAtual"]}
ENUMS = {
    ("clientes", "perfil"): {"CONSERVADOR", "MODERADO", "ARROJADO", "AGRESSIVO"},
    ("consentimentos", "tipo"): {"OPEN_FINANCE", "INTERNO"},
    ("consentimentos", "status"): {"ATIVO", "PENDENTE", "EXPIRADO", "REVOGADO"},
    ("contas", "tipo"): {"CORRENTE", "PAGAMENTO"},
    ("transacoes", "tipo"): {"CREDITO", "DEBITO"},
    ("transacoes", "modalidade"): {"PIX", "TED", "BOLETO", "DEBITO_AUTOMATICO", "CARTAO_DEBITO", "TARIFA", "OUTRO"},
    ("creditos", "tipo"): {"IMOBILIARIO", "VEICULO", "PESSOAL", "CONSIGNADO", "RURAL"},
    ("investimentos", "produto"): {"CDB", "RDB", "LCI", "LCA", "LC", "POUPANCA", "TESOURO", "DEBENTURE", "CRI", "CRA",
                                   "FUNDO", "ACAO", "PREVIDENCIA"},
    ("investimentos", "indexador"): {"CDI", "IPCA", "PRE", "SELIC", "NA"},
    ("emissores", "tipo"): {"BANCO", "EMPRESA", "TESOURO"},
}
MESES = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]
FIXOS = {"CONDOMINIO", "ALUGUEL", "ENERGIA", "AGUA", "INTERNET", "TELEFONE", "PLANO DE SAUDE", "ESCOLA",
         "ACADEMIA", "PARCELA FINANCIAMENTO", "APLICACAO XP", "INSS BENEFICIO"}

# Totais mensais exatos do §6.3 por conta (descrição -> valor; "consumo" = soma das compras/PIX)
ESPERADO_MENSAL = {
    "cta-001-aurora": {"SALARIO HOSPITAL SANTA CLARA": 38000, "CONDOMINIO": 2800, "ENERGIA": 450, "INTERNET": 150,
                       "ESCOLA": 3200, "PARCELA FINANCIAMENTO": 6500, "consumo": 1900,
                       "FATURA CARTAO AURORA": 9000, "APLICACAO XP": 5000},
    "cta-002-xp": {"PRO LABORE ANDRADE EMBALAGENS": 25000, "CONDOMINIO": 1900, "ENERGIA": 600,
                   "PLANO DE SAUDE": 2400, "consumo": 2500, "FATURA CARTAO XP": 5000},
    "cta-002-aurora": {"AGUA": 200, "consumo": 1000},
    "cta-003-ipe": {"SALARIO TECHVALE SISTEMAS": 14000, "ALUGUEL": 2900, "ENERGIA": 180, "INTERNET": 120,
                    "ACADEMIA": 150, "consumo": 2650, "FATURA CARTAO AURORA": 3000, "APLICACAO XP": 1000},
    "cta-004-aurora": {"INSS BENEFICIO": 8500, "ENERGIA": 220, "AGUA": 90, "TELEFONE": 110, "PLANO DE SAUDE": 1800,
                       "consumo": 1780},
    "cta-005-ipe": {"PRO LABORE FAZENDA BOA VISTA": 20000, "ENERGIA": 900, "PLANO DE SAUDE": 2000, "ESCOLA": 2500,
                    "consumo": 4600, "FATURA CARTAO IPE": 5000, "PARCELA FINANCIAMENTO": 4000},
    "cta-006-xp": {"PRO LABORE CLINICA SORRISO PLENO": 22000, "CONDOMINIO": 1500, "ENERGIA": 300, "INTERNET": 150,
                   "PLANO DE SAUDE": 1050, "consumo": 3500, "FATURA CARTAO XP": 6000},
}
DIAS_RENDA = {"SALARIO HOSPITAL SANTA CLARA": 5, "PRO LABORE ANDRADE EMBALAGENS": 1, "SALARIO TECHVALE SISTEMAS": 5,
              "INSS BENEFICIO": 25, "PRO LABORE FAZENDA BOA VISTA": 10}
SALDOS = {"cta-001-aurora": 85000, "cta-002-xp": 18000, "cta-002-aurora": 3000, "cta-003-ipe": 22000,
          "cta-004-aurora": 6000, "cta-005-ipe": 25000, "cta-006-xp": 12000}


def eh_consumo(t):
    return t["descricao"].startswith("COMPRA DEBITO ") or (
        t["descricao"].startswith("PIX ENVIADO ") and t.get("contraparteDocumento") is None)


def por_id(lista):
    return {x["id"]: x for x in lista}


class TestFormatoJson(unittest.TestCase):
    def test_campos_exatos_por_arquivo(self):
        s = seed()
        for arq, (obrig, opc) in CAMPOS.items():
            self.assertTrue(s[arq], arq)
            for obj in s[arq]:
                chaves = set(obj)
                self.assertTrue(obrig <= chaves, "%s falta %s" % (arq, obrig - chaves))
                self.assertTrue(chaves <= obrig | opc, "%s sobra %s" % (arq, chaves - obrig - opc))

    def test_subobjetos_do_cliente(self):
        for c in seed()["clientes"]:
            for d in c["instituicoesDeclaradas"]:
                self.assertEqual(set(d), {"instituicaoId", "produtos"})
                self.assertTrue(set(d["produtos"]) <= {"CONTA", "CARTAO", "CREDITO", "INVESTIMENTOS"})
            for d in c["dependentes"]:
                self.assertEqual(set(d), {"nome", "parentesco", "dataNascimento"})
            for e in c["eventosVida"]:
                self.assertEqual(set(e), {"id", "tipo", "descricao", "data", "origem"})
                self.assertIn(e["origem"], {"CADASTRO", "NOTA_REUNIAO"})
            self.assertEqual(c["assessorId"], "ass-001")

    def test_enums(self):
        s = seed()
        for (arq, campo), valores in ENUMS.items():
            for obj in s[arq]:
                self.assertIn(obj[campo], valores, "%s.%s" % (arq, campo))
        for k in s["consentimentos"]:
            self.assertTrue(set(k["escopos"]) <= {"CONTAS", "CARTOES", "CREDITO", "INVESTIMENTOS"})

    def test_dinheiro_no_maximo_2_casas_e_positivo(self):
        s = seed()
        for arq, campos in DINHEIRO.items():
            for obj in s[arq]:
                for c in campos:
                    v = Decimal(str(obj[c]))
                    self.assertEqual(v, v.quantize(Decimal("0.01")), "%s.%s=%s" % (arq, c, v))
                    self.assertGreaterEqual(v, 0)
        for t in s["transacoes"]:
            self.assertGreater(t["valor"], 0)

    def test_datas_iso(self):
        s = seed()
        for t in s["transacoes"]:
            date.fromisoformat(t["data"])
        for k in s["consentimentos"]:
            for c in ("concedidoEm", "expiraEm"):
                if c in k:
                    self.assertEqual(len(k[c]), 10)
                    date.fromisoformat(k[c])
        for p in s["investimentos"]:
            date.fromisoformat(p["dataAplicacao"])
            if "vencimento" in p:
                date.fromisoformat(p["vencimento"])
        for f in s["faturas"]:
            self.assertRegex(f["mesReferencia"], r"^\d{4}-\d{2}$")

    def test_ids_unicos_e_referencias(self):
        s = seed()
        for arq in CAMPOS:
            ids = [x["id"] for x in s[arq]]
            self.assertEqual(len(ids), len(set(ids)), arq)
        insts, clis, ctas = por_id(s["instituicoes"]), por_id(s["clientes"]), por_id(s["contas"])
        emis = por_id(s["emissores"])
        for arq in ("consentimentos", "contas", "faturas", "creditos", "investimentos"):
            for x in s[arq]:
                self.assertIn(x["clienteId"], clis)
                self.assertIn(x["instituicaoId"], insts)
        for t in s["transacoes"]:
            self.assertIn(t["contaId"], ctas)
        for p in s["investimentos"]:
            if "emissorId" in p:
                self.assertIn(p["emissorId"], emis)

    def test_contas_xp_pagamento_bancos_corrente(self):
        for c in seed()["contas"]:
            self.assertEqual(c["tipo"], "PAGAMENTO" if c["instituicaoId"] == "inst-xp" else "CORRENTE")

    def test_instituicoes_e_emissores_do_plano(self):
        s = seed()
        insts = por_id(s["instituicoes"])
        self.assertEqual(set(insts), {"inst-xp", "inst-aurora", "inst-aurora-fin", "inst-horizonte", "inst-ipe"})
        self.assertEqual(insts["inst-aurora-fin"]["conglomeradoId"], "cong-aurora")
        self.assertTrue(insts["inst-xp"]["ehXp"])
        emis = por_id(s["emissores"])
        self.assertEqual(emis["emi-tesouro"]["tipo"], "TESOURO")
        self.assertEqual(emis["emi-agrosul"]["tipo"], "EMPRESA")
        self.assertEqual(emis["emi-agrosul"]["conglomeradoId"], "cong-agrosul")
        for e in ("emi-xp", "emi-aurora", "emi-aurora-fin", "emi-horizonte", "emi-ipe"):
            self.assertEqual(emis[e]["tipo"], "BANCO")

    def test_grava_arquivos_utf8(self):
        tmp = tempfile.mkdtemp()
        try:
            gerar_seed.gerar(REF).gravar(tmp, verbose=False)
            for arq in CAMPOS:
                with open(os.path.join(tmp, arq + ".json"), encoding="utf-8") as f:
                    self.assertEqual(json.load(f), seed()[arq])
            with open(os.path.join(tmp, "instituicoes.json"), encoding="utf-8") as f:
                self.assertIn("Banco Ipê", f.read())  # ensure_ascii=False
        finally:
            shutil.rmtree(tmp)

    def test_deterministico(self):
        self.assertEqual(gerar_seed.gerar(REF).dados(), seed())


class TestAncorasMensais(unittest.TestCase):
    def setUp(self):
        self.s = seed()
        self.tx = defaultdict(list)
        for t in self.s["transacoes"]:
            self.tx[t["contaId"]].append(t)

    def test_periodo_seis_meses_completos(self):
        meses = {t["data"][:7] for t in self.s["transacoes"]}
        self.assertEqual(sorted(meses), MESES)

    def test_totais_mensais_exatos_por_categoria(self):
        for cta, esperado in ESPERADO_MENSAL.items():
            tot = defaultdict(Decimal)
            for t in self.tx[cta]:
                chave = "consumo" if eh_consumo(t) else t["descricao"]
                tot[(chave, t["data"][:7])] += Decimal(str(t["valor"]))
            chaves = {k for k, _ in tot}
            self.assertEqual(chaves, set(esperado), cta)
            for chave, v in esperado.items():
                for m in MESES:
                    self.assertEqual(tot[(chave, m)], Decimal(v), "%s %s %s" % (cta, chave, m))

    def test_itens_fixos_uma_transacao_por_mes(self):
        for cta, esperado in ESPERADO_MENSAL.items():
            cont = defaultdict(int)
            for t in self.tx[cta]:
                if not eh_consumo(t):
                    cont[(t["descricao"], t["data"][:7])] += 1
            for (desc, m), n in cont.items():
                self.assertEqual(n, 1, "%s %s %s" % (cta, desc, m))

    def test_consumo_8_a_15_transacoes_por_mes_somando_exato(self):
        for cta, esperado in ESPERADO_MENSAL.items():
            for m in MESES:
                cons = [t for t in self.tx[cta] if eh_consumo(t) and t["data"][:7] == m]
                self.assertTrue(8 <= len(cons) <= 15, "%s %s n=%d" % (cta, m, len(cons)))
                self.assertEqual(sum(Decimal(str(t["valor"])) for t in cons), Decimal(esperado["consumo"]))
                for t in cons:
                    self.assertEqual(t["tipo"], "DEBITO")
                    self.assertIn(t["modalidade"], {"CARTAO_DEBITO", "PIX"})
                    self.assertEqual(t["modalidade"] == "PIX", t["descricao"].startswith("PIX ENVIADO "))

    def test_creditos_de_renda_com_pagador_estavel_e_dia(self):
        for cta in ESPERADO_MENSAL:
            cred = [t for t in self.tx[cta] if t["tipo"] == "CREDITO"]
            if not cred:
                continue
            docs = {(t["descricao"], t["contraparteDocumento"], t["contraparteNome"]) for t in cred}
            self.assertEqual(len(docs), 1, cta)
            for t in cred:
                self.assertIn(t["modalidade"], {"TED", "OUTRO"})
                if t["descricao"] in DIAS_RENDA:
                    self.assertEqual(int(t["data"][8:]), DIAS_RENDA[t["descricao"]])
            self.assertEqual(len({t["data"][8:] for t in cred}), 1)

    def test_modalidades_dos_fixos(self):
        for cta in ESPERADO_MENSAL:
            for t in self.tx[cta]:
                d = t["descricao"]
                if d in FIXOS - {"APLICACAO XP", "INSS BENEFICIO"} or d.startswith("FATURA CARTAO"):
                    self.assertEqual(t["tipo"], "DEBITO")
                    self.assertIn(t["modalidade"], {"BOLETO", "DEBITO_AUTOMATICO"}, d)
                if d == "APLICACAO XP":
                    self.assertEqual(t["tipo"], "DEBITO")
        aguas = [t for t in self.tx["cta-002-aurora"] if t["descricao"] == "AGUA"]
        self.assertTrue(all(t["modalidade"] == "DEBITO_AUTOMATICO" for t in aguas))

    def test_saldos(self):
        contas = por_id(self.s["contas"])
        for cta, v in SALDOS.items():
            self.assertEqual(contas[cta]["saldo"], v)
        ancora_ctas = {c["id"] for c in self.s["contas"] if c["clienteId"] <= "cli-006"}
        self.assertEqual(ancora_ctas, set(SALDOS))

    def test_faturas_seis_meses(self):
        esperado = {("cli-001", "inst-aurora"): 9000, ("cli-002", "inst-xp"): 5000, ("cli-003", "inst-aurora"): 3000,
                    ("cli-005", "inst-ipe"): 5000, ("cli-006", "inst-xp"): 6000}
        got = defaultdict(dict)
        for f in self.s["faturas"]:
            if f["clienteId"] <= "cli-006":
                got[(f["clienteId"], f["instituicaoId"])][f["mesReferencia"]] = f["valorTotal"]
        self.assertEqual(set(got), set(esperado))
        for k, v in esperado.items():
            self.assertEqual(got[k], {m: v for m in MESES})

    def test_creditos(self):
        cr = {(c["clienteId"], c["instituicaoId"]): c for c in self.s["creditos"]}
        self.assertEqual((cr[("cli-001", "inst-aurora")]["tipo"], cr[("cli-001", "inst-aurora")]["saldoDevedor"],
                          cr[("cli-001", "inst-aurora")]["parcelaMensal"]), ("IMOBILIARIO", 620000, 6500))
        self.assertEqual((cr[("cli-005", "inst-ipe")]["tipo"], cr[("cli-005", "inst-ipe")]["saldoDevedor"],
                          cr[("cli-005", "inst-ipe")]["parcelaMensal"]), ("RURAL", 350000, 4000))
        self.assertEqual(len([c for c in self.s["creditos"] if c["clienteId"] <= "cli-006"]), 2)


class TestAncorasInvestimentos(unittest.TestCase):
    ESPERADO = {
        # cliente: [(produto, instituicaoId, emissorId, valorAtual, liquidezDiaria)]
        "cli-001": [("TESOURO", "inst-xp", "emi-tesouro", 280000, False), ("FUNDO", "inst-xp", None, 260000, False),
                    ("CDB", "inst-xp", "emi-ipe", 160000, False), ("CDB", "inst-xp", "emi-ipe", 70000, True),
                    ("ACAO", "inst-xp", None, 130000, False),
                    ("CDB", "inst-horizonte", "emi-horizonte", 650000, False)],
        "cli-002": [("CDB", "inst-xp", "emi-ipe", 240000, False), ("LCA", "inst-xp", "emi-aurora", 200000, False),
                    ("TESOURO", "inst-xp", "emi-tesouro", 800000, True), ("FUNDO", "inst-xp", None, 400000, False)],
        "cli-003": [("CDB", "inst-xp", "emi-ipe", 5000, True), ("FUNDO", "inst-xp", None, 35000, False),
                    ("TESOURO", "inst-xp", "emi-tesouro", 20000, False)],
        "cli-004": [("POUPANCA", "inst-aurora", "emi-aurora", 150000, True),
                    ("LCI", "inst-aurora-fin", "emi-aurora-fin", 174000, False),
                    ("TESOURO", "inst-xp", "emi-tesouro", 400000, True)],
        "cli-005": [("CRA", "inst-xp", "emi-agrosul", 900000, False), ("TESOURO", "inst-xp", "emi-tesouro", 600000, True),
                    ("FUNDO", "inst-xp", None, 300000, False), ("LCA", "inst-xp", "emi-horizonte", 200000, False)],
        "cli-006": [("ACAO", "inst-xp", None, 300000, False), ("FUNDO", "inst-xp", None, 200000, False),
                    ("TESOURO", "inst-xp", "emi-tesouro", 100000, True)],
    }

    def test_posicoes_exatas(self):
        s = seed()
        for cid, esperado in self.ESPERADO.items():
            got = sorted((p["produto"], p["instituicaoId"], p.get("emissorId"), p["valorAtual"], p["liquidezDiaria"])
                         for p in s["investimentos"] if p["clienteId"] == cid)
            self.assertEqual(got, sorted(esperado, key=lambda x: (x[0], x[1], x[2] or "", x[3], x[4])), cid)

    def test_valor_aplicado_menor_e_vencimentos_longe(self):
        for p in seed()["investimentos"]:
            self.assertLess(p["valorAplicado"], p["valorAtual"])
            self.assertLess(date.fromisoformat(p["dataAplicacao"]), REF)
            if "vencimento" in p and not (p["clienteId"] == "cli-002" and p["produto"] == "CDB"):
                self.assertGreater((date.fromisoformat(p["vencimento"]) - REF).days, 30, p["id"])

    def test_fundos_e_acoes_sem_emissor(self):
        for p in seed()["investimentos"]:
            if p["produto"] in ("FUNDO", "ACAO", "PREVIDENCIA"):
                self.assertNotIn("emissorId", p)
            else:
                self.assertIn("emissorId", p)

    def test_cdb_marina_vence_em_2028(self):
        cdb = [p for p in seed()["investimentos"] if p["clienteId"] == "cli-001" and p["valorAtual"] == 160000][0]
        self.assertTrue(cdb["vencimento"].startswith("2028"))


class TestDatasRelativas(unittest.TestCase):
    def _datas(self, ref):
        s = seed(ref)
        cli = por_id(s["clientes"])
        cons = {(k["clienteId"], k["instituicaoId"]): k for k in s["consentimentos"]}
        sofia = [d for d in cli["cli-001"]["dependentes"] if d["nome"] == "Sofia"][0]
        cdb = [p for p in s["investimentos"] if p["clienteId"] == "cli-002" and p["produto"] == "CDB"][0]
        return sofia, cons, cdb

    def test_ref_padrao(self):
        sofia, cons, cdb = self._datas(REF)
        self.assertEqual(sofia["dataNascimento"], "2014-10-16")
        self.assertEqual(cons[("cli-002", "inst-aurora")]["expiraEm"], (REF + timedelta(days=10)).isoformat())
        self.assertEqual(cons[("cli-001", "inst-aurora")]["expiraEm"], (REF + timedelta(days=300)).isoformat())
        self.assertEqual(cdb["vencimento"], (REF + timedelta(days=20)).isoformat())

    def test_outra_ref_desloca_datas(self):
        ref = date(2027, 2, 3)
        sofia, cons, cdb = self._datas(ref)
        aniv = ref + timedelta(days=5)
        self.assertEqual(sofia["dataNascimento"], date(2014, aniv.month, aniv.day).isoformat())
        self.assertEqual(cons[("cli-002", "inst-aurora")]["expiraEm"], (ref + timedelta(days=10)).isoformat())
        self.assertEqual(cdb["vencimento"], (ref + timedelta(days=20)).isoformat())
        meses = sorted({t["data"][:7] for t in seed(ref)["transacoes"]})
        self.assertEqual(meses, ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"])

    def test_outros_consentimentos_ativos_expiram_longe(self):
        for k in seed()["consentimentos"]:
            if k["status"] == "ATIVO" and "expiraEm" in k and not (k["clienteId"] == "cli-002"):
                self.assertGreaterEqual((date.fromisoformat(k["expiraEm"]) - REF).days, 60, k["id"])


class TestConsentimentosAncoras(unittest.TestCase):
    def setUp(self):
        self.cons = {(k["clienteId"], k["instituicaoId"]): k for k in seed()["consentimentos"]}

    def test_xp_interno_ativo_quatro_escopos(self):
        for c in seed()["clientes"]:
            k = self.cons[(c["id"], "inst-xp")]
            self.assertEqual((k["tipo"], k["status"]), ("INTERNO", "ATIVO"))
            self.assertEqual(k["escopos"], ["CONTAS", "CARTOES", "CREDITO", "INVESTIMENTOS"])
            self.assertNotIn("expiraEm", k)

    def test_pendentes(self):
        for chave, escopos in ((("cli-001", "inst-horizonte"), ["INVESTIMENTOS"]),
                               (("cli-003", "inst-aurora"), ["CARTOES"])):
            k = self.cons[chave]
            self.assertEqual((k["status"], k["tipo"], k["escopos"]), ("PENDENTE", "OPEN_FINANCE", escopos))
            self.assertNotIn("concedidoEm", k)
            self.assertNotIn("expiraEm", k)

    def test_escopos_derivados_dos_produtos_declarados(self):
        mapa = {"CONTA": "CONTAS", "CARTAO": "CARTOES", "CREDITO": "CREDITO", "INVESTIMENTOS": "INVESTIMENTOS"}
        for c in seed()["clientes"]:
            for d in c["instituicoesDeclaradas"]:
                k = self.cons[(c["id"], d["instituicaoId"])]
                if k["tipo"] == "OPEN_FINANCE":
                    self.assertEqual(set(k["escopos"]), {mapa[p] for p in d["produtos"]}, k["id"])
            insts_cons = {i for (cid, i) in self.cons if cid == c["id"]}
            self.assertEqual(insts_cons, {d["instituicaoId"] for d in c["instituicoesDeclaradas"]}, c["id"])

    def test_status_ancoras(self):
        ativos = [("cli-001", "inst-aurora"), ("cli-002", "inst-aurora"), ("cli-003", "inst-ipe"),
                  ("cli-004", "inst-aurora"), ("cli-004", "inst-aurora-fin"), ("cli-005", "inst-ipe")]
        for chave in ativos:
            self.assertEqual(self.cons[chave]["status"], "ATIVO", chave)
            self.assertIn("concedidoEm", self.cons[chave])

    def test_ancora_flag_e_cpf(self):
        for c in seed()["clientes"]:
            self.assertEqual(c["ancora"], c["id"] <= "cli-006")
            self.assertRegex(c["cpf"], r"^000\.\d{3}\.\d{3}-\d{2}$")


if __name__ == "__main__":
    unittest.main()
