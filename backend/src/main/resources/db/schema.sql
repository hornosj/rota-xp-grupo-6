-- Esquema SQLite do Copiloto do Assessor (aplicado por RepositorioSqlite, idempotente).
-- Convenções:
--   * dinheiro e taxas em TEXT (BigDecimal.toPlainString) para não perder precisão nem escala
--   * datas em TEXT ISO-8601 (yyyy-MM-dd), enums em TEXT, booleanos em INTEGER 0/1
--   * "ordem" preserva a ordem da seed — toda leitura é ORDER BY ordem (determinismo).

CREATE TABLE IF NOT EXISTS instituicao (
    id                 TEXT PRIMARY KEY,
    nome               TEXT    NOT NULL,
    conglomerado_id    TEXT    NOT NULL,
    conglomerado_nome  TEXT,
    eh_xp              INTEGER NOT NULL CHECK (eh_xp IN (0, 1)),
    ordem              INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS emissor (
    id               TEXT PRIMARY KEY,
    nome             TEXT    NOT NULL,
    conglomerado_id  TEXT,
    tipo             TEXT    NOT NULL,
    ordem            INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cliente (
    id           TEXT PRIMARY KEY,
    nome         TEXT    NOT NULL,
    cpf          TEXT    NOT NULL,
    idade        INTEGER NOT NULL,
    profissao    TEXT,
    cidade       TEXT,
    perfil       TEXT,
    assessor_id  TEXT    NOT NULL,
    ancora       INTEGER NOT NULL CHECK (ancora IN (0, 1)),
    ordem        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cliente_instituicao_declarada (
    cliente_id      TEXT    NOT NULL REFERENCES cliente (id),
    ordem           INTEGER NOT NULL,
    instituicao_id  TEXT    NOT NULL,
    PRIMARY KEY (cliente_id, ordem)
);

CREATE TABLE IF NOT EXISTS cliente_produto_declarado (
    cliente_id   TEXT    NOT NULL,
    declaracao   INTEGER NOT NULL,
    ordem        INTEGER NOT NULL,
    produto      TEXT    NOT NULL,
    PRIMARY KEY (cliente_id, declaracao, ordem),
    FOREIGN KEY (cliente_id, declaracao) REFERENCES cliente_instituicao_declarada (cliente_id, ordem)
);

CREATE TABLE IF NOT EXISTS dependente (
    cliente_id       TEXT    NOT NULL REFERENCES cliente (id),
    ordem            INTEGER NOT NULL,
    nome             TEXT    NOT NULL,
    parentesco       TEXT,
    data_nascimento  TEXT,
    PRIMARY KEY (cliente_id, ordem)
);

-- Eventos de vida: os da seed (CADASTRO) e os criados pela nota pós-reunião (NOTA_REUNIAO).
CREATE TABLE IF NOT EXISTS evento_vida (
    seq         INTEGER PRIMARY KEY AUTOINCREMENT,
    id          TEXT NOT NULL,
    cliente_id  TEXT NOT NULL REFERENCES cliente (id),
    tipo        TEXT NOT NULL,
    descricao   TEXT,
    data        TEXT,
    origem      TEXT
);
CREATE INDEX IF NOT EXISTS ix_evento_vida_cliente ON evento_vida (cliente_id);

CREATE TABLE IF NOT EXISTS consentimento (
    id              TEXT PRIMARY KEY,
    cliente_id      TEXT    NOT NULL REFERENCES cliente (id),
    instituicao_id  TEXT    NOT NULL REFERENCES instituicao (id),
    tipo            TEXT    NOT NULL,
    status          TEXT    NOT NULL,
    concedido_em    TEXT,
    expira_em       TEXT,
    ordem           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_consentimento_cliente ON consentimento (cliente_id);

CREATE TABLE IF NOT EXISTS consentimento_escopo (
    consentimento_id  TEXT    NOT NULL REFERENCES consentimento (id),
    ordem             INTEGER NOT NULL,
    escopo            TEXT    NOT NULL,
    PRIMARY KEY (consentimento_id, ordem)
);

CREATE TABLE IF NOT EXISTS conta (
    id              TEXT PRIMARY KEY,
    cliente_id      TEXT    NOT NULL REFERENCES cliente (id),
    instituicao_id  TEXT    NOT NULL REFERENCES instituicao (id),
    tipo            TEXT    NOT NULL,
    saldo           TEXT    NOT NULL,
    ordem           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_conta_cliente ON conta (cliente_id);

CREATE TABLE IF NOT EXISTS transacao (
    id                     TEXT PRIMARY KEY,
    conta_id               TEXT    NOT NULL REFERENCES conta (id),
    data                   TEXT    NOT NULL,
    valor                  TEXT    NOT NULL,
    tipo                   TEXT    NOT NULL,
    modalidade             TEXT,
    descricao              TEXT,
    contraparte_documento  TEXT,
    contraparte_nome       TEXT,
    ordem                  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_transacao_conta ON transacao (conta_id, ordem);

CREATE TABLE IF NOT EXISTS fatura_cartao (
    id              TEXT PRIMARY KEY,
    cliente_id      TEXT    NOT NULL REFERENCES cliente (id),
    instituicao_id  TEXT    NOT NULL REFERENCES instituicao (id),
    mes_referencia  TEXT    NOT NULL,
    valor_total     TEXT    NOT NULL,
    ordem           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_fatura_cliente ON fatura_cartao (cliente_id);

CREATE TABLE IF NOT EXISTS operacao_credito (
    id              TEXT PRIMARY KEY,
    cliente_id      TEXT    NOT NULL REFERENCES cliente (id),
    instituicao_id  TEXT    NOT NULL REFERENCES instituicao (id),
    tipo            TEXT    NOT NULL,
    saldo_devedor   TEXT,
    parcela_mensal  TEXT,
    taxa_anual      TEXT,
    ordem           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_credito_cliente ON operacao_credito (cliente_id);

CREATE TABLE IF NOT EXISTS posicao_investimento (
    id               TEXT PRIMARY KEY,
    cliente_id       TEXT    NOT NULL REFERENCES cliente (id),
    instituicao_id   TEXT    NOT NULL REFERENCES instituicao (id),
    emissor_id       TEXT REFERENCES emissor (id),
    produto          TEXT    NOT NULL,
    nome             TEXT    NOT NULL,
    valor_aplicado   TEXT,
    valor_atual      TEXT    NOT NULL,
    data_aplicacao   TEXT,
    vencimento       TEXT,
    indexador        TEXT,
    taxa             TEXT,
    liquidez_diaria  INTEGER NOT NULL CHECK (liquidez_diaria IN (0, 1)),
    ordem            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_investimento_cliente ON posicao_investimento (cliente_id);

-- Primeiro instante em que cada alerta (cliente|tipo|instituicao|emissor) foi detectado (RegistroAlertas).
-- Não é dado da seed: o reset da demo limpa via RegistroAlertas, não via RepositorioSqlite.
CREATE TABLE IF NOT EXISTS registro_alerta (
    chave          TEXT PRIMARY KEY,
    instante       TEXT    NOT NULL,
    detectado_em   TEXT    NOT NULL,
    linha_de_base  INTEGER NOT NULL CHECK (linha_de_base IN (0, 1))
);
