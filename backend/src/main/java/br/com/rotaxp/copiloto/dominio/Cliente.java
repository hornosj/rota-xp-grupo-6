package br.com.rotaxp.copiloto.dominio;

import br.com.rotaxp.copiloto.dominio.Enums.PerfilInvestidor;
import br.com.rotaxp.copiloto.dominio.Enums.ProdutoDeclarado;
import java.time.LocalDate;
import java.util.List;

public record Cliente(
        String id, String nome, String cpf, int idade, String profissao, String cidade,
        PerfilInvestidor perfil, String assessorId, boolean ancora,
        List<InstituicaoDeclarada> instituicoesDeclaradas,
        List<Dependente> dependentes,
        List<EventoVida> eventosVida) {

    public record InstituicaoDeclarada(String instituicaoId, List<ProdutoDeclarado> produtos) {}

    public record Dependente(String nome, String parentesco, LocalDate dataNascimento) {}

    public String primeiroNome() {
        String semTitulo = nome.replaceFirst("^(Dra?\\.|Sr\\.|Sra\\.)\\s+", "");
        return semTitulo.split("\\s+")[0];
    }

    public Cliente comEventos(List<EventoVida> novos) {
        return new Cliente(id, nome, cpf, idade, profissao, cidade, perfil, assessorId, ancora,
                instituicoesDeclaradas, dependentes, novos);
    }
}
