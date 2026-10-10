package br.com.rotaxp.copiloto.inteligencia.radar;

import br.com.rotaxp.copiloto.dominio.Radar.Noticia;
import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;

/** Lê RSS 2.0 de forma segura (sem DTD nem entidades externas: o conteúdo vem da internet). */
public final class LeitorRss {

    private LeitorRss() {}

    public static List<NoticiaColetada> ler(String xml, String fonte, int maxItens) {
        Document doc = parse(xml);
        NodeList itens = doc.getElementsByTagName("item");
        List<NoticiaColetada> r = new ArrayList<>();
        for (int i = 0; i < itens.getLength() && r.size() < maxItens; i++) {
            Element item = (Element) itens.item(i);
            String titulo = texto(item, "title");
            if (titulo == null || titulo.isBlank()) continue;
            String link = texto(item, "link");
            String guid = texto(item, "guid");
            String url = link != null && !link.isBlank() ? link.strip() : guid == null ? null : guid.strip();
            Noticia n = new Noticia(id(url != null ? url : titulo), fonte, titulo.strip(), semHtml(texto(item, "description")), url,
                    data(texto(item, "pubDate")));
            r.add(new NoticiaColetada(n, null));
        }
        return r;
    }

    private static Document parse(String xml) {
        try {
            DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
            f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            f.setFeature("http://xml.org/sax/features/external-general-entities", false);
            f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            f.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            f.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            f.setXIncludeAware(false);
            f.setExpandEntityReferences(false);
            f.setNamespaceAware(false);
            var builder = f.newDocumentBuilder();
            builder.setErrorHandler(null);
            return builder.parse(new InputSource(new StringReader(xml)));
        } catch (ParserConfigurationException | SAXException | IOException e) {
            throw new IllegalArgumentException("RSS inválido: " + e.getMessage(), e);
        }
    }

    private static String texto(Element pai, String tag) {
        NodeList l = pai.getElementsByTagName(tag);
        return l.getLength() == 0 ? null : l.item(0).getTextContent();
    }

    static String semHtml(String html) {
        if (html == null) return null;
        String s = html.replaceAll("(?i)</?(p|br|div|li|ul|ol|h\\d)[^>]*>", " ").replaceAll("<[^>]+>", "");
        s = s.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"")
                .replace("&#39;", "'").replace("&#8230;", "…").replace("&#8217;", "’").replace("&amp;", "&");
        return s.replaceAll("\\s+", " ").strip();
    }

    private static OffsetDateTime data(String rfc1123) {
        if (rfc1123 == null || rfc1123.isBlank()) return null;
        try {
            return ZonedDateTime.parse(rfc1123.strip(), DateTimeFormatter.RFC_1123_DATE_TIME).toOffsetDateTime();
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static String id(String chave) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(chave.getBytes(StandardCharsets.UTF_8));
            return "rss-" + HexFormat.of().formatHex(h).substring(0, 12);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
