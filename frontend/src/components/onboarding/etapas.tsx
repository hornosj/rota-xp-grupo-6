"use client";

import { Building2, Check, Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  Escopo,
  FormularioOnboarding,
  ProdutoDeclarado,
  TipoEventoVida,
} from "@/lib/api-types";
import { data } from "@/lib/formato";
import { descricaoEscopo, rotuloEscopo, rotuloProdutoDeclarado } from "@/lib/rotulos";
import { cn } from "@/lib/utils";
import { type Erros, type EstadoFormulario, mascaraCelular, mascaraCpf, UFS } from "./formulario";

export interface PropsEtapa {
  f: EstadoFormulario;
  set: (patch: Partial<EstadoFormulario>) => void;
  erros: Erros;
  formulario: FormularioOnboarding;
}

const ESCOPO: Record<ProdutoDeclarado, Escopo> = {
  CONTA: "CONTAS",
  CARTAO: "CARTOES",
  CREDITO: "CREDITO",
  INVESTIMENTOS: "INVESTIMENTOS",
};

const PARENTESCOS: Record<string, string> = {
  FILHA: "Filha",
  FILHO: "Filho",
  CONJUGE: "Cônjuge",
  MAE: "Mãe",
  PAI: "Pai",
  OUTRO: "Outro",
};

export const rotuloEvento: Record<TipoEventoVida, string> = {
  ANIVERSARIO: "Aniversário",
  CASAMENTO: "Casamento",
  NASCIMENTO: "Nascimento de filho",
  FERIAS: "Viagem ou férias",
  APOSENTADORIA: "Aposentadoria",
  MUDANCA: "Mudança",
  OUTRO: "Outro",
};

const classeCampo =
  "h-12 w-full rounded-xl border-2 border-input bg-background px-4 text-base outline-none focus-visible:border-black focus-visible:ring-3 focus-visible:ring-black/15 aria-invalid:border-destructive";

function Campo({
  id,
  rotulo,
  erro,
  dica,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-bold">
        {rotulo}
      </label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} className="text-sm font-semibold text-destructive">
          {erro}
        </p>
      ) : (
        dica && <p className="text-sm text-muted-foreground">{dica}</p>
      )}
    </div>
  );
}

/** Props de acessibilidade de um input com erro. */
const a11y = (id: string, erro?: string) => ({
  id,
  "aria-invalid": !!erro,
  "aria-describedby": erro ? `${id}-erro` : undefined,
});

