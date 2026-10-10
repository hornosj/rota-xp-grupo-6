#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Checagem do seed contra o PLAN (§6.5, §7.1–7.7, §7.9, §7.10).

Uso:
    python data/checar_seed.py [--seed backend/src/main/resources/seed] [--data-referencia 2026-10-10]

Implementação de referência (Python, Decimal) das regras da camada `analise`. O backend Java deve
produzir os mesmos números. Sai com código != 0 se alguma linha der FAIL.

Decisões de interpretação (documentadas para o BE1/Analista):
- Visibilidade (OpenFinanceGateway): só consentimentos ATIVO; CONTAS -> contas e transações;
  CARTOES -> faturas; CREDITO -> operações de crédito; INVESTIMENTOS -> posições custodiadas
  (instituicaoId) na instituição. Instituição "visível" = tem consentimento ATIVO.
- Janela de custo/cartão/movimentação/contas recorrentes: últimos 3 meses completos antes da ref.
  Renda: últimos 6 meses completos.
- Renda: por contraparteDocumento, total por mês; é recorrente se ≥ 3 meses distintos com total
  a ±15% da mediana dos totais mensais; valorMensal = mediana; diaDoMes = mediana dos dias.
- "FATURA CARTAO <X>": X é casado com a palavra do nome da instituição (sem acento); havendo
  mais de uma, prefere a que começa com "BANCO".
