# -*- coding: utf-8 -*-
"""Âncoras contra a tabela do §6.5 e clientes de fundo contra as restrições do §6.4."""
import unittest
from decimal import Decimal

from _util import base, checar_seed


class TestTabela65(unittest.TestCase):
    """Cada linha de checar_seed.ESPERADOS (que espelha o §6.5) precisa passar."""

    @classmethod
    def setUpClass(cls):
        cls.b = base()

    def test_esperados_cobrem_a_tabela(self):
        linhas = [(cid, conc) for cid, conc, _ in checar_seed.ESPERADOS]
        self.assertEqual(linhas, [("cli-001", ()), ("cli-001", ("inst-horizonte",)), ("cli-002", ()), ("cli-003", ()),
                                  ("cli-003", ("inst-aurora",)), ("cli-004", ()), ("cli-005", ()), ("cli-006", ())])

    def test_cada_linha(self):
        for cid, conc, exp in checar_seed.ESPERADOS:
            with self.subTest(cliente=cid, conceder=conc):
                a = checar_seed.Analise(self.b, cid, conc)
                falhas = [nome for nome, ok, _, _ in checar_seed.comparar(a, exp) if not ok]
                self.assertEqual(falhas, [])

    def test_numeros_chave(self):
        A = lambda cid, conc=(): checar_seed.Analise(self.b, cid, conc)  # noqa: E731
        m = A("cli-001")
        self.assertEqual((m.renda, m.custo, m.saldo_parado, m.reserva), (38000, 24000, 61000, Decimal("6.5")))
        self.assertEqual(m.prioridade, Decimal("39.1"))
        self.assertEqual(sorted(m.motivos), sorted([("SALDO_PARADO", Decimal("16.1")), ("RENDA_FORA_XP", 10),
                                                    ("EVENTO_VIDA_PROXIMO", 8), ("BONUS_SO_INVESTIMENTOS", 5)]))
        d = A("cli-001", ("inst-horizonte",))
        self.assertEqual(d.fgc_excesso, {"cong-horizonte": 400000})
        self.assertEqual(d.prioridade, 100)
        self.assertEqual(A("cli-002").custo, 13600)
        j = A("cli-003")
        self.assertEqual((j.custo, j.parcial, j.reserva), (9000, True, Decimal("3.0")))
        self.assertEqual(A("cli-004").fgc["cong-aurora"], 330000)
        self.assertEqual(A("cli-005").custo, 19000)
        self.assertEqual(A("cli-006").prioridade, 0)

    def test_fila(self):
        antes = checar_seed.fila(self.b, False)
        depois = checar_seed.fila(self.b, True)
        ancoras = [(cid, p) for p, cid, _ in antes if self.b.cli[cid]["ancora"]]
        self.assertEqual(ancoras, [("cli-004", 54), ("cli-001", Decimal("39.1")), ("cli-003", Decimal("34.3")),
                                   ("cli-005", 30), ("cli-002", Decimal("29.8")), ("cli-006", 0)])
        self.assertNotEqual(antes[0][1], "cli-001")
        self.assertEqual((depois[0][1], depois[0][0]), ("cli-001", 100))
        self.assertTrue(all(self.b.cli[cid]["ancora"] for _, cid, _ in antes[:5]))


class TestFundo(unittest.TestCase):  # §6.4
    @classmethod
    def setUpClass(cls):
        cls.b = base()
        cls.r = checar_seed.checar_fundo(cls.b)

    def test_trinta_clientes(self):
        fundo = [c["id"] for c in self.b.clientes if not c["ancora"]]
        self.assertEqual(fundo, ["cli-%03d" % i for i in range(101, 131)])

    def test_restricoes_sem_violacoes(self):
        self.assertEqual(self.r["problemas"], {})

    def test_prioridade_maxima_15(self):
        self.assertLessEqual(self.r["max_prioridade"], 15)

    def test_vinte_por_cento_com_renda_na_xp(self):
        self.assertEqual(self.r["renda_na_xp"], 6)
        for c in self.b.clientes:
            if c["ancora"]:
                continue
            a = checar_seed.Analise(self.b, c["id"])
            if a.fontes[0]["instituicaoId"] == "inst-xp":
                contas = [k for k in a.contas if k["instituicaoId"] == "inst-xp"]
                self.assertEqual(contas[0]["tipo"], "PAGAMENTO")
                self.assertEqual(a.posicao_xp, "PRINCIPAL")

    def test_variedade(self):
        n = [len(c["instituicoesDeclaradas"]) for c in self.b.clientes if not c["ancora"]]
        self.assertTrue(set(n) >= {1, 2, 3} or set(n) >= {2, 3})
        self.assertTrue(all(1 <= x <= 3 for x in n))
        self.assertGreaterEqual(len(self.r["distribuicao"]), 3)


if __name__ == "__main__":
    unittest.main()
