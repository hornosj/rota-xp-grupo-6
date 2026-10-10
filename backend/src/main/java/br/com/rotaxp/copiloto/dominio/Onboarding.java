package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.ProdutoDeclarado;
import br.com.rotaxp.copiloto.dominio.Enums.TipoEventoVida;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** Onboarding do investidor: o assessor gera um convite e o investidor preenche o cadastro pelo link. */
public final class Onboarding {
    private Onboarding() {}

    public enum StatusConvite { PENDENTE, ABERTO, CONCLUIDO }

    /** link: caminho relativo do formulário no front (ex.: /onboarding/{token}). */
    public record ConviteOnboarding(
            String id, String token, String link, String nome, String assessorId, StatusConvite status,
            OffsetDateTime criadoEm, OffsetDateTime abertoEm, OffsetDateTime concluidoEm,
            String clienteId, PerfilInvestidor perfil) {

        public ConviteOnboarding aberto(OffsetDateTime quando) {
            return new ConviteOnboarding(id, token, link, nome, assessorId, StatusConvite.ABERTO, criadoEm, quando,
                    null, null, null);
        }

        public ConviteOnboarding concluido(OffsetDateTime quando, String novoClienteId, PerfilInvestidor novoPerfil) {
            return new ConviteOnboarding(id, token, link, nome, assessorId, StatusConvite.CONCLUIDO, criadoEm,
                    abertoEm == null ? quando : abertoEm, quando, novoClienteId, novoPerfil);
        }
    }

    public record NovoConviteBody(String nome) {}

    public record OpcaoSuitability(String id, String texto) {}

    public record PerguntaSuitability(String id, String texto, List<OpcaoSuitability> opcoes) {}

    public record InstituicaoDisponivel(String id, String nome) {}

    /** Tudo que o formulário precisa para ser montado. */
    public record FormularioOnboarding(
            ConviteOnboarding convite, List<InstituicaoDisponivel> instituicoes,
            List<PerguntaSuitability> questionario, List<ProdutoDeclarado> produtos) {}

    public record RespostaSuitability(String perguntaId, String opcaoId) {}

    public record InstituicaoInformada(String instituicaoId, List<ProdutoDeclarado> produtos, boolean compartilharAgora) {}

    public record EventoPlanejado(TipoEventoVida tipo, String descricao, LocalDate data) {}

    public record CadastroInvestidor(
            String nome, String cpf, LocalDate dataNascimento, String email, String celular,
            String profissao, String cidade, String uf,
            List<Cliente.Dependente> dependentes, List<EventoPlanejado> eventosVida,
            List<RespostaSuitability> respostasSuitability,
            List<InstituicaoInformada> instituicoes, boolean aceiteTermos) {}

    public record ResultadoOnboarding(
            ConviteOnboarding convite, String clienteId, PerfilInvestidor perfil, int pontuacaoSuitability,
            List<ConsentimentoView> consentimentos) {}
}