- RESERVA_INSUFICIENTE usa a reserva já arredondada a 1 casa (HALF_EVEN).
- Concentração ALTA se exposição > 35% ou se algum emissor EMPRESA compõe a exposição.
"""
import argparse
import json
import os
import sys
import unicodedata
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_EVEN

D0 = Decimal("0")
CFG = dict(
    fgc_limite=Decimal("250000"), fgc_teto=Decimal("1000000"),
    pesos=dict(renda=Decimal("0.30"), movimentacao=Decimal("0.20"), contasRecorrentes=Decimal("0.15"),
               investimentos=Decimal("0.15"), cartao=Decimal("0.10"), credito=Decimal("0.10")),
    score_min_principal=Decimal("40"), renda_meses_min=3, renda_tol=Decimal("0.15"),
    saldo_parado_mult=Decimal("1"), saldo_parado_min=Decimal("10000"), renda_fora_cap_min=Decimal("2000"),
    expo_max=Decimal("0.20"), expo_alta=Decimal("0.35"), venc_dias=30, cons_dias=15, evento_dias=7,
    reserva_alvo=Decimal("6"),
    p=dict(fgc_base=35, fgc_por_20k=1, fgc_max=25, fgc_teto=10, conc_base=15, conc_alta=10, venc_base=15,
           venc_por_50k=1, venc_max=10, saldo_base=10, saldo_por_10k=1, saldo_max=10, renda_fora=10,
           cons=10, reserva=8, evento=8, bonus_so_inv=5),
)
FGC_PRODUTOS = {"CDB", "RDB", "LCI", "LCA", "LC", "POUPANCA"}
SEM_GARANTIA = {"DEBENTURE", "CRI", "CRA"}
RECORRENTES = {"CONDOMINIO", "ALUGUEL", "ENERGIA", "AGUA", "INTERNET", "TELEFONE", "PLANO DE SAUDE", "ESCOLA",
               "ACADEMIA"}
COMPONENTES = ["renda", "movimentacao", "contasRecorrentes", "investimentos", "cartao", "credito"]


def q2(x):
    return Decimal(x).quantize(Decimal("0.01"), ROUND_HALF_EVEN)


def q1(x):
    return Decimal(x).quantize(Decimal("0.1"), ROUND_HALF_EVEN)


def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").upper()


def mediana(vals):
    v = sorted(vals)
    n = len(v)
    if n % 2:
        return Decimal(v[n // 2])
    return (Decimal(v[n // 2 - 1]) + Decimal(v[n // 2])) / 2


ARQUIVOS = ["instituicoes", "emissores", "clientes", "consentimentos", "contas", "transacoes", "faturas", "creditos",
            "investimentos"]


def _decimal(x):
    """Cópia profunda com todo número (exceto bool) como Decimal — como o BigDecimal do Java."""
    if isinstance(x, dict):
        return {k: _decimal(v) for k, v in x.items()}
    if isinstance(x, list):
        return [_decimal(v) for v in x]
    if isinstance(x, bool) or x is None or isinstance(x, (str, Decimal)):
        return x
    if isinstance(x, (int, float)):
        return Decimal(str(x))
    return x


class Base(object):
    """Seed carregado (somente leitura). Use Base.carregar(pasta, ref) ou Base.de_dados(dict, ref)."""

    @classmethod
    def carregar(cls, pasta, ref):
        dados = {}
        for n in ARQUIVOS:
            with open(os.path.join(pasta, n + ".json"), encoding="utf-8") as f:
                dados[n] = json.load(f, parse_float=Decimal, parse_int=Decimal)
        return cls(dados, ref)

    @classmethod
    def de_dados(cls, dados, ref):
        return cls(_decimal(dados), ref)

    def __init__(self, dados, ref):
        self.ref = ref
        self.inst = {i["id"]: i for i in dados["instituicoes"]}
        self.emi = {e["id"]: e for e in dados["emissores"]}
        self.clientes = dados["clientes"]
        self.cli = {c["id"]: c for c in self.clientes}
        self.cons = dados["consentimentos"]
        self.contas = dados["contas"]
        self.tx = dados["transacoes"]
        self.faturas = dados["faturas"]
        self.creditos = dados["creditos"]
        self.invs = dados["investimentos"]
        self.conta_by_id = {c["id"]: c for c in self.contas}
        base = ref.year * 12 + ref.month - 1
        self.meses6 = ["%04d-%02d" % ((base - k) // 12, (base - k) % 12 + 1) for k in range(6, 0, -1)]
        self.meses3 = self.meses6[3:]

    def banco_cartao(self, token):
        cand = [i for i in self.inst.values() if token in sem_acento(i["nome"]).split()]
        cand.sort(key=lambda i: (not sem_acento(i["nome"]).startswith("BANCO"), i["id"]))
        return cand[0]["id"] if cand else None


def categorizar(t, cpf):
    """§7.1 — regras em ordem; a primeira que casa vence."""
    d = t["descricao"]
    if t.get("contraparteDocumento") == cpf:
        return "TRANSFERENCIA_PROPRIA"
    if d.startswith("APLICACAO"):
        return "APLICACAO"
    if d.startswith("RESGATE"):
        return "RESGATE"
    if "FATURA CARTAO" in d:
        return "PAGAMENTO_FATURA"
    if "PARCELA" in d:
        return "PARCELA_CREDITO"
    if t["tipo"] == "DEBITO" and (t["modalidade"] in ("BOLETO", "DEBITO_AUTOMATICO") or d in RECORRENTES):
        return "CONTA_RECORRENTE"
    if t["tipo"] == "CREDITO":
        return "CREDITO_CANDIDATO_RENDA"
    return "CONSUMO"


def pontos(a):
    """§7.9 — pontos de um alerta (dict com tipo, sev, valor)."""
    P = CFG["p"]
    t = a["tipo"]
    if t == "FGC_EXCEDIDO":
        pts = P["fgc_base"] + min(Decimal(P["fgc_max"]), a["valor"] / 20000 * P["fgc_por_20k"])
    elif t == "FGC_TETO_GLOBAL":
        pts = Decimal(P["fgc_teto"])
    elif t == "CONCENTRACAO_EMISSOR":
        pts = Decimal(P["conc_base"] + (P["conc_alta"] if a["sev"] == "ALTA" else 0))
    elif t == "VENCIMENTO_PROXIMO":
        pts = P["venc_base"] + min(Decimal(P["venc_max"]), a["valor"] / 50000 * P["venc_por_50k"])
    elif t == "SALDO_PARADO":
        pts = P["saldo_base"] + min(Decimal(P["saldo_max"]), a["valor"] / 10000 * P["saldo_por_10k"])
    elif t == "RENDA_FORA_XP":
        pts = Decimal(P["renda_fora"])
    elif t == "CONSENTIMENTO_EXPIRANDO":
        pts = Decimal(P["cons"])
    elif t == "RESERVA_INSUFICIENTE":
        pts = Decimal(P["reserva"])
    elif t == "EVENTO_VIDA_PROXIMO":
        pts = Decimal(P["evento"])
    else:
        pts = D0
    return q2(pts)


class Analise(object):
    """Tudo calculado a partir do que o gateway expõe (consentimentos ATIVO + escopo)."""

    def __init__(self, b, cid, conceder=()):
        self.b, self.ref = b, b.ref
        self.c = b.cli[cid]
        self.cid = cid
        esc = {}
        for k in b.cons:
            if k["clienteId"] != cid:
                continue
            if k["status"] == "ATIVO" or (k["status"] == "PENDENTE" and k["instituicaoId"] in conceder):
                esc[k["instituicaoId"]] = set(k["escopos"])
        self.esc = esc
        self.consents = [k for k in b.cons if k["clienteId"] == cid]
        self.visiveis = set(esc)
        has = lambda inst, e: e in esc.get(inst, ())  # noqa: E731
        self.contas = [c for c in b.contas if c["clienteId"] == cid and has(c["instituicaoId"], "CONTAS")]
        ids = {c["id"] for c in self.contas}
        self.tx = [dict(t) for t in b.tx if t["contaId"] in ids]  # cópias: a análise anota campos _*
        self.faturas = [f for f in b.faturas if f["clienteId"] == cid and has(f["instituicaoId"], "CARTOES")]
        self.creditos = [f for f in b.creditos if f["clienteId"] == cid and has(f["instituicaoId"], "CREDITO")]
        self.invs = [p for p in b.invs if p["clienteId"] == cid and has(p["instituicaoId"], "INVESTIMENTOS")]
        self.cartoes_visiveis = {i for i, e in esc.items() if "CARTOES" in e}
        self._categorizar()
        self._renda()
        self._fluxo()
        self._principalidade()
        self._alertas()
        self._prioridade()
        self._jornada()

    # §7.1
    def _categorizar(self):
        cpf = self.c["cpf"]
        for t in self.tx:
            t["_inst"] = self.b.conta_by_id[t["contaId"]]["instituicaoId"]
            t["_mes"] = t["data"][:7]
            t["_cat"] = categorizar(t, cpf)
            t["_cartao"] = None
            if t["_cat"] == "PAGAMENTO_FATURA":
                resto = t["descricao"].split("FATURA CARTAO", 1)[1].split()
                t["_cartao"] = self.b.banco_cartao(resto[0]) if resto else None

    # §7.2
    def _renda(self):
        grupos = {}
        for t in self.tx:
            if t["_cat"] != "CREDITO_CANDIDATO_RENDA" or t["_mes"] not in self.b.meses6:
                continue
            g = grupos.setdefault(t.get("contraparteDocumento") or ("?" + t["descricao"]), dict(m={}, dias=[], inst={}, nome=None))
            g["m"][t["_mes"]] = g["m"].get(t["_mes"], D0) + t["valor"]
            g["dias"].append(int(t["data"][8:10]))
            g["inst"][t["_inst"]] = g["inst"].get(t["_inst"], D0) + t["valor"]
            g["nome"] = t.get("contraparteNome") or t["descricao"]
        fontes = []
        for doc, g in grupos.items():
            med = mediana(list(g["m"].values()))
            ok = [m for m, v in g["m"].items() if abs(v - med) <= CFG["renda_tol"] * med]
            if len(ok) >= CFG["renda_meses_min"]:
                inst = max(g["inst"].items(), key=lambda kv: kv[1])[0]
                fontes.append(dict(pagadorNome=g["nome"], instituicaoId=inst, valorMensal=q2(med),
                                   diaDoMes=int(mediana(g["dias"]))))
        fontes.sort(key=lambda f: -f["valorMensal"])
        self.fontes = fontes
        self.renda = sum((f["valorMensal"] for f in fontes), D0)

    # §7.3
    def _fluxo(self):
        tot = {}
        proxy = set()
        for t in self.tx:
            if t["_mes"] not in self.b.meses3 or t["tipo"] != "DEBITO":
                continue
            cat = t["_cat"]
            if cat in ("CONTA_RECORRENTE", "PARCELA_CREDITO", "CONSUMO"):
                tot[cat] = tot.get(cat, D0) + t["valor"]
            elif cat == "PAGAMENTO_FATURA" and t["_cartao"] not in self.cartoes_visiveis:
                tot["FATURA_PROXY"] = tot.get("FATURA_PROXY", D0) + t["valor"]
                proxy.add(t["_cartao"])
        fat = sum((f["valorTotal"] for f in self.faturas if f["mesReferencia"] in self.b.meses3), D0)
        if fat:
            tot["FATURA_VISIVEL"] = fat
        self.custo_cat = {k: q2(v / 3) for k, v in tot.items()}
        self.custo = q2(sum(tot.values(), D0) / 3)
        self.parcial = bool(proxy)
        self.proxy = proxy
        self.capacidade = self.renda - self.custo
        self.saldos = sum((c["saldo"] for c in self.contas), D0)
        self.liquidez = self.saldos + sum((p["valorAtual"] for p in self.invs if p["liquidezDiaria"]), D0)
        self.reserva = q1(self.liquidez / self.custo) if self.custo > 0 else None
        self.saldo_parado = self.saldos - CFG["saldo_parado_mult"] * self.custo

    # §7.4
    def _principalidade(self):
        part = {i: dict((k, D0) for k in COMPONENTES) for i in self.visiveis}
        for f in self.fontes:
            part.setdefault(f["instituicaoId"], dict((k, D0) for k in COMPONENTES))
            part[f["instituicaoId"]]["renda"] += f["valorMensal"]
        for t in self.tx:
            if t["_mes"] not in self.b.meses3 or t["tipo"] != "DEBITO":
                continue
            if t["_cat"] not in ("TRANSFERENCIA_PROPRIA", "APLICACAO"):
                part[t["_inst"]]["movimentacao"] += t["valor"]
            if t["_cat"] in ("CONTA_RECORRENTE", "PARCELA_CREDITO"):
                part[t["_inst"]]["contasRecorrentes"] += t["valor"]
        for p in self.invs:
            part[p["instituicaoId"]]["investimentos"] += p["valorAtual"]
        for f in self.faturas:
            if f["mesReferencia"] in self.b.meses3:
                part[f["instituicaoId"]]["cartao"] += f["valorTotal"]
        for cr in self.creditos:
            part[cr["instituicaoId"]]["credito"] += cr["saldoDevedor"]
        totais = {k: sum((part[i][k] for i in part), D0) for k in COMPONENTES}
        disp = [k for k in COMPONENTES if totais[k] > 0]
        soma_pesos = sum((CFG["pesos"][k] for k in disp), D0)
        scores = {}
        for i, p in part.items():
            shares = {k: (p[k] / totais[k] if totais[k] > 0 else D0) for k in COMPONENTES}
            contrib = {k: (100 * CFG["pesos"][k] * shares[k] / soma_pesos if k in disp else D0) for k in COMPONENTES}
            scores[i] = dict(score=sum(contrib.values(), D0), shares=shares, contrib=contrib)
        self.scores = scores
        principal = max(scores, key=lambda i: (q2(scores[i]["score"]), scores[i]["shares"]["renda"], i == "inst-xp"))
        self.principal = principal
        xp = scores.get("inst-xp")
        if xp is None or all(v == 0 for v in xp["shares"].values()):
            pos = "AUSENTE"
        elif all(xp["shares"][k] == 0 for k in COMPONENTES if k != "investimentos"):
            # vem antes de PRINCIPAL: quem só tem investimentos visíveis (ex.: só a XP conectada, sem conta)
            # não é "XP principal" — a XP não vê renda nem pagamentos dele.
            pos = "SO_INVESTIMENTOS"
        elif principal == "inst-xp" and xp["score"] >= CFG["score_min_principal"]:
            pos = "PRINCIPAL"
        else:
            pos = "SECUNDARIA"
        self.posicao_xp = pos

    # §7.5–7.7
    def _alertas(self):
        b = self.b
        al = []
        # FGC por conglomerado do emissor (conta CORRENTE: conglomerado da instituição)
        fgc = {}
        for c in self.contas:
            if c["tipo"] == "CORRENTE" and not b.inst[c["instituicaoId"]]["ehXp"]:
                cg = b.inst[c["instituicaoId"]]["conglomeradoId"]
                fgc[cg] = fgc.get(cg, D0) + c["saldo"]
        emis_cong = {}
        for p in self.invs:
            if p["produto"] in FGC_PRODUTOS and p.get("emissorId"):
                cg = b.emi[p["emissorId"]]["conglomeradoId"]
                fgc[cg] = fgc.get(cg, D0) + p["valorAtual"]
                emis_cong.setdefault(cg, set()).add(p["emissorId"])
        self.fgc = fgc
        self.fgc_excesso = {}
        for cg, v in sorted(fgc.items()):
            exc = max(D0, v - CFG["fgc_limite"])
            if exc > 0:
                self.fgc_excesso[cg] = exc
                al.append(dict(tipo="FGC_EXCEDIDO", sev="ALTA", valor=exc, chave=cg))
        if sum(fgc.values(), D0) > CFG["fgc_teto"]:
            al.append(dict(tipo="FGC_TETO_GLOBAL", sev="MEDIA", valor=sum(fgc.values(), D0), chave=None))
        # Exposição sem garantia por conglomerado do emissor
        self.patrimonio = sum((p["valorAtual"] for p in self.invs), D0) + self.saldos
        expo, empresa = {}, {}
        for p in self.invs:
            if p["produto"] in SEM_GARANTIA and p.get("emissorId"):
                e = b.emi[p["emissorId"]]
                expo[e["conglomeradoId"]] = expo.get(e["conglomeradoId"], D0) + p["valorAtual"]
                if e["tipo"] == "EMPRESA":
                    empresa[e["conglomeradoId"]] = True
        for cg, exc in self.fgc_excesso.items():
            expo[cg] = expo.get(cg, D0) + exc
            if any(b.emi[e]["tipo"] == "EMPRESA" for e in emis_cong.get(cg, ())):
                empresa[cg] = True
        self.exposicao = {cg: (v, (v / self.patrimonio if self.patrimonio else D0)) for cg, v in expo.items()}
        for cg, (v, pct) in sorted(self.exposicao.items()):
            if pct > CFG["expo_max"]:
                sev = "ALTA" if (pct > CFG["expo_alta"] or empresa.get(cg)) else "MEDIA"
                al.append(dict(tipo="CONCENTRACAO_EMISSOR", sev=sev, valor=v, pct=pct, chave=cg))
        # Vencimento
        for p in self.invs:
            if p.get("vencimento"):
                dd = (date.fromisoformat(p["vencimento"]) - self.ref).days
                if 0 <= dd <= CFG["venc_dias"]:
                    al.append(dict(tipo="VENCIMENTO_PROXIMO", sev="MEDIA", valor=p["valorAtual"], chave=p["id"], dias=dd))
        # Saldo parado
        if self.custo > 0 and self.saldo_parado >= CFG["saldo_parado_min"]:
            al.append(dict(tipo="SALDO_PARADO", sev="MEDIA", valor=self.saldo_parado, chave=None))
        # Renda fora da XP
        if self.fontes and self.fontes[0]["instituicaoId"] != "inst-xp" and self.capacidade >= CFG["renda_fora_cap_min"]:
            al.append(dict(tipo="RENDA_FORA_XP", sev="BAIXA", valor=self.fontes[0]["valorMensal"],
                           chave=self.fontes[0]["instituicaoId"]))
        # Consentimento expirando (só ATIVO com expiraEm)
        for k in self.consents:
            if k["status"] == "ATIVO" and k.get("expiraEm"):
                dd = (date.fromisoformat(k["expiraEm"]) - self.ref).days
                if dd <= CFG["cons_dias"]:
                    al.append(dict(tipo="CONSENTIMENTO_EXPIRANDO", sev="MEDIA", valor=None, chave=k["instituicaoId"], dias=dd))
        # Evento de vida (aniversário de dependente ou evento) em ≤ 7 dias
        for dp in self.c["dependentes"]:
            n = date.fromisoformat(dp["dataNascimento"])
            for ano in (self.ref.year, self.ref.year + 1):
                try:
                    a = date(ano, n.month, n.day)
                except ValueError:
                    a = date(ano, 2, 28)
                if a >= self.ref:
                    break
            dd = (a - self.ref).days
            if dd <= CFG["evento_dias"]:
                al.append(dict(tipo="EVENTO_VIDA_PROXIMO", sev="BAIXA", valor=None, chave=dp["nome"], dias=dd))
        for ev in self.c["eventosVida"]:
            dd = (date.fromisoformat(ev["data"]) - self.ref).days
            if 0 <= dd <= CFG["evento_dias"]:
                al.append(dict(tipo="EVENTO_VIDA_PROXIMO", sev="BAIXA", valor=None, chave=ev["id"], dias=dd))
        # Reserva
        if self.reserva is not None and self.reserva < CFG["reserva_alvo"]:
            al.append(dict(tipo="RESERVA_INSUFICIENTE", sev="MEDIA", valor=self.reserva, chave=None))
        self.alertas = al

    # §7.9
    def _prioridade(self):
        P = CFG["p"]
        mot = [(a["tipo"], pontos(a)) for a in self.alertas]
        if self.posicao_xp == "SO_INVESTIMENTOS":
            mot.append(("BONUS_SO_INVESTIMENTOS", Decimal(P["bonus_so_inv"])))
        self.motivos = mot
        self.prioridade = min(Decimal(100), sum((p for _, p in mot), D0))

    # §7.10
    def _jornada(self):
        decl = [d["instituicaoId"] for d in self.c["instituicoesDeclaradas"]]
        con = [i for i in decl if i in self.visiveis or i == "inst-xp"]
        self.completude = Decimal(len(con)) / len(decl)
        if self.completude < Decimal("0.5"):
            self.nivel = 1
        elif self.completude < 1:
            self.nivel = 2
        elif self.posicao_xp == "PRINCIPAL":
            self.nivel = 4
        else:
            self.nivel = 3

    def tipos(self):
        return sorted({a["tipo"] for a in self.alertas})

    def alerta(self, tipo):
        return [a for a in self.alertas if a["tipo"] == tipo]


# ----------------------------------------------------------------------------------------------
def brl(v):
    if v is None:
        return "-"
    s = "{:,.2f}".format(Decimal(v)).replace(",", "X").replace(".", ",").replace("X", ".")
    return "R$ " + s


def imprimir(a, titulo):
    b = a.b
    print("\n" + "=" * 100)
    print("%s — %s (%s)  visíveis: %s" % (titulo, a.c["nome"], a.cid, ", ".join(sorted(a.visiveis))))
    print("-" * 100)
    print("Renda mensal: %s" % brl(a.renda))
    for f in a.fontes:
        print("   fonte: %-40s %-16s %s  dia %d" % (f["pagadorNome"], f["instituicaoId"], brl(f["valorMensal"]), f["diaDoMes"]))
    print("Custo de vida: %s%s" % (brl(a.custo), "  (PARCIAL: fatura paga usada como proxy para %s)" % ", ".join(sorted(a.proxy)) if a.parcial else ""))
    for k, v in sorted(a.custo_cat.items()):
        print("   %-20s %s" % (k, brl(v)))
    print("Capacidade de aporte: %s" % brl(a.capacidade))
    for c in a.contas:
        print("Saldo %-14s %-9s %s" % (c["instituicaoId"], c["tipo"], brl(c["saldo"])))
    print("Saldo total: %s · saldo parado (saldos − 1×custo): %s" % (brl(a.saldos), brl(a.saldo_parado)))
    print("Liquidez imediata: %s · reserva: %s meses" % (brl(a.liquidez), a.reserva))
    print("Patrimônio visível: %s" % brl(a.patrimonio))
    print("FGC por conglomerado (elegíveis):")
    for cg, v in sorted(a.fgc.items()):
        print("   %-16s %18s  excesso %s" % (cg, brl(v), brl(max(D0, v - CFG["fgc_limite"]))))
    print("   total elegível %s" % brl(sum(a.fgc.values(), D0)))
    print("Exposição sem garantia:")
    for cg, (v, pct) in sorted(a.exposicao.items()):
        print("   %-16s %18s  %.2f%%" % (cg, brl(v), pct * 100))
    print("Principalidade: principal=%s posicaoXp=%s" % (a.principal, a.posicao_xp))
    for i, sc in sorted(a.scores.items(), key=lambda kv: -kv[1]["score"]):
        print("   %-16s score %6.2f  part %s" % (i, sc["score"], " ".join("%s=%.3f" % (k[:5], sc["shares"][k]) for k in COMPONENTES)))
    print("Alertas:")
    for al in a.alertas:
        extra = ""
        if "pct" in al:
            extra = " (%.2f%%)" % (al["pct"] * 100)
        if "dias" in al:
            extra += " em %d dias" % al["dias"]
        print("   %-24s %-5s valor=%s chave=%s%s" % (al["tipo"], al["sev"], al["valor"] if al["valor"] is not None else "-", al["chave"], extra))
    print("Prioridade: %s  motivos: %s" % (q1(a.prioridade) if a.prioridade == a.prioridade.quantize(Decimal("0.1")) else a.prioridade,
                                          " + ".join("%s %s" % (t, p) for t, p in a.motivos)))
    print("Completude: %.0f%% · nível %d" % (a.completude * 100, a.nivel))


# Expectativas do §6.5 (e números derivados do §6.3/§7)
ESPERADOS = [
    ("cli-001", (), dict(principal="inst-aurora", posicaoXp="SO_INVESTIMENTOS", renda=38000, custo=24000,
                         saldoParado=61000, reserva="6.5", nivel=2, prioridade="39.1",
                         alertas=["EVENTO_VIDA_PROXIMO", "RENDA_FORA_XP", "SALDO_PARADO"])),
    ("cli-001", ("inst-horizonte",), dict(principal="inst-aurora", posicaoXp="SO_INVESTIMENTOS", custo=24000,
                                          nivel=3, prioridade="100", fgc={"cong-horizonte": 400000},
                                          conc={"cong-horizonte": ("MEDIA", "0.245")},
                                          alertas=["CONCENTRACAO_EMISSOR", "EVENTO_VIDA_PROXIMO", "FGC_EXCEDIDO",
                                                   "RENDA_FORA_XP", "SALDO_PARADO"])),
    ("cli-002", (), dict(principal="inst-xp", posicaoXp="PRINCIPAL", renda=25000, custo=13600, nivel=4,
                         prioridade="29.8", venc=240000,
                         alertas=["CONSENTIMENTO_EXPIRANDO", "VENCIMENTO_PROXIMO"])),
    ("cli-003", (), dict(principal="inst-ipe", posicaoXp="SO_INVESTIMENTOS", renda=14000, custo=9000,
                         saldoParado=13000, reserva="3.0", nivel=2, prioridade="34.3", parcial=True,
                         alertas=["RENDA_FORA_XP", "RESERVA_INSUFICIENTE", "SALDO_PARADO"])),
    ("cli-003", ("inst-aurora",), dict(custo=9000, parcial=False, nivel=3)),
    ("cli-004", (), dict(principal="inst-aurora", posicaoXp="SO_INVESTIMENTOS", renda=8500, custo=4000, nivel=3,
                         prioridade="54", fgc={"cong-aurora": 80000},
                         alertas=["FGC_EXCEDIDO", "RENDA_FORA_XP"])),
    ("cli-005", (), dict(principal="inst-ipe", posicaoXp="SO_INVESTIMENTOS", renda=20000, custo=19000, nivel=3,
                         prioridade="30", conc={"cong-agrosul": ("ALTA", "0.444")},
                         alertas=["CONCENTRACAO_EMISSOR"])),
    ("cli-006", (), dict(principal="inst-xp", posicaoXp="PRINCIPAL", renda=22000, custo=12500, nivel=4,
                         prioridade="0", alertas=[])),
]


def comparar(a, exp):
    """Compara uma Analise com uma linha de ESPERADOS. Devolve [(nome, ok, obtido, esperado)]."""
    cid = a.cid
    r = []

    def chk(nome, obtido, esperado):
        r.append((cid + " " + nome, obtido == esperado, obtido, esperado))

    if "principal" in exp:
        chk("principal", a.principal, exp["principal"])
    if "posicaoXp" in exp:
        chk("posicaoXp", a.posicao_xp, exp["posicaoXp"])
    if "renda" in exp:
        chk("renda", a.renda, Decimal(exp["renda"]))
    if "custo" in exp:
        chk("custo de vida", a.custo, Decimal(exp["custo"]))
    if "parcial" in exp:
        chk("fluxo parcial", a.parcial, exp["parcial"])
    if "saldoParado" in exp:
        sp = a.alerta("SALDO_PARADO")
        chk("SALDO_PARADO valor", sp[0]["valor"] if sp else None, Decimal(exp["saldoParado"]))
    if "reserva" in exp:
        chk("reserva (meses)", a.reserva, Decimal(exp["reserva"]))
    if "fgc" in exp:
        chk("FGC_EXCEDIDO", {x["chave"]: x["valor"] for x in a.alerta("FGC_EXCEDIDO")},
            {k: Decimal(v) for k, v in exp["fgc"].items()})
    if "conc" in exp:
        chk("CONCENTRACAO_EMISSOR",
            {x["chave"]: (x["sev"], str(q1(x["pct"] * 100) / 100)) for x in a.alerta("CONCENTRACAO_EMISSOR")},
            exp["conc"])
    if "venc" in exp:
        chk("VENCIMENTO_PROXIMO valor", [x["valor"] for x in a.alerta("VENCIMENTO_PROXIMO")], [Decimal(exp["venc"])])
    if "alertas" in exp:
        chk("conjunto de alertas", a.tipos(), sorted(exp["alertas"]))
    if "nivel" in exp:
        chk("nível", a.nivel, exp["nivel"])
    if "prioridade" in exp:
        chk("prioridade", a.prioridade, Decimal(exp["prioridade"]))
    return r


def proximo_aniversario(nasc, ref):
    for ano in (ref.year, ref.year + 1):
        try:
            d = date(ano, nasc.month, nasc.day)
        except ValueError:
            d = date(ano, 2, 28)
        if d >= ref:
            return d


def problemas_fundo(b, c, a):
    """Restrições do §6.4 para um cliente de fundo (com a visão dada pela Analise a)."""
    ref, cid = b.ref, c["id"]
    probs = []
    if a.saldos > a.custo:
        probs.append("saldo %s > custo %s" % (a.saldos, a.custo))
    if a.liquidez < 6 * a.custo:
        probs.append("liquidez < 6x custo")
    bad = [t for t in a.tipos() if t != "RENDA_FORA_XP"]
    if bad:
        probs.append("alertas %s" % bad)
    if any(v > CFG["fgc_limite"] for v in a.fgc.values()) or sum(a.fgc.values(), D0) > CFG["fgc_teto"]:
        probs.append("FGC")
    if any(p > CFG["expo_max"] for _, p in a.exposicao.values()):
        probs.append("exposição")
    if a.parcial:
        probs.append("fluxo parcial")
    if not a.fontes:
        probs.append("sem renda detectada")
    if a.prioridade > 15:
        probs.append("prioridade %s > 15" % a.prioridade)
    if not 1 <= len(c["instituicoesDeclaradas"]) <= 3:
        probs.append("%d instituições" % len(c["instituicoesDeclaradas"]))
    for k in b.cons:
        if k["clienteId"] == cid and k.get("expiraEm") and \
                (date.fromisoformat(k["expiraEm"]) - ref).days <= CFG["cons_dias"]:
            probs.append("consentimento expirando")
    for p in b.invs:
        if p["clienteId"] == cid and p.get("vencimento") and \
                (date.fromisoformat(p["vencimento"]) - ref).days <= CFG["venc_dias"]:
            probs.append("vencimento <= 30d")
    for dp in c["dependentes"]:
        if (proximo_aniversario(date.fromisoformat(dp["dataNascimento"]), ref) - ref).days <= CFG["evento_dias"]:
            probs.append("aniversário de dependente em 7 dias")
    return probs


def checar_fundo(b):
    """Valida os clientes de fundo como estão e com todos os pendentes concedidos."""
    r = dict(problemas={}, max_prioridade=D0, renda_na_xp=0, distribuicao={}, linhas=[])
    for c in b.clientes:
        if c["ancora"]:
            continue
        cid = c["id"]
        pend = tuple(k["instituicaoId"] for k in b.cons if k["clienteId"] == cid and k["status"] == "PENDENTE")
        for conc in ((), pend) if pend else ((),):
            a = Analise(b, cid, conc)
            probs = problemas_fundo(b, c, a)
            tag = cid + ("+pendentes" if conc else "")
            if probs:
                r["problemas"][tag] = probs
            if not conc:
                r["max_prioridade"] = max(r["max_prioridade"], a.prioridade)
                r["distribuicao"][a.posicao_xp] = r["distribuicao"].get(a.posicao_xp, 0) + 1
                if a.fontes and a.fontes[0]["instituicaoId"] == "inst-xp":
                    r["renda_na_xp"] += 1
                r["linhas"].append((c, a, probs))
    return r


def fila(b, conceder_marina):
    """Fila ordenada [(prioridade, clienteId, Analise)] — desempate por id."""
    itens = []
    for c in b.clientes:
        conc = ("inst-horizonte",) if (conceder_marina and c["id"] == "cli-001") else ()
        a = Analise(b, c["id"], conc)
        itens.append((a.prioridade, c["id"], a))
    itens.sort(key=lambda x: (-x[0], x[1]))
    return itens


FILA_ESPERADA = [("cli-004", "54"), ("cli-001", "39.1"), ("cli-003", "34.3"), ("cli-005", "30"),
                 ("cli-002", "29.8"), ("cli-006", "0")]


def main():
    ap = argparse.ArgumentParser(description="Checa o seed contra o PLAN §6.5 / §6.4.")
    ap.add_argument("--seed", default="backend/src/main/resources/seed")
    ap.add_argument("--data-referencia", default="2026-10-10")
    args = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ref = date.fromisoformat(args.data_referencia)
    b = Base.carregar(args.seed, ref)
    falhas = []

    def check(nome, ok, obtido, esperado):
        print("  [%s] %-48s obtido=%s esperado=%s" % ("OK" if ok else "FAIL", nome, obtido, esperado))
        if not ok:
            falhas.append(nome)

    for cid, conc, exp in ESPERADOS:
        a = Analise(b, cid, conc)
        imprimir(a, cid + (" DEPOIS de conceder " + ",".join(conc) if conc else " ANTES"))
        print("Checagens §6.5:")
        for linha in comparar(a, exp):
            check(*linha)

    print("\n" + "=" * 100)
    print("CLIENTES DE FUNDO (§6.4)")
    print("-" * 100)
    fundo = [c["id"] for c in b.clientes if not c["ancora"]]
    check("30 clientes de fundo cli-101..cli-130", fundo == ["cli-%03d" % i for i in range(101, 131)], len(fundo), 30)
    r = checar_fundo(b)
    for c, a, probs in r["linhas"]:
        print("  %-8s %-22s inst %d renda %9s custo %9s saldo %9s reserva %6s posXp %-16s prio %5s %s" % (
            c["id"], c["nome"][:22], len(c["instituicoesDeclaradas"]), a.renda, a.custo, a.saldos, a.reserva,
            a.posicao_xp, a.prioridade, ("FAIL: " + "; ".join(probs)) if probs else "ok"))
    print("  distribuição posicaoXp: %s · renda na XP: %d/30" % (r["distribuicao"], r["renda_na_xp"]))
    check("fundo: restrições §6.4 (também com pendentes concedidos)", not r["problemas"], r["problemas"], {})
    check("fundo: prioridade máxima <= 15", r["max_prioridade"] <= 15, r["max_prioridade"], "<= 15")
    check("fundo: ~20% com renda na XP", r["renda_na_xp"] == 6, r["renda_na_xp"], 6)

    antes, depois = fila(b, False), fila(b, True)
    for nome, f in (("ANTES", antes), ("DEPOIS (Marina concede inst-horizonte)", depois)):
        print("\nFila %s — top 8:" % nome)
        for pos, (p, cid, a) in enumerate(f[:8], 1):
            print("  %d. %-8s %-20s %6s  %s" % (pos, cid, a.c["nome"][:20], p,
                                               ", ".join("%s %s" % m for m in a.motivos)))
    ordem = [(cid, p) for p, cid, _ in antes if b.cli[cid]["ancora"]]
    esperada = [(cid, Decimal(p)) for cid, p in FILA_ESPERADA]
    check("fila antes: ordem e pontos dos âncoras", ordem == esperada, ordem, esperada)
    check("fila antes: Marina NÃO é a 1ª", antes[0][1] != "cli-001", antes[0][1], "!= cli-001")
    check("fila antes: 5 primeiros são âncoras", all(b.cli[cid]["ancora"] for _, cid, _ in antes[:5]),
          [cid for _, cid, _ in antes[:5]], "âncoras")
    check("fila depois: Marina é a 1ª com 100", depois[0][1] == "cli-001" and depois[0][0] == 100,
          (depois[0][1], depois[0][0]), ("cli-001", 100))

    print("\n%s" % ("TUDO OK" if not falhas else "FALHAS: %s" % falhas))
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
