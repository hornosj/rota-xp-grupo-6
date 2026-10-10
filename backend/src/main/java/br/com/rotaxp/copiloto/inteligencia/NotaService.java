package br.com.rotaxp.copiloto.inteligencia;

import br.com.rotaxp.copiloto.agentes.Copiloto;
import br.com.rotaxp.copiloto.config.AnotacoesProps;
import br.com.rotaxp.copiloto.consolidacao.Visao360Assembler;
import br.com.rotaxp.copiloto.demo.DataReferencia;
import br.com.rotaxp.copiloto.dominio.Enums.OrigemAnotacao;
import br.com.rotaxp.copiloto.dominio.Excecoes.RequisicaoInvalida;
import br.com.rotaxp.copiloto.dominio.RecomendacaoProduto;
import br.com.rotaxp.copiloto.dominio.ResultadoNota;
import br.com.rotaxp.copiloto.openfinance.ConsentimentoAlterado;
import br.com.rotaxp.copiloto.openfinance.Repositorio;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Nota do assessor (áudio transcrito no navegador ou texto): o Copiloto extrai os fatos; aqui os eventos
 * de vida são persistidos, a nota vira contexto do cliente e as necessidades viram produtos do catálogo.
 */
@Service
public class NotaService {

    private final Copiloto copiloto;
    private final Repositorio repo;
    private final Visao360Assembler assembler;
    private final AnotacoesService anotacoes;
    private final RecomendadorProdutos recomendador;
    private final DataReferencia dataReferencia;
    private final AnotacoesProps props;

    public NotaService(Copiloto copiloto, Repositorio repo, Visao360Assembler assembler, AnotacoesService anotacoes,
                       RecomendadorProdutos recomendador, DataReferencia dataReferencia, AnotacoesProps props) {
        this.copiloto = copiloto;
        this.repo = repo;
        this.assembler = assembler;
        this.anotacoes = anotacoes;
        this.recomendador = recomendador;
        this.dataReferencia = dataReferencia;
        this.props = props;
    }

    public ResultadoNota processar(String clienteId, String transcricao, OrigemAnotacao origem) {
        repo.cliente(clienteId);
        String texto = transcricao == null ? "" : transcricao.strip();
        if (texto.isEmpty()) throw new RequisicaoInvalida("A nota está vazia.");
        if (texto.length() > props.maxCaracteres()) {
            throw new RequisicaoInvalida("A nota passa de " + props.maxCaracteres() + " caracteres.");
        }
        ResultadoNota r = copiloto.processarNota(clienteId, texto);
        List<RecomendacaoProduto> recomendacoes = recomendador.recomendar(r.necessidades());
        if (!r.eventosCriados().isEmpty()) {
            repo.adicionarEventos(clienteId, r.eventosCriados());
            assembler.aoAlterarConsentimento(new ConsentimentoAlterado(clienteId, null));
        }
        anotacoes.registrar(clienteId, texto, origem == null ? OrigemAnotacao.TEXTO : origem, dataReferencia.hoje(),
                r.resumo(), recomendacoes);
        return r.comRecomendacoes(recomendacoes);
    }
}
