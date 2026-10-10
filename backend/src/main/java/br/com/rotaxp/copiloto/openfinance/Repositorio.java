package br.com.rotaxp.copiloto.openfinance;

import br.com.rotaxp.copiloto.dominio.Cliente;
import br.com.rotaxp.copiloto.dominio.Consentimento;
import br.com.rotaxp.copiloto.dominio.Conta;
import br.com.rotaxp.copiloto.dominio.Emissor;
import br.com.rotaxp.copiloto.dominio.EventoVida;
import br.com.rotaxp.copiloto.dominio.FaturaCartao;
import br.com.rotaxp.copiloto.dominio.Instituicao;
import br.com.rotaxp.copiloto.dominio.OperacaoCredito;
import br.com.rotaxp.copiloto.dominio.PosicaoInvestimento;
import br.com.rotaxp.copiloto.dominio.Transacao;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Repositório dos dados do Open Finance. Implementações: {@link RepositorioSqlite} (padrão) e
 * {@link RepositorioMemoria}, escolhidas por {@code banco.tipo}. Os dados crus só podem ser lidos pela
 * camada analise através do OpenFinanceGateway — por isso o acesso cru é package-private.
 * A ordem de tudo que é devolvido segue a ordem da seed (determinismo).
 */
public abstract class Repositorio {

    /** Volta ao estado da seed (startup e POST /demo/reset). */
    public abstract void recarregar();

    public abstract List<Cliente> clientes();

    /** @throws br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado se o cliente não existir */
    public abstract Cliente cliente(String id);

    /** Cliente cadastrado pelo onboarding (some no próximo reset da demo). */
    public abstract void adicionarCliente(Cliente c);

    public abstract void adicionarEventos(String clienteId, List<EventoVida> eventos);

    /**
     * Grava nome, idade, profissão e cidade (edição do cadastro pelo assessor); o resto do cliente não muda.
     * Some no próximo reset da demo.
     * @throws br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado se o cliente não existir
     */
    public abstract void salvarCadastro(Cliente c);

    public abstract Optional<Instituicao> instituicao(String id);

    public abstract Map<String, Instituicao> instituicoes();

    public abstract Map<String, Emissor> emissores();

    public abstract List<Consentimento> consentimentos(String clienteId);

    public abstract void salvar(Consentimento c);

    // Acesso cru — usado apenas pelo OpenFinanceGateway.
    abstract List<Conta> contas(String clienteId);

    abstract List<Transacao> transacoes(String contaId);

    abstract List<FaturaCartao> faturas(String clienteId);

    abstract List<OperacaoCredito> creditos(String clienteId);

    abstract List<PosicaoInvestimento> investimentos(String clienteId);
}
