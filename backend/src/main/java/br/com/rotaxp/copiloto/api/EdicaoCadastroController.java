package br.com.rotaxp.copiloto.api;

import br.com.rotaxp.copiloto.dominio.Edicao.EdicaoCadastro;
import br.com.rotaxp.copiloto.dominio.Edicao.PedidoProposta;
import br.com.rotaxp.copiloto.dominio.Edicao.PropostaEdicao;
import br.com.rotaxp.copiloto.dominio.Edicao.Transcricao;
import br.com.rotaxp.copiloto.dominio.Visao360;
import br.com.rotaxp.copiloto.inteligencia.EdicaoCadastroService;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Edição do cadastro por voz (aditivo): transcrever → propor → o assessor confirma → PATCH. */
@RestController
@RequestMapping("/api/clientes/{id}")
public class EdicaoCadastroController {

    private final EdicaoCadastroService edicao;

    public EdicaoCadastroController(EdicaoCadastroService edicao) {
        this.edicao = edicao;
    }

    /** Áudio no campo "audio" (multipart). 503 sem Whisper configurado; 502 se o Whisper falhar. */
    @PostMapping(path = "/edicao/transcricao", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Transcricao transcrever(@PathVariable String id, @RequestPart("audio") MultipartFile audio) throws IOException {
        return edicao.transcrever(id, audio.getBytes(), audio.getOriginalFilename(), audio.getContentType());
    }

    /** O Copiloto entende a fala e as regras montam a proposta; nada é gravado aqui. */
    @PostMapping("/edicao/proposta")
    public PropostaEdicao propor(@PathVariable String id, @RequestBody PedidoProposta body) {
        return edicao.propor(id, body.transcricao());
    }

    /** Grava o que o assessor confirmou (null mantém o valor) e devolve a 360 recalculada. */
    @PatchMapping
    public Visao360 editar(@PathVariable String id, @RequestBody EdicaoCadastro body) {
        return edicao.aplicar(id, body);
    }
}
