package br.com.rotaxp.copiloto.openfinance;

/** Publicado quando um consentimento muda; invalida os caches do cliente. */
public record ConsentimentoAlterado(String clienteId, String instituicaoId) {}
