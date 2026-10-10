package br.com.rotaxp.copiloto.api;

import br.com.rotaxp.copiloto.dominio.Excecoes.Conflito;
import br.com.rotaxp.copiloto.dominio.Excecoes.Expirado;
import br.com.rotaxp.copiloto.dominio.Excecoes.NaoEncontrado;
import br.com.rotaxp.copiloto.dominio.Excecoes.RequisicaoInvalida;
import br.com.rotaxp.copiloto.dominio.Requisicoes.ErroResposta;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Erros no formato { erro, mensagem } (PLAN §5). */
@RestControllerAdvice
public class ErrosHandler {

    @ExceptionHandler(NaoEncontrado.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErroResposta naoEncontrado(NaoEncontrado e) {
        return new ErroResposta("NAO_ENCONTRADO", e.getMessage());
    }

    @ExceptionHandler(Expirado.class)
    @ResponseStatus(HttpStatus.GONE)
    public ErroResposta expirado(Expirado e) {
        return new ErroResposta("EXPIRADO", e.getMessage());
    }

    @ExceptionHandler(Conflito.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErroResposta conflito(Conflito e) {
        return new ErroResposta("CONFLITO", e.getMessage());
    }

    @ExceptionHandler(RequisicaoInvalida.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErroResposta requisicaoInvalida(RequisicaoInvalida e) {
        return new ErroResposta("REQUISICAO_INVALIDA", e.getMessage());
    }
}
