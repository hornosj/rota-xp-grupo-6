# -*- coding: utf-8 -*-
"""Utilitários compartilhados pelos testes (importa os scripts de data/ sem efeitos colaterais)."""
import os
import sys
from datetime import date

AQUI = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.dirname(AQUI)
if DATA not in sys.path:
    sys.path.insert(0, DATA)

import gerar_seed  # noqa: E402
import checar_seed  # noqa: E402

REF = date(2026, 10, 11)
_cache = {}


def seed(ref=REF):
    """Seed gerado em memória (dicts já no formato JSON), com cache por data de referência."""
    if ref not in _cache:
        _cache[ref] = gerar_seed.gerar(ref).dados()
    return _cache[ref]


def base(ref=REF):
    return checar_seed.Base.de_dados(seed(ref), ref)


def dados_vazios():
    """Esqueleto mínimo para testes unitários das regras: instituições e emissores reais do §6.1."""
    s = seed()
    return dict(instituicoes=s["instituicoes"], emissores=s["emissores"], clientes=[], consentimentos=[],
                contas=[], transacoes=[], faturas=[], creditos=[], investimentos=[])
