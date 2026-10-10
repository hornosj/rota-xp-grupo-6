// Copia ../contract/fixtures/*.json para src/mocks/fixtures-contrato/ (referência do contrato).
// Não falha se a pasta do contrato ainda não existir.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origem = join(raiz, "..", "contract", "fixtures");
const destino = join(raiz, "src", "mocks", "fixtures-contrato");

if (!existsSync(origem)) {
  console.warn(`[sync:fixtures] ${origem} ainda não existe — nada a copiar.`);
  process.exit(0);
}
mkdirSync(destino, { recursive: true });
const arquivos = readdirSync(origem).filter((f) => f.endsWith(".json"));
for (const f of arquivos) cpSync(join(origem, f), join(destino, f));
console.log(`[sync:fixtures] ${arquivos.length} arquivo(s) copiado(s) para ${destino}`);
