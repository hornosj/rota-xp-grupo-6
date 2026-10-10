package br.com.rotaxp.copiloto.api;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.AdditionalMatchers.aryEq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rotaxp.copiloto.agentes.Transcritor;
import br.com.rotaxp.copiloto.dominio.Edicao.Transcricao;
import br.com.rotaxp.copiloto.dominio.Excecoes.Indisponivel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** Edição do cadastro por voz com a seed real: transcrever → propor (stub) → PATCH → 360 recalculada → reset. */
@SpringBootTest(properties = "copiloto.modo=stub")
@AutoConfigureMockMvc
class EdicaoCadastroApiTest {

    private static final String TRANSCRICAO = "/api/clientes/cli-004/edicao/transcricao";

    @Autowired MockMvc mvc;
    @MockitoBean Transcritor transcritor;

    @BeforeEach
    void reset() throws Exception {
        mvc.perform(post("/api/demo/reset")).andExpect(status().isNoContent());
    }

    private static MockMultipartFile audio(String nome, String tipo, byte[] bytes) {
        return new MockMultipartFile("audio", nome, tipo, bytes);
    }

    @Test
    void transcreveOAudioComAExtensaoDoFormatoEONomeDoClienteComoDica() throws Exception {
        when(transcritor.transcrever(any(), any(), any())).thenReturn(new Transcricao("A Patrícia se mudou para Campinas.", "whisper-1"));

        mvc.perform(multipart(TRANSCRICAO).file(audio("blob", "audio/webm;codecs=opus", new byte[] {1, 2, 3})))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.texto").value("A Patrícia se mudou para Campinas."))
                .andExpect(jsonPath("$.modelo").value("whisper-1"));

        verify(transcritor).transcrever(aryEq(new byte[] {1, 2, 3}), eq("audio.webm"), eq(
                "Atualização do cadastro de Patrícia Gomes: nome, idade, profissão e cidade."));
    }

    @Test
    void transcricaoSemWhisperEh503EAudioInvalidoEh400() throws Exception {
        when(transcritor.transcrever(any(), any(), any())).thenThrow(new Indisponivel("Transcrição por voz não configurada"));

        mvc.perform(multipart(TRANSCRICAO).file(audio("gravacao.m4a", "audio/x-m4a", new byte[] {1})))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.erro").value("INDISPONIVEL"));
        mvc.perform(multipart(TRANSCRICAO).file(audio("notas.txt", "text/plain", new byte[] {1})))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensagem").value(containsString("Formato de áudio não suportado")));
        mvc.perform(multipart(TRANSCRICAO).file(audio("vazio.webm", "audio/webm", new byte[0])))
                .andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/clientes/cli-999/edicao/transcricao").file(audio("a.webm", "audio/webm", new byte[] {1})))
                .andExpect(status().isNotFound());
    }

    @Test
    void propostaNaoGravaEPatchGravaERecalculaA360AteOReset() throws Exception {
        mvc.perform(post("/api/clientes/cli-004/edicao/proposta").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"transcricao\":\"A Patrícia se mudou para Campinas/SP e agora é consultora educacional. "
                                + "O perfil dela agora é moderado.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clienteId").value("cli-004"))
                .andExpect(jsonPath("$.alteracoes", hasSize(2)))
                .andExpect(jsonPath("$.alteracoes[0].campo").value("PROFISSAO"))
                .andExpect(jsonPath("$.alteracoes[0].valorAtual").value("Professora aposentada"))
                .andExpect(jsonPath("$.alteracoes[0].valorNovo").value("Consultora educacional"))
                .andExpect(jsonPath("$.alteracoes[1].campo").value("CIDADE"))
                .andExpect(jsonPath("$.alteracoes[1].valorNovo").value("Campinas/SP"))
                .andExpect(jsonPath("$.avisos[0]").value(containsString("suitability")))
                .andExpect(jsonPath("$.geradoPor").value("stub"));
        mvc.perform(get("/api/clientes/cli-004/360")).andExpect(jsonPath("$.cliente.cidade").value("Bauru/SP"));

        mvc.perform(patch("/api/clientes/cli-004").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"profissao\":\"Consultora educacional\",\"cidade\":\"Campinas/SP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cliente.profissao").value("Consultora educacional"))
                .andExpect(jsonPath("$.cliente.cidade").value("Campinas/SP"))
                .andExpect(jsonPath("$.cliente.nome").value("Patrícia Gomes"))
                .andExpect(jsonPath("$.cliente.idade").value(68))
                .andExpect(jsonPath("$.cliente.perfil").value("CONSERVADOR"));
        mvc.perform(get("/api/clientes/cli-004/360")).andExpect(jsonPath("$.cliente.cidade").value("Campinas/SP"));

        mvc.perform(post("/api/demo/reset")).andExpect(status().isNoContent());
        mvc.perform(get("/api/clientes/cli-004/360")).andExpect(jsonPath("$.cliente.cidade").value("Bauru/SP"));
    }

    @Test
    void edicaoInvalidaEh400EClienteInexistenteEh404() throws Exception {
        mvc.perform(patch("/api/clientes/cli-004").contentType(MediaType.APPLICATION_JSON).content("{\"idade\":12}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensagem").value(containsString("18 a 120 anos")));
        mvc.perform(patch("/api/clientes/cli-004").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/clientes/cli-999").contentType(MediaType.APPLICATION_JSON).content("{\"idade\":40}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/clientes/cli-004/edicao/proposta").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"transcricao\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void estadoDaDemoDizSeATranscricaoPorVozEstaDisponivel() throws Exception {
        when(transcritor.disponivel()).thenReturn(true);
        when(transcritor.modelo()).thenReturn("whisper-1");

        mvc.perform(get("/api/demo/estado"))
                .andExpect(jsonPath("$.transcricao.disponivel").value(true))
                .andExpect(jsonPath("$.transcricao.modelo").value("whisper-1"));
    }
}
