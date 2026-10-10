package br.com.rotaxp.copiloto.openfinance;

import br.com.rotaxp.copiloto.config.ConsentimentoProps;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.ConsentimentoView;
import br.com.rotaxp.copiloto.dominio.Enums.Escopo;
import br.com.rotaxp.copiloto.dominio.Enums.ProdutoDeclarado;
import br.com.rotaxp.copiloto.dominio.Enums.StatusConsentimento;
import br.com.rotaxp.copiloto.dominio.Enums.TipoConsentimento;
import br.com.rotaxp.copiloto.dominio.Excecoes.Conflito;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import java.time.LocalDate;
import java.util.List;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
public class ConsentimentoService {

    private final Repositorio repo;
    private final DataReferencia dataReferencia;
    private final ConsentimentoProps props;
    private final ApplicationEventPublisher eventos;

    public ConsentimentoService(Repositorio repo, DataReferencia dataReferencia, ConsentimentoProps props,
                                ApplicationEventPublisher eventos) {
        this.repo = repo;
        this.dataReferencia = dataReferencia;
        this.props = props;
        this.eventos = eventos;
    }

    public List<ConsentimentoView> listar(String clienteId) {
        repo.cliente(clienteId);
        return repo.consentimentos(clienteId).stream()
                .map(c -> ConsentimentoView.de(c, repo.instituicao(c.instituicaoId()).map(Instituicao::nome).orElse(c.instituicaoId())))
                .toList();
    }

    public synchronized void conceder(String clienteId, String instituicaoId) {
        Cliente cliente = repo.cliente(clienteId);
        Instituicao inst = instituicao(instituicaoId);
        LocalDate hoje = dataReferencia.hoje();
        Consentimento atual = existente(clienteId, instituicaoId);
        if (atual != null && atual.ativo()) {
            throw new Conflito("Consentimento com " + inst.nome() + " já está ativo");
        }
        List<Escopo> escopos = atual != null && atual.escopos() != null && !atual.escopos().isEmpty()
                ? atual.escopos() : escoposDeclarados(cliente, instituicaoId);
        Consentimento novo = atual != null
                ? atual.com(StatusConsentimento.ATIVO, escopos, hoje, hoje.plusDays(props.prazoDias()))
                : new Consentimento("cons-" + clienteId + "-" + instituicaoId, clienteId, instituicaoId,
                        TipoConsentimento.OPEN_FINANCE, StatusConsentimento.ATIVO, escopos, hoje, hoje.plusDays(props.prazoDias()));
        repo.salvar(novo);
        eventos.publishEvent(new ConsentimentoAlterado(clienteId, instituicaoId));
    }

    public synchronized void revogar(String clienteId, String instituicaoId) {
        repo.cliente(clienteId);
        Instituicao inst = instituicao(instituicaoId);
        Consentimento atual = existente(clienteId, instituicaoId);
        if (atual == null || atual.status() == StatusConsentimento.REVOGADO) {
            throw new NaoEncontrado("Não há consentimento ativo com " + inst.nome());
        }
        if (atual.tipo() == TipoConsentimento.INTERNO) {
            throw new Conflito("Os dados da XP são da própria plataforma e não podem ser revogados aqui");
        }
        repo.salvar(atual.com(StatusConsentimento.REVOGADO, atual.escopos(), atual.concedidoEm(), atual.expiraEm()));
        eventos.publishEvent(new ConsentimentoAlterado(clienteId, instituicaoId));
    }

    private Instituicao instituicao(String id) {
        return repo.instituicao(id).orElseThrow(() -> new NaoEncontrado("Instituição " + id + " não encontrada"));
    }

    private Consentimento existente(String clienteId, String instituicaoId) {
        return repo.consentimentos(clienteId).stream()
                .filter(c -> c.instituicaoId().equals(instituicaoId)).findFirst().orElse(null);
    }

    private static List<Escopo> escoposDeclarados(Cliente cliente, String instituicaoId) {
        return cliente.instituicoesDeclaradas().stream()
                .filter(d -> d.instituicaoId().equals(instituicaoId))
                .flatMap(d -> d.produtos().stream())
                .map(ConsentimentoService::escopo).distinct().toList();
    }

    static Escopo escopo(ProdutoDeclarado p) {
        return switch (p) {
            case CONTA -> Escopo.CONTAS;
            case CARTAO -> Escopo.CARTOES;
            case CREDITO -> Escopo.CREDITO;
            case INVESTIMENTOS -> Escopo.INVESTIMENTOS;
        };
    }
}