function Titulo({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <div>
      <h2 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-[40px]">{titulo}</h2>
      {subtitulo && <p className="mt-2 text-lg leading-relaxed text-muted-foreground">{subtitulo}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ 0. boas-vindas

export function EtapaBoasVindas({ formulario }: PropsEtapa) {
  const primeiro = formulario.convite.nome.split(" ")[0];
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <p className="text-sm font-bold tracking-[0.12em] uppercase">Convite da sua assessoria XP</p>
        <h2 className="text-6xl leading-[0.95] font-extrabold tracking-tight sm:text-8xl">Olá, {primeiro}!</h2>
        <p className="text-xl leading-relaxed text-muted-foreground">
          Em poucos minutos montamos seu cadastro e seu perfil de investidor, para a sua assessoria cuidar do seu dinheiro
          com a visão completa. Leva cerca de 4 minutos.
        </p>
      </div>
      <ol className="flex flex-col border-t-2 border-black">
        {[
          ["Seus dados", "Nome, CPF, contato e família"],
          ["Seu perfil de investidor", "5 perguntas rápidas, sem resposta certa"],
          ["O que compartilhar", "Você escolhe quais instituições conectar pelo Open Finance"],
        ].map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[4rem_1fr] items-baseline gap-3 border-b py-5">
            <span className="text-4xl font-extrabold tracking-tight">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex flex-col gap-1">
              <span className="text-xl font-bold">{t}</span>
              <span className="text-base text-muted-foreground">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="flex items-start gap-2.5 text-base">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        Seus dados são protegidos pela LGPD. Só leitura: você decide o que compartilhar e pode revogar quando quiser.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ 1. dados pessoais

export function EtapaDados({ f, set, erros }: PropsEtapa) {
  return (
    <div className="flex flex-col gap-4">
      <Titulo titulo="Seus dados" subtitulo="Iguais aos do seu documento." />
      <Campo id="nome" rotulo="Nome completo" erro={erros.nome}>
        <input {...a11y("nome", erros.nome)} className={classeCampo} autoComplete="name" value={f.nome} onChange={(e) => set({ nome: e.target.value })} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="cpf" rotulo="CPF" erro={erros.cpf}>
          <input
            {...a11y("cpf", erros.cpf)}
            className={classeCampo}
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={f.cpf}
            onChange={(e) => set({ cpf: mascaraCpf(e.target.value) })}
          />
        </Campo>
        <Campo id="nascimento" rotulo="Data de nascimento" erro={erros.dataNascimento}>
          <input
            {...a11y("nascimento", erros.dataNascimento)}
            type="date"
            className={classeCampo}
            autoComplete="bday"
            value={f.dataNascimento}
            onChange={(e) => set({ dataNascimento: e.target.value })}
          />
        </Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="email" rotulo="E-mail" erro={erros.email}>
          <input
            {...a11y("email", erros.email)}
            type="email"
            className={classeCampo}
            autoComplete="email"
            value={f.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </Campo>
        <Campo id="celular" rotulo="Celular" erro={erros.celular} dica="É por aqui que sua assessoria vai falar com você.">
          <input
            {...a11y("celular", erros.celular)}
            type="tel"
            className={classeCampo}
            autoComplete="tel-national"
            placeholder="(11) 90000-0000"
            value={f.celular}
            onChange={(e) => set({ celular: mascaraCelular(e.target.value) })}
          />
        </Campo>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 2. profissão e cidade

export function EtapaEndereco({ f, set, erros }: PropsEtapa) {
  return (
    <div className="flex flex-col gap-4">
      <Titulo titulo="Profissão e cidade" subtitulo="Ajuda sua assessoria a entender seu momento de vida." />
      <Campo id="profissao" rotulo="Profissão" erro={erros.profissao}>
        <input
          {...a11y("profissao", erros.profissao)}
          className={classeCampo}
          autoComplete="organization-title"
          placeholder="Ex.: Médica, engenheiro, empresária"
          value={f.profissao}
          onChange={(e) => set({ profissao: e.target.value })}
        />
      </Campo>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Campo id="cidade" rotulo="Cidade" erro={erros.cidade}>
          <input
            {...a11y("cidade", erros.cidade)}
            className={classeCampo}
            autoComplete="address-level2"
            value={f.cidade}
            onChange={(e) => set({ cidade: e.target.value })}
          />
        </Campo>
        <Campo id="uf" rotulo="Estado" erro={erros.uf}>
          <select {...a11y("uf", erros.uf)} className={classeCampo} value={f.uf} onChange={(e) => set({ uf: e.target.value })}>
            <option value="">UF</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </Campo>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 3. família e planos

export function EtapaFamilia({ f, set, erros }: PropsEtapa) {
  const setDep = (i: number, patch: Partial<EstadoFormulario["dependentes"][number]>) =>
    set({ dependentes: f.dependentes.map((d, k) => (k === i ? { ...d, ...patch } : d)) });
  const setEv = (i: number, patch: Partial<EstadoFormulario["eventosVida"][number]>) =>
    set({ eventosVida: f.eventosVida.map((ev, k) => (k === i ? { ...ev, ...patch } : ev)) });

  return (
    <div className="flex flex-col gap-6">
      <Titulo
        titulo="Família e planos"
        subtitulo="Opcional. Com isso sua assessoria lembra das datas importantes e planeja junto com você."
      />

      <section className="flex flex-col gap-3">
        <h3 className="text-xl font-extrabold">Dependentes</h3>
        {f.dependentes.map((d, i) => (
          <div key={i} data-testid={`dependente-${i}`} className="flex flex-col gap-4 rounded-2xl border-2 p-5">
            <Campo id={`dep-${i}-nome`} rotulo="Nome" erro={erros[`dependentes.${i}.nome`]}>
              <input
                {...a11y(`dep-${i}-nome`, erros[`dependentes.${i}.nome`])}
                className={classeCampo}
                value={d.nome}
                onChange={(e) => setDep(i, { nome: e.target.value })}
              />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo id={`dep-${i}-parentesco`} rotulo="Parentesco" erro={erros[`dependentes.${i}.parentesco`]}>
                <select
                  {...a11y(`dep-${i}-parentesco`, erros[`dependentes.${i}.parentesco`])}
                  className={classeCampo}
                  value={d.parentesco}
                  onChange={(e) => setDep(i, { parentesco: e.target.value })}
                >
                  <option value="">Escolha</option>
                  {Object.entries(PARENTESCOS).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo id={`dep-${i}-nascimento`} rotulo="Nascimento" erro={erros[`dependentes.${i}.dataNascimento`]}>
                <input
                  {...a11y(`dep-${i}-nascimento`, erros[`dependentes.${i}.dataNascimento`])}
                  type="date"
                  className={classeCampo}
                  value={d.dataNascimento}
                  onChange={(e) => setDep(i, { dataNascimento: e.target.value })}
                />
              </Campo>
            </div>
            <Button
              variant="ghost"
              className="self-end"
              onClick={() => set({ dependentes: f.dependentes.filter((_, k) => k !== i) })}
            >
              <Trash2 /> Remover
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() => set({ dependentes: [...f.dependentes, { nome: "", parentesco: "", dataNascimento: "" }] })}
        >
          <Plus /> Adicionar dependente
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xl font-extrabold">Próximos acontecimentos</h3>
        <p className="-mt-2 text-base text-muted-foreground">Casamento, viagem, aposentadoria, mudança…</p>
        {f.eventosVida.map((ev, i) => (
          <div key={i} data-testid={`evento-${i}`} className="flex flex-col gap-4 rounded-2xl border-2 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Campo id={`ev-${i}-tipo`} rotulo="Tipo">
                <select
                  id={`ev-${i}-tipo`}
                  className={classeCampo}
                  value={ev.tipo}
                  onChange={(e) => setEv(i, { tipo: e.target.value as TipoEventoVida })}
                >
                  {Object.entries(rotuloEvento).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo id={`ev-${i}-data`} rotulo="Quando" erro={erros[`eventosVida.${i}.data`]}>
                <input
                  {...a11y(`ev-${i}-data`, erros[`eventosVida.${i}.data`])}
                  type="date"
                  className={classeCampo}
                  value={ev.data}
                  onChange={(e) => setEv(i, { data: e.target.value })}
                />
              </Campo>
            </div>
            <Campo id={`ev-${i}-descricao`} rotulo="Descrição" erro={erros[`eventosVida.${i}.descricao`]}>
              <input
                {...a11y(`ev-${i}-descricao`, erros[`eventosVida.${i}.descricao`])}
                className={classeCampo}
                placeholder="Ex.: Viagem com a família para o Japão"
                value={ev.descricao}
                onChange={(e) => setEv(i, { descricao: e.target.value })}
              />
            </Campo>
            <Button
              variant="ghost"
              className="self-end"
              onClick={() => set({ eventosVida: f.eventosVida.filter((_, k) => k !== i) })}
            >
              <Trash2 /> Remover
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() => set({ eventosVida: [...f.eventosVida, { tipo: "FERIAS", descricao: "", data: "" }] })}
        >
          <Plus /> Adicionar acontecimento
        </Button>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ 4. suitability

export function EtapaPerfil({ f, set, erros, formulario }: PropsEtapa) {
  return (
    <div className="flex flex-col gap-10">
      <Titulo
        titulo="Seu perfil de investidor"
        subtitulo="Não existe resposta certa. Responda como você realmente agiria: é isso que define quais investimentos combinam com você."
      />
      {formulario.questionario.map((p, n) => {
        const erro = erros[`perfil.${p.id}`];
        return (
          <fieldset key={p.id} className="flex flex-col gap-3" aria-invalid={!!erro}>
            <legend className="mb-3 flex flex-col gap-1">
              <span className="text-sm font-bold tracking-[0.12em] uppercase">
                Pergunta {n + 1} de {formulario.questionario.length}
              </span>
              <span className="text-2xl leading-snug font-extrabold tracking-tight">{p.texto}</span>
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {p.opcoes.map((o) => {
                const marcada = f.respostas[p.id] === o.id;
                return (
                  <label
                    key={o.id}
                    className={cn(
                      "flex min-h-16 cursor-pointer items-center gap-3.5 rounded-2xl border-2 p-4 text-[17px] transition",
                      marcada ? "border-black bg-black font-bold text-white" : "border-[#bdbdbd] hover:border-black",
                    )}
                  >
                    <input
                      type="radio"
                      name={p.id}
                      value={o.id}
                      checked={marcada}
                      onChange={() => set({ respostas: { ...f.respostas, [p.id]: o.id } })}
                      className={cn("size-5 shrink-0", marcada ? "accent-white" : "accent-black")}
                    />
                    {o.texto}
                  </label>
                );
              })}
            </div>
            {erro && <p className="text-sm font-semibold text-destructive">{erro}</p>}
          </fieldset>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ 5. instituições

export function EtapaInstituicoes({ f, set, erros, formulario }: PropsEtapa) {
  function alternar(id: string) {
    const novas = { ...f.instituicoes };
    if (novas[id]) delete novas[id];
    else novas[id] = { produtos: [], compartilharAgora: true };
    set({ instituicoes: novas });
  }
  function alternarProduto(id: string, p: ProdutoDeclarado) {
    const atual = f.instituicoes[id];
    const produtos = atual.produtos.includes(p) ? atual.produtos.filter((x) => x !== p) : [...atual.produtos, p];
    set({ instituicoes: { ...f.instituicoes, [id]: { ...atual, produtos } } });
  }

  return (
    <div className="flex flex-col gap-4">
      <Titulo
        titulo="Onde mais você tem conta?"
        subtitulo="Marque os bancos que você usa além da XP e o que tem em cada um. Se for só a XP, pode seguir."
      />
      <ul className="flex flex-col gap-3">
        {formulario.instituicoes.map((inst) => {
          const escolhida = f.instituicoes[inst.id];
          const erro = erros[`instituicoes.${inst.id}`];
          return (
            <li
              key={inst.id}
              data-testid={`instituicao-${inst.id}`}
              className={cn("rounded-2xl border-2 transition", escolhida ? "border-black" : "border-[#bdbdbd]")}
            >
              <label className="flex cursor-pointer items-center gap-3.5 p-5">
                <input
                  type="checkbox"
                  checked={!!escolhida}
                  onChange={() => alternar(inst.id)}
                  className="size-5 accent-black"
                />
                <Building2 className="size-5" />
                <span className="text-lg font-bold">{inst.nome}</span>
                {escolhida && escolhida.produtos.length > 0 && (
                  <span className="ml-auto text-sm text-muted-foreground">
                    {escolhida.produtos.length} {escolhida.produtos.length === 1 ? "produto" : "produtos"}
                  </span>
                )}
              </label>
              {escolhida && (
                <div className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <p className="shrink-0 text-base font-semibold">O que você tem lá?</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label={`Produtos no ${inst.nome}`}>
                    {formulario.produtos.map((p) => {
                      const ativo = escolhida.produtos.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => alternarProduto(inst.id, p)}
                          className={cn(
                            "inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-black px-4 text-[15px] font-semibold capitalize transition",
                            ativo ? "bg-black font-bold text-white" : "hover:bg-muted",
                          )}
                        >
                          {ativo && <Check className="size-3.5" />}
                          {rotuloProdutoDeclarado[p]}
                        </button>
                      );
                    })}
                  </div>
                  {erro && <p className="text-sm font-semibold text-destructive sm:ml-auto">{erro}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ 6. compartilhamento (espelha "Meus dados compartilhados")

/** Interruptor acessível (role="switch"), no visual de toggle. */
function Interruptor({ ligado, onChange, rotulo }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        role="switch"
        aria-label={rotulo}
        checked={ligado}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="h-8 w-14 rounded-full border-2 border-black bg-white transition peer-checked:bg-black peer-focus-visible:ring-3 peer-focus-visible:ring-black/25" />
      <span className="absolute left-1 size-6 rounded-full bg-black transition peer-checked:translate-x-6 peer-checked:bg-white" />
    </label>
  );
}

export function EtapaCompartilhamento({ f, set, formulario }: PropsEtapa) {
  const nome = (id: string) => formulario.instituicoes.find((i) => i.id === id)?.nome ?? id;
  const escolhidas = Object.entries(f.instituicoes);

  return (
    <div className="flex flex-col gap-4">
      <Titulo
        titulo="O que você quer compartilhar?"
        subtitulo="Pela LGPD e pelo Open Finance, você decide quem vê seus dados, por quanto tempo, e pode revogar quando quiser."
      />
      <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border-2 border-black">
        <li className="flex items-center gap-4 bg-muted p-5">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">XP Investimentos</p>
            <p className="mt-0.5 text-base text-muted-foreground">Plataforma XP · dados próprios</p>
          </div>
          <span className="shrink-0 rounded-full px-3 py-1 text-sm font-bold ring-1 ring-black">Sempre ativo</span>
        </li>
        {escolhidas.map(([id, inst]) => {
          const escopos = [...new Set(inst.produtos.map((p) => ESCOPO[p]))];
          return (
            <li key={id} data-testid={`compartilhar-${id}`} className="flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-[1_1_240px]">
                <p className="text-lg font-bold">{nome(id)}</p>
                <ul className="mt-1 flex flex-col gap-0.5 text-[15px] text-muted-foreground">
                  {escopos.map((e) => (
                    <li key={e}>
                      <span className="font-semibold text-foreground">{rotuloEscopo[e]}</span>: {descricaoEscopo[e]}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 items-center gap-3.5">
                <span className={cn("text-base", inst.compartilharAgora ? "font-bold" : "text-muted-foreground")}>
                  {inst.compartilharAgora ? "Agora, por 12 meses" : "Conectar depois"}
                </span>
                <Interruptor
                  ligado={inst.compartilharAgora}
                  rotulo={`Compartilhar ${nome(id)} agora`}
                  onChange={(v) => set({ instituicoes: { ...f.instituicoes, [id]: { ...inst, compartilharAgora: v } } })}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {!escolhidas.length && (
        <p className="rounded-2xl border-2 border-dashed p-4 text-base text-muted-foreground">
          Você não marcou outras instituições. Se precisar, sua assessoria pode enviar um novo link depois.
        </p>
      )}
      <p className="flex items-start gap-2.5 text-base">
        <Lock className="mt-0.5 size-5 shrink-0" />
        Só leitura: ninguém movimenta seu dinheiro. Você pode revogar o compartilhamento quando quiser.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ 7. revisão

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-base">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right font-semibold">{valor}</dd>
    </div>
  );
}

export function EtapaRevisao({ f, set, erros, formulario, irPara }: PropsEtapa & { irPara: (etapa: number) => void }) {
  const nomeInst = (id: string) => formulario.instituicoes.find((i) => i.id === id)?.nome ?? id;
  const blocos: { titulo: string; etapa: number; linhas: [string, React.ReactNode][] }[] = [
    {
      titulo: "Seus dados",
      etapa: 1,
      linhas: [
        ["Nome", f.nome],
        ["CPF", f.cpf],
        ["Nascimento", data(f.dataNascimento)],
        ["E-mail", f.email],
        ["Celular", f.celular],
      ],
    },
    { titulo: "Profissão e cidade", etapa: 2, linhas: [["Profissão", f.profissao], ["Cidade", `${f.cidade}/${f.uf}`]] },
    {
      titulo: "Família e planos",
      etapa: 3,
      linhas: [
        ["Dependentes", f.dependentes.length ? f.dependentes.map((d) => d.nome).join(", ") : "Nenhum"],
        ["Acontecimentos", f.eventosVida.length ? f.eventosVida.map((e) => e.descricao).join(", ") : "Nenhum"],
      ],
    },
    {
      titulo: "Perfil de investidor",
      etapa: 4,
      linhas: [["Respostas", `${Object.keys(f.respostas).length} de ${formulario.questionario.length}`]],
    },
    {
      titulo: "Instituições",
      etapa: 5,
      linhas: [
        ["XP Investimentos", "Ativo"],
        ...Object.entries(f.instituicoes).map(
          ([id, i]) => [nomeInst(id), i.compartilharAgora ? "Compartilhar agora" : "Conectar depois"] as [string, string],
        ),
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Titulo titulo="Confira e conclua" subtitulo="Seu perfil de investidor é calculado quando você concluir." />
      <div className="divide-y overflow-hidden rounded-2xl border-2 border-black">
        {blocos.map((b) => (
          <section key={b.titulo} className="flex flex-col gap-1 p-5 sm:flex-row sm:gap-6">
            <div className="flex items-center sm:w-48 sm:shrink-0 sm:flex-col sm:items-start sm:gap-1.5 sm:pt-2.5">
              <h3 className="text-lg font-bold">{b.titulo}</h3>
              <Button variant="link" className="ml-auto sm:ml-0" onClick={() => irPara(b.etapa)}>
                Editar
              </Button>
            </div>
            <dl className="min-w-0 flex-1 divide-y">
              {b.linhas.map(([r, v]) => (
                <Linha key={r} rotulo={r} valor={v} />
              ))}
            </dl>
          </section>
        ))}
      </div>
      <label className="flex cursor-pointer items-start gap-3.5 rounded-2xl border-2 border-[#bdbdbd] p-5 text-base leading-relaxed">
        <input
          type="checkbox"
          checked={f.aceiteTermos}
          onChange={(e) => set({ aceiteTermos: e.target.checked })}
          aria-invalid={!!erros.aceiteTermos}
          className="mt-0.5 size-5 shrink-0 accent-black"
        />
        <span>Li e aceito os termos de uso e a política de privacidade, e confirmo que as informações são verdadeiras.</span>
      </label>
      {erros.aceiteTermos && <p className="-mt-2 text-sm font-semibold text-destructive">{erros.aceiteTermos}</p>}
    </div>
  );
}
