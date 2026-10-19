# Plano de Enxugamento — PrecificaAteliê

## Regras

1. **Uma etapa por vez.** A próxima só começa quando a anterior estiver feita.
2. **Cada etapa termina com:** testes + `npm run lint` + `npm run build` + commit + tag `etapa-N-ok`.
3. **Ideias novas vão para o Estacionamento** (seção 7), não entram na etapa em andamento.
4. **Enxugar não muda nenhum preço.** Mudanças de preço só na Etapa 7, com comparação antes/depois aprovada.

## Rota

| Etapa | O que é | Status |
|---|---|---|
| 0 — Fechar o que está aberto | Juntar todas as branches na `main`, backup novo conferido, item 11 resolvido, tag `antes-de-enxugar`. | ✅ **Feita** (17/10/2026). Nenhuma branch tem commits fora da `main`; backup `backup_precifica_ja_2026-10-17 (4).json` conferido (formato v2, completo, 0 falhas, 2 lojas, 17 coleções, contagens iguais ao `_meta`); item 11 em produção; tag `antes-de-enxugar` em `f5279f0`. |
| 1 — Diagnóstico (só leitura) | Este plano + decisões T1–T12. | ✅ **Feita** (17/10/2026), commits `b151c08` e `44dbe4e`. |
| 2 — Rede de segurança | Configurar o Firebase Emulator para o `npm run dev` usar um banco local, e criar testes automáticos do motor de preços e das 4 calculadoras com os valores do `CHECKLIST-TESTES.md`. Não muda o app. | ✅ **Feita** (17/10/2026), tag `etapa-2-ok`. `npm run dev` usa só o emulador (projeto `demo-precificaatelie`); ADMIN de teste `admin@teste.local`; 49 testes (`npm test`). As contas de Laser, Papelaria e Cestas foram movidas sem mudança para `src/lib/calculators.ts` (aprovado), o que adianta parte de D4–D6 da Etapa 4. Requer Java 21. |
| 3 — Remover lixo | Ver seção 6. | ✅ **Feita** (17/10/2026), tag `etapa-3-ok`. 14 itens removidos (código morto, 3 bibliotecas, `docs/`, `index_Old.html`, `bun.lock`, manifesto duplicado, cache `.firebase/` fora do git); `ATUALIZACAO-MAQUINAS.md` mantido. Testes, lint e build passando; manifesto gerado idêntico. |
| 4A — Unificar duplicações (Grupo A: contas e textos) | Ver seção 6. Os testes da Etapa 2 têm que dar os mesmos números antes e depois. | ✅ **Feita** (17/10/2026), tags `etapa-4a-ok` e `etapa-4-ok` (commit `665baca`): contas, custo de compra, padrões, textos da IA e PDFs unificados, com 76 testes e 0 diferenças nas comparações. |
| 4B — Unificar duplicações (Grupo B: telas) | Ver seção 6: `SearchBar`, `ConfirmDeleteModal`, histórico de trabalhos, `MaterialPicker` e `PriceResultCard`, com testes de HTML de cada tela antes de mexer. | ✅ **Feita** (18/10/2026), tag `etapa-4b-ok`: `ConfirmDeleteModal`, `SearchBar`, `StockMaterialPicker`, `JobHistoryList`, `SuggestedPrice` e `ManualPriceCheck`, com o HTML final igual nos 39 estados gravados. |
| 5 — Peso e telas aprovadas | Ver seção 6 (começa pelo T13; inclui também T1, T5, T6, T8, T10, T11, T12 e T14). | ✅ **Feita** (18/10/2026), tag `etapa-5-ok`: botões sempre visíveis (janelas e tabelas, computador e celular), abertura do app 44% menor (1.778 → 989 KB), T1, T5, T6, T8, T10, T11, T12 e T14. A divisão de `Products.tsx` e `Pricing.tsx` foi para o início da Etapa 8. |
| 6 — Validação final | Você testa o app no emulador seguindo o `CHECKLIST-TESTES.md`; depois code review, build e publicação. | ✅ **Feita** (19/10/2026), tag `etapa-6-ok`: checklist atualizado e testado sem erros, code review sem correções, backup do banco real conferido e site publicado (só hosting) a partir de `80f64b5`. |
| 7 — Unificar parâmetros de preço | Remover o Elo7 (primeiro item), T4 (tabela única e editável de canais de venda por loja, com iFood e 99Food), T2 e T3, só depois da Etapa 6. Ver seção 6. | ✅ **Feita** (19/10/2026), tag `etapa-7-ok`, **publicada em 19/10/2026** (só hosting): proteção do catálogo, meta como **markup sobre o custo** (convertida sem mudar preço de produto), tabela única de canais por loja, canal em todas as calculadoras e T2. T3 adiado. |
| 7.1 — Segurança | Aviso de nova versão (versão antiga não grava), regra do banco contra zerar o preço de catálogo, falhas do catálogo e do estoque visíveis na tela, checklist com markup e canais. Ver seção 6. | ✅ **Feita** (19/10/2026), tag `etapa-7.1-ok`, **ainda não publicada** (publicar hosting + regras do banco quando você pedir). |
| 8 — Central de Calculadoras | Começa dividindo `Products.tsx` e `Pricing.tsx` (vindo da Etapa 5). As 4 calculadoras numa única guia do menu, e trabalho salvo virando Produto do Catálogo. Só depois da Etapa 7. Ver seção 6. | ⏳ Pendente (só planejamento) |
| 9 — Monitor de taxas | Aviso de canal sem conferência há mais de 60 dias, comissão do Mercado Livre pela API oficial (se viável) e verificação mensal assistida por IA. Só depois da Etapa 8. Ver seção 6. | ⏳ Pendente (só planejamento) |

**Onde paramos (19/10/2026):** Etapa 7.1 (segurança) concluída no código, tag `etapa-7.1-ok`, **ainda não publicada**: a publicação será **hosting + regras do banco** (`firebase deploy --only hosting,firestore:rules`), só quando você pedir, depois do backup conferido. A Etapa 7 está publicada e o catálogo da T&N foi recuperado. T3 (tarifa de energia única) continua adiado. **Próximo passo: publicar a 7.1 quando você pedir; depois, Etapa 8 — Central de Calculadoras.** Nada ficou pela metade.

As etapas 0 e 1 foram concluídas antes da regra 2 existir. Por isso não têm as tags `etapa-0-ok` e `etapa-1-ok`; o ponto de volta delas é a tag `antes-de-enxugar`.

---

**Etapa 1: diagnóstico.** Nenhum arquivo de código foi alterado.
Base: tag `antes-de-enxugar` (commit `f5279f0`). O código é o mesmo publicado em produção (`fed5c89`).
Regra deste plano: **nenhuma funcionalidade é perdida**. O que está na seção 5 só muda com aprovação.

**Decisões da Etapa 1 (17/10/2026):** aprovados T1, T5, T6, T8, T10, T11 e T12 (entram na Etapa 5); T7 e T9 vão para o estacionamento; T2, T3 e T4 formam a nova **Etapa 7 — Unificar parâmetros de preço**; `.agents/` e `skills-lock.json` ficam.

Números de referência hoje:

| Medida | Valor |
|---|---|
| Código em `src/` | 16.640 linhas em 46 arquivos |
| Linhas em blocos repetidos (≥ 6 linhas iguais em 2+ lugares) | 1.828 de 13.000 linhas úteis (**14,1%**) |
| Build (`dist/assets`) | 2.861 KB em 53 arquivos (787 KB comprimido) |
| Carga inicial (tela de login) | **1.818 KB (515 KB comprimido)** em 5 arquivos |

---

## 1. Inventário — tudo MANTER

### Telas (menu lateral, 20 abas + 2 telas fora do menu)

| Tela | Arquivo | Linhas | Quem vê | O que faz | Situação |
|---|---|---|---|---|---|
| Login / Criar conta / Esqueci a senha | `Login.tsx` | 285 | todos | entrar, cadastro (fica pendente), redefinir senha | MANTER |
| Dashboard | `Dashboard.tsx` | 417 | todos | faturamento, lucro, pendentes, status das margens, gráficos | MANTER |
| Clientes | `Clients.tsx` | 613 | todos | cadastro PF/PJ, busca, histórico de orçamentos do cliente | MANTER |
| Fornecedores | `Suppliers.tsx` | 609 | todos | cadastro, forma e condição de pagamento | MANTER |
| Base de Custos | `CostBase.tsx` | 207 | todos (OPERADOR só vê) | custos fixos, horas, valor da hora, meta de lucro | MANTER |
| Matéria-prima | `Materials.tsx` | 651 | todos | cadastro, custo unitário, pacote, estoque mínimo, categorias | MANTER |
| Estoque | `Inventory.tsx` | 171 | todos | +1/−1 no saldo, contador de estoque baixo | MANTER |
| Produtos | `Products.tsx` | 1.342 | todos | ficha técnica, preço sugerido/manual, precificação reversa, imagens, catálogo, IA | MANTER |
| Categorias | `Categories.tsx` | 292 | todos | categorias de matéria-prima e de produto | MANTER |
| Catálogo | `Catalog.tsx` | 279 | todos | escolher produtos do catálogo, copiar link, enviar por WhatsApp | MANTER |
| Precificação (orçamento) | `Pricing.tsx` | 1.143 | todos | itens, canal, margem personalizada, acabamentos, PDFs, IA | MANTER |
| Corte a Laser | `LaserCalculator.tsx` | 902 | todos | máquinas, custo por peça/lote, IA, histórico | MANTER |
| Impressão 3D | `PrintCalculator.tsx` | 1.001 | todos | impressoras, G-code, canais, baixa de filamento, IA, histórico | MANTER |
| Papelaria | `PapelariaCalculator.tsx` | 755 | todos | materiais (estoque/avulso), acabamentos, tempos, IA, histórico | MANTER |
| Cestas | `CestaCalculator.tsx` | 784 | todos | itens (estoque/avulso), embalagem, frete, comissão, IA, histórico | MANTER |
| Produção | `ProductionPanel.tsx` | 221 | todos | orçamentos aprovados/em produção, reservas de estoque | MANTER |
| Lista de Compras | `PurchaseList.tsx` | 753 | todos | estoque baixo, inclusão manual, registrar compra, copiar lista | MANTER |
| Histórico | `History.tsx` | 483 | todos | status do orçamento, reserva/baixa de estoque, PDFs, WhatsApp | MANTER |
| Lojas | `Stores.tsx` | 517 | ADMIN | cadastro, logo, cores | MANTER |
| Usuários | `Users.tsx` | 734 | ADMIN, GERENTE | criar, aprovar, bloquear, cargos e lojas | MANTER |
| Backup | `Backup.tsx` | 511 | ADMIN | exportar por loja com `_meta`, importar com prévia | MANTER |
| Catálogo público (`/catalogo/<loja>`) | `PublicCatalog.tsx` | 448 | qualquer pessoa | vitrine sem login, WhatsApp, compartilhar | MANTER |

Componentes de apoio das telas, todos usados: `Layout.tsx` (373, menu e botão "Instalar app"), `ErrorBoundary.tsx` (67), `ProductImageUpload.tsx` (184), `CategoryPicker.tsx` (178).

### Funções de apoio (todas usadas)

| Módulo | Arquivo | O que faz |
|---|---|---|
| Motor de preços | `lib/pricingEngine.ts` | custo do produto, margem sobre o preço, orçamento, status, KPIs |
| Preço 3D e G-code | `lib/printPricing.ts` | custo da impressão, canais, leitura de G-code |
| PDFs | `lib/pdf.ts` | PDF do cliente, PDF interno, "nota fiscal" |
| Utilitários | `lib/utils.ts` | moeda, %, estoque baixo, tamanho do pacote |
| Automações | `services/automations.ts` | reserva, baixa e liberação de estoque por status |
| IA | `services/gemini.ts` | 7 análises/sugestões (opcional, sem chave o app funciona) |
| WhatsApp | `services/whatsapp.ts` | mensagens de orçamento e status |
| Imagens | `services/imageUpload.ts` | upload/remoção de imagens de produto e galeria |
| Contextos | `contexts/*.tsx` | login e cargo, loja ativa, avisos (toasts) |
| Categorias | `hooks/useCategories.ts` | categorias da loja por tipo |
| Firebase | `firebase.ts` | conexão, tratamento de erros |

---

## 2. Lixo

### 2a. Dentro de `src/` (código)

| Item | Tamanho | Prova de que não é usado |
|---|---|---|
| `src/components/PWAInstall.tsx` | 49 linhas | Nenhum arquivo importa. Pela análise dos imports a partir de `main.tsx`, 44 de 46 arquivos são usados; os 2 de fora são este e `vite-env.d.ts`, que é só declaração de tipos e **fica**. O botão "Instalar app" já existe em `Layout.tsx:46-80`, com a mesma lógica. |
| `checkFollowUps()` em `services/automations.ts:241-243` | 3 linhas | Corpo vazio ("Placeholder — implement in Cloud Functions"). `grep -rnw checkFollowUps src` → só a própria declaração. |
| `generateFollowUpMessage()` em `services/whatsapp.ts:34` | ~3 linhas | `grep -rnw` → só a declaração. Era para o follow-up acima. |
| `signInWithGoogle` e `googleProvider` em `firebase.ts:65-68` | 4 linhas | `signInWithGoogle` → só a declaração; `googleProvider` só é usado por ela. O login é por e-mail e senha (`Login.tsx`). |
| `isFirebaseConfigured` em `firebase.ts:58` | 1 linha | `grep -rnw` → só a declaração. |
| `type LaserMachineId` em `types.ts:108` | 1 linha | `grep -rnw` → só a declaração. |
| Campo `discount` no formulário de Fornecedores | 4 pontos (`Suppliers.tsx:47,108,141,299`) | O valor é zerado e copiado, mas **não existe campo na tela** para digitar; sempre grava 0. **Decidido (T12): remover**, na Etapa 5. **Correção (18/10/2026):** o campo "Desconto (%)" existia, sim (formulário e detalhes); não entrava em conta nenhuma e foi removido mesmo assim, com sua confirmação. |
| Campo `followUpStatus` do orçamento | 1 ponto (`Pricing.tsx:399`) | Gravado como "Pendente" e **nunca lido** em nenhuma tela. Parar de gravar não perde nada; o valor antigo fica no banco. |
| `console.log` de depuração | 5 linhas (`Suppliers.tsx:76,78,85,91`, `Layout.tsx:56`) | Mensagens de teste no console. Os 2 de `Users.tsx:99-101` ficam para a seção 5 (T11). |
| Código comentado | **0 blocos** | Busca por linhas `//` com código e por `/* */` com JSX: nada. Os 103 comentários JSX são títulos de seção (`{/* Header */}`) e ficam. |

### 2b. Bibliotecas no `package.json` sem uso

| Biblioteca | Tamanho em `node_modules` | Prova |
|---|---|---|
| `date-fns` | 20 MB | `grep -rnE "date-fns" src index.html vite.config.ts` → 0 resultados |
| `motion` | 719 KB | `grep -rnE "['\"]motion" src` → 0 resultados |
| `react-markdown` | 75 KB | `grep -rnE "react-markdown\|ReactMarkdown" src` → 0 resultados |

As outras 10 dependências e as 11 devDependencies estão em uso. Exemplos: `firebase` em 29 arquivos, `lucide-react` em 28, `recharts`, `jspdf` e `@google/genai` em 1 cada, `clsx` e `tailwind-merge` em `lib/utils.ts`. Estas 3 não entram no build, então removê-las não muda o tamanho do site, só a instalação.

### 2c. Fora de `src/` (arquivos do repositório)

| Item | Tamanho | Prova |
|---|---|---|
| `docs/` (12 arquivos: `index.html`, `sw.js`, `assets/*`) | 2,4 MB | É um build antigo (último commit `99f93db`, 30/06/2026). O site publica `dist/` (`firebase.json` → `"public": "dist"`), e nenhum workflow, script ou config cita `docs/`. |
| `index_Old.html` | 1,2 KB | Título antigo "A Caverna". O Vite usa só `index.html`, e nada referencia este arquivo. |
| `bun.lock` | 184 KB | Lockfile do Bun, que duplica o `package-lock.json` (373 KB). O deploy usa `npm ci` (`.github/workflows/*.yml`), e dois lockfiles podem divergir. |
| `public/manifest.webmanifest` | 1 KB | O `vite-plugin-pwa` gera o manifesto a partir do `vite.config.ts` e **sobrescreve** este: o `dist/manifest.webmanifest` publicado tem os ícones do config, não os deste arquivo. |
| `.firebase/hosting.ZGlzdA.cache` | <1 KB | Cache da Firebase CLI, que muda a cada deploy. Deveria estar no `.gitignore` (hoje não está). |
| `ATUALIZACAO-MAQUINAS.md` | 2 KB | Notas de uma versão antiga ("Extraia este ZIP…"). Não é lixo de código. **Decisão: fica.** |
| `.agents/` (84 arquivos) e `skills-lock.json` | 614 KB | Instruções de agentes de IA para Firebase, que não fazem parte do app. **Decisão: ficam.** |

---

## 3. Duplicação

As 4 calculadoras concentram **1.030 das 1.828 linhas repetidas** (56%). Pares com mais blocos iguais de 6 linhas: Cestas↔Papelaria **185**, Laser↔Papelaria **102**, Cestas↔Laser **80**, Laser↔3D **70**.

| # | O que se repete | Onde | Como unificar |
|---|---|---|---|
| D1 | Escolher material "Do estoque" ou "Avulso": busca, seleção, quantidade, aviso de saldo, `addFromStock` | `PapelariaCalculator.tsx:56-119` e `:315-428`; `CestaCalculator.tsx:57-120` e `:306-426` (quase idênticos) | Componente `MaterialPicker` + hook `useStockMaterials`. |
| D2 | Histórico de trabalhos salvos: `onSnapshot` por loja, lista, excluir com `deletingId` e confirmação | Laser `:121`, `:286`, `:765-800`; 3D `:151`, `:369`, `:868-905`; Papelaria `:71`, `:215`, `:709-730`; Cestas `:72`, `:229`, `:731-760` | Hook `useStoreJobs(coleção)` + componente `JobHistoryList`. |
| D3 | Bloco "Seu preço (opcional)" + "Analisar com IA" + cartão de resultado (sugerido, lucro, margem, aviso de prejuízo) | Laser a partir de `:596`, Papelaria `:538`, Cestas `:558`, 3D a partir de `:720` | Componente `PriceResultCard`. |
| D4 | Mão de obra: `(valorHora / 60) × minutos` | Laser `:147`, Papelaria `:126`, Cestas `:126`; a 3D usa `valorHora × horas` em `printPricing.ts:72` | Função `laborCost(valorHora, minutos)` no `pricingEngine.ts`. |
| D5 | Energia: `(W / 1000) × horas × tarifa` | Laser `:145`, `printPricing.ts:59` | Função `energyCost(W, horas, tarifa)`. |
| D6 | Desgaste: `(custo de reposição ÷ vida útil) × horas` | Laser `:146-149`, `printPricing.ts:60-70` (hotend, mesa, máquina) | Função `wearCost(custo, vidaH, horas)`. |
| D7 | Margem e taxas | Já unificado em `priceForMargin` (`pricingEngine.ts`) nesta versão. | — (feito) |
| D8 | Análise de preço por IA, com prompt quase igual | `gemini.ts`: `analyzeLaserPrice`, `analyzePapelariaPrice`, `analyzeCestaPrice`, `analyzeManualPrice` (~25 linhas cada) | Uma função `analyzeJobPrice(tipo, dados)`. |
| D9 | Telas de cadastro: busca, modal de formulário, modal "confirmar exclusão" | Clientes↔Fornecedores 17 blocos, Materiais↔Estoque 17, Histórico, Lojas, Materiais e Clientes ~13-15 blocos cada | Componentes `SearchBar` e `ConfirmDeleteModal`. |
| D10 | Valores padrão espalhados: valor da hora 25 (Laser, Papelaria, Cestas) e 12 (3D); tarifa 0,78938 (Laser) e 0,85 (3D); margem 60% nas 4 | Constantes no topo de cada calculadora | Um arquivo de padrões (`lib/defaults.ts`), com os mesmos valores de hoje. Ver também T2–T3 na seção 5. |
| D11 | Cabeçalho e rodapé dos 3 PDFs | `lib/pdf.ts` (39 linhas repetidas) | Funções `drawHeader` e `drawFooter`. |

Estimativa: D1–D3 e D8–D9 removem **~800–1.000 linhas** sem mudar comportamento. D4–D6 economizam menos de 50 linhas, mas deixam as contas num só lugar e evitam erros como os já corrigidos.

---

## 4. Peso

### 10 maiores arquivos

| # | Arquivo | Linhas |
|---|---|---|
| 1 | `components/Products.tsx` | 1.342 |
| 2 | `components/Pricing.tsx` | 1.143 |
| 3 | `components/PrintCalculator.tsx` | 1.001 |
| 4 | `components/LaserCalculator.tsx` | 902 |
| 5 | `components/CestaCalculator.tsx` | 784 |
| 6 | `components/PapelariaCalculator.tsx` | 755 |
| 7 | `components/PurchaseList.tsx` | 753 |
| 8 | `components/Users.tsx` | 734 |
| 9 | `components/Materials.tsx` | 651 |
| 10 | `components/Clients.tsx` | 613 |

Os 10 somam 8.678 linhas (52% de `src/`).

### Build (`npm run build`, versão em produção)

| Pedaço | Tamanho | Comprimido | Carrega quando |
|---|---|---|---|
| `vendor-firebase` | 721 KB | 180 KB | sempre (necessário) |
| `vendor-pdf` (jsPDF + autotable) | 413 KB | 136 KB | **sempre, mas só é usado ao gerar PDF** |
| `vendor-charts` (recharts) | 371 KB | 109 KB | **sempre, mas só é usado no Dashboard** |
| `gemini` (`@google/genai`) | 286 KB | 57 KB | ao abrir telas com IA |
| `index` (app) | 273 KB | 83 KB | sempre |
| `html2canvas` + `purify` + `index.es` (dependências do jsPDF) | 382 KB | 110 KB | ao gerar PDF |
| CSS | 40 KB | 7 KB | sempre |
| **Total** | **2.861 KB** (53 arquivos) | **787 KB** | |

**Carga inicial hoje: 1.818 KB (515 KB comprimido).** O `index.html` pré-carrega `vendor-pdf` e `vendor-charts` porque o Dashboard é importado direto em `App.tsx:6` (e não sob demanda) e porque a divisão manual em pedaços (`manualChunks` no `vite.config.ts`) os liga ao pedaço principal. Carregando gráficos e PDF só quando usados, a carga inicial cai para **~1.034 KB (~270 KB comprimido), cerca de −45%**.

### Bibliotecas mais pesadas (em `node_modules`, na instalação)

`firebase` 45 MB · `lucide-react` 42 MB (no build entram só os ícones usados) · `jspdf` 29 MB · `date-fns` 20 MB (**sem uso**) · `@google/genai` 14 MB · `recharts` 9 MB · `html2canvas` 4 MB.

---

## 5. Telas — sugestões e decisões

| # | Onde | O que confunde | Decisão (17/10/2026) | Vai para |
|---|---|---|---|---|
| T1 | Clientes | Os cartões "Total gasto", "Orçamentos" e "Última compra" sempre mostram **R$ 0,00 / 0 / —**: são gravados zerados (`Clients.tsx:144-146`) e nada os atualiza. | ✅ **Aprovado:** mostrar os valores reais, calculados a partir dos orçamentos do cliente. | Etapa 5 |
| T2 | Calculadoras | "Valor Hora Trabalho" (25 ou 12) e "Margem de Lucro" (60%) não dependem da **Base de Custos** (R$ 20/h e Meta de Lucro da loja). São duas fontes para o mesmo número. | ➡️ Usar a Base de Custos como valor inicial, mantendo o campo editável. | Etapa 7 |
| T3 | Calculadoras | Tarifa de energia padrão diferente: 0,78938 (Laser) e 0,85 (3D). | ➡️ Um valor só, guardado na Base de Custos. | Etapa 7 |
| T4 | Precificação × Impressão 3D | Duas tabelas de canais diferentes: o orçamento usa Shopee 20%, e a 3D usa Shopee 14% + R$ 4. | ➡️ Uma tabela só de canais, **editável e por loja** (comissão %, taxa fixa R$, taxa de pagamento %, observação e data da última conferência), usada pelos Orçamentos e por todas as calculadoras; com iFood e 99Food (18/10/2026; Keeta retirado em 19/10/2026). **Primeiro item da Etapa 7.** | Etapa 7 |
| T5 | Corte a Laser | Largura e altura da peça são gravadas, mas não aparecem na tela (sempre 100 × 100 mm). | ✅ **Aprovado:** deixar de gravar (trabalhos antigos mantêm o valor no banco). | Etapa 5 |
| T6 | Papelaria | "Quantidade de folhas/peças impressas" não muda o cálculo, e o campo `printedAreaCm2` do tipo nunca é usado. | ✅ **Aprovado:** tirar o campo da tela (e o `printedAreaCm2` do tipo). | Etapa 5 |
| T7 | Produtos | "Categoria principal (opcional)", em texto livre, convive com as **categorias** múltiplas da tela Categorias. | 🅿️ Estacionamento. | Seção 7 |
| T8 | Lojas | Dois campos para o logo: envio de imagem e "Logo (URL opcional)". | ✅ **Aprovado:** tirar o campo de URL. **Logos já cadastradas por URL continuam aparecendo** (o campo `logo` do registro não muda). | Etapa 5 |
| T9 | Estoque × Matéria-prima | Estoque só tem +1/−1 e um contador, e o mesmo saldo é editado em Matéria-prima. | 🅿️ Estacionamento. | Seção 7 |
| T10 | Histórico | O botão "Gerar Nota Fiscal" gera um PDF que **não é nota fiscal** (`pdf.ts:256` diz "representação"). Pode confundir o cliente. | ✅ **Aprovado:** renomear para **"Recibo"** (botão, mensagens e título do PDF). | Etapa 5 |
| T11 | Usuários | Ao aprovar, a função diz notificar por e-mail e WhatsApp, mas só escreve no console (`Users.tsx:97-104`). | ✅ **Aprovado:** remover a função que finge notificar. A notificação real fica no estacionamento. | Etapa 5 |
| T12 | Fornecedores | O campo "desconto" existe no registro, mas não há onde digitar (sempre 0). **Correção (18/10/2026):** havia campo "Desconto (%)"; não entrava em conta nenhuma. | ✅ **Aprovado:** remover (registros antigos mantêm o valor no banco). Confirmado de novo em 18/10/2026. | Etapa 5 |
| T14 | Matéria-prima | O campo de estoque mínimo não diz que é opcional; vazio, é gravado como 0. O código já trata 0 como "sem mínimo" (`isLowStock` em `lib/utils.ts`, usada também pela Lista de Compras). Ao começar, conferir todas as telas que mostram alerta de estoque e deixar o campo claramente opcional. | ✅ **Aprovado (18/10/2026):** estoque mínimo opcional. Itens sem mínimo não geram alerta de estoque baixo nem entram na lista de compras por falta de mínimo. Não muda preço. | Etapa 5 |

---

## 6. Plano por etapa

Em cada etapa: um commit por item, `npm run lint`, `npx prettier --check src` e `npm run build`, e teste pelo checklist antes de seguir. Dá para voltar a qualquer momento pela tag `antes-de-enxugar`.

### Etapa 3 — Remover lixo (sem mudar nada que o usuário vê)

| Item | Risco |
|---|---|
| Apagar `src/components/PWAInstall.tsx` | baixo |
| Apagar `checkFollowUps`, `generateFollowUpMessage`, `signInWithGoogle`/`googleProvider`, `isFirebaseConfigured`, `LaserMachineId` | baixo |
| Tirar os 5 `console.log` de depuração | baixo |
| Parar de gravar `followUpStatus` (o campo antigo fica no banco) | baixo |
| Remover `date-fns`, `motion` e `react-markdown` do `package.json` | baixo |
| Apagar `docs/` e `index_Old.html` | baixo |

> **Onde o app está publicado (conferido em 17/10/2026, só leitura):** apenas no **Firebase Hosting** —
> `https://saas-1-0-0.web.app` e `https://saas-1-0-0.firebaseapp.com` (HTTP 200), servindo a pasta `dist/`
> (`firebase.json` → `"public": "dist"`). O **GitHub Pages está desligado**: a API do GitHub responde
> `has_pages: false`, `https://acavernapersonalizados-cloud.github.io/SaaS-1.0.0/` dá 404 e não existe branch
> `gh-pages` (só `main` e `validacao`). Portanto **a pasta `docs/` não é usada em nenhuma publicação**.
| Apagar `bun.lock` (fica só o `package-lock.json` do npm) | baixo |
| Apagar `public/manifest.webmanifest` (o real é gerado pelo `vite.config.ts`) | baixo |
| Pôr `.firebase/` no `.gitignore` e tirar o cache do git | baixo |
| `.agents/` e `skills-lock.json` | — **ficam** (decisão de 17/10/2026) |
| `ATUALIZACAO-MAQUINAS.md` | — **fica** (decisão de 17/10/2026) |

### Etapa 4 — Unificar duplicação (mesmo comportamento, menos código)

**Grupo A — contas e textos: ✅ feito (17/10/2026), tag `etapa-4-ok`.**

| Item | Resultado | Risco |
|---|---|---|
| A1–A3 (D4–D6): `energyCost`, `wearCost`, `laborCostFromMinutes` e `laborCostFromHours` no `pricingEngine.ts`, usadas por Laser, Papelaria, Cestas e 3D | 80.000 comparações antigo × novo, 0 diferenças (bit a bit) | baixo |
| A4 (novo): custo unitário de compra em `lib/materials.ts`, usado em Matéria-prima e Lista de Compras | teste criado antes (seções 7 e 16) | baixo |
| A5 (D10): valores padrão em `lib/defaults.ts`, com os mesmos números | teste criado antes | baixo |
| A6 (D8): `analyzeJobPrice` para Laser, Papelaria e Cestas; `analyzeManualPrice` ficou como estava (formato diferente) | 9 snapshots do texto exato enviado à IA, iguais | baixo |
| A7 (D11): `primaryColorOf`, `itemRows`, `sectionTitle` e `savePdf` nos 3 PDFs (o cabeçalho já era comum) | 6 snapshots de todos os comandos de desenho, iguais; −27 linhas | médio |

Saldo do Grupo A no código do app: +30 linhas (helpers, arquivos novos e comentários); o ganho é cada conta e texto num lugar só e com teste (49 → 76 testes).

**Grupo B — componentes de tela: ✅ feito (18/10/2026), tag `etapa-4b-ok`.**

Rede de segurança: `jsdom` e `@testing-library/react` (só para testes) e `src/components/screens.test.tsx`, que
grava o HTML de 15 telas em 39 estados (lista, busca, janela de exclusão, escolha de material, resultado, preço
manual e prejuízo), com Firebase, login e loja simulados (`src/test/`). Cada item foi conferido duas vezes: pelos
snapshots e comparando o HTML final (`DUMP_HTML`) antigo × novo caractere a caractere. Todos deram 0 diferenças.

| Item | Resultado | Ficou de fora (e por quê) |
|---|---|---|
| B1a (D9): `ConfirmDeleteModal` em Clientes, Histórico, Matéria-prima, Lojas e Fornecedores | HTML igual | Usuários: a janela de exclusão tem outro desenho |
| B1b (D9): `SearchBar` em Matéria-prima, Clientes, Fornecedores, Histórico e Estoque | HTML igual | Catálogo, Produtos, Catálogo público e Lista de Compras: classes próprias (mudaria o visual) |
| B2 (D2): `JobHistoryList` em Papelaria, Cestas e Laser | HTML igual | Impressão 3D: tabela diferente. `useStoreJobs` **não feito**: cada tela junta outras leituras no mesmo efeito, o ganho seria ~15 linhas e a exclusão não tem teste |
| B3 (D1): `StockMaterialPicker` em Papelaria e Cestas | HTML igual (o Prettier mudou só a divisão interna do texto do React; o HTML final é o mesmo) | As abas e o item avulso ficaram em cada tela |
| B4 (D3): `SuggestedPrice` e `ManualPriceCheck` (`PriceResultCard.tsx`) em Laser, Papelaria e Cestas | HTML igual, inclusive o aviso de prejuízo das 3 telas | Impressão 3D: as mesmas classes estão em outra ordem (mudaria o HTML). A "Composição" de cada tela tem linhas próprias e ficou em cada tela |

### Etapa 5 — Peso e telas aprovadas

**✅ Feita (18/10/2026), tag `etapa-5-ok`.** Conferida no app com o emulador em 1366×768, 1366×650 (notebook com as
barras do navegador) e 375×812 (celular). Dados de teste novos no seed do emulador: cliente, fornecedor, produto e 2
orçamentos.

| Item | Resultado | Risco |
|---|---|---|
| **T13a:** rodapé fixo nas janelas | Salvar/Cadastrar sempre visível (rodapé `sticky`, janela até 90% da tela) em Novo Insumo (que não rolava), Cliente, Fornecedor, Produto, Máquina (Laser), Impressora (3D), Usuário, Orçamento Gerado, prévia do Backup e Detalhes do Orçamento | médio |
| **T13b:** ações sem esconder | Botões de ação sempre visíveis em Laser, Lojas, Usuários, Produtos e Fornecedores; sobre imagens (foto do produto, logo), sempre visíveis em telas sem mouse; coluna "Ações" presa à direita em Matéria-prima e Histórico | médio |
| Carga inicial menor | O ajudante do Vite e o React tinham ido parar nos pacotes de PDF e de gráficos; agora têm pacote próprio, o Dashboard carrega sob demanda e o PDF só baixa quando é pedido. Abertura: **1.778 → 989 KB (−44%)** | médio |
| T1 | Total gasto, nº de orçamentos e última compra contam **só orçamentos Aprovados, Em produção e Finalizados** (regra de 18/10/2026; pendentes não contam). Orçamento sem `clientId` (nome digitado na Precificação sem escolher da lista) é ligado pelo nome, quando um único cliente tem esse nome. A janela de detalhes usa a mesma ligação (`lib/clientStats.ts`, 10 testes) | baixo |
| T5 | Laser deixa de gravar largura e altura | baixo |
| T6 | Papelaria sem "folhas/peças impressas" e sem `printedAreaCm2` | baixo |
| T8 | Lojas sem "Logo (URL)"; logos antigas continuam aparecendo | baixo |
| T10 | "Gerar Recibo": botão, mensagens, título, rodapé e nome do PDF (`Recibo_…pdf`) | baixo |
| T11 | Sem a função que fingia notificar e sem a promessa de e-mail na janela de aprovar | baixo |
| T12 | Desconto de fornecedor removido (havia campo; ver correção na seção 5) | baixo |
| T14 | Estoque mínimo opcional (não é mais obrigatório); Estoque mostra "—" sem mínimo | baixo |
| ~~Quebrar `Products.tsx` e `Pricing.tsx`~~ | **Movido para o início da Etapa 8** (decisão de 18/10/2026), que já vai mexer nessas telas | — |

Nenhum item aprovado da Etapa 5 muda preço ou cálculo.

#### T13 — Botões ocultos (aprovado em 17/10/2026; primeiro item da Etapa 5)

- **Janelas de cadastro/edição (modais):** os botões **Salvar** e **Cancelar** ficam num **rodapé fixo**, sempre
  visíveis, sem precisar rolar a janela. Exemplo: cadastro de **Matéria-prima**.
- **Tabelas:** os botões de ação (editar, excluir etc.) ficam **visíveis sem rolagem lateral** e **sem depender de
  passar o mouse**. Exemplo: coluna **"Ações"** da Matéria-prima, que hoje fica cortada.
- **Primeiro passo quando a Etapa 5 começar:** levantar **todas as telas** com esse problema (modais com botões
  fora da área visível e tabelas com ações cortadas ou que só aparecem ao passar o mouse), em tela de computador e
  de celular, e só então corrigir.
- **Caso já encontrado (18/10/2026):** com zoom de 100%, o botão **Cadastrar Material** do modal **Novo Insumo**
  fica inacessível — a janela passa da altura da tela e não rola. Só aparece com zoom de 80%.
- Não muda preço, cálculo nem campo: só a posição e a visibilidade dos botões.

### Etapa 6 — Validação final

Você testa o app no Firebase Emulator (configurado na Etapa 2) seguindo o `CHECKLIST-TESTES.md`. Depois vêm o code review, o build e a publicação. A Etapa 7 só começa depois dela.

**✅ Feita (19/10/2026), tag `etapa-6-ok`.**

| Item | Resultado |
|---|---|
| Checklist | Atualizado para as Etapas 3 a 5 (`80f64b5`): dados do seed, Ctrl+C para o emulador exportar, campos removidos, mínimo opcional, Recibo, números do cliente e nova seção 18 (botões no computador e no celular) |
| Code review | Nada a corrigir. Conferido no emulador, com as regras atuais: GERENTE e OPERADOR aprovados leem os orçamentos da loja (tela de Clientes); operador de outra loja e usuário pendente são negados. Build de produção aponta só para `saas-1-0-0` |
| Testes, lint e build | 121 testes, lint, Prettier e build passando |
| Seus testes no emulador | Checklist completo, sem erros |
| Backup do banco real | Feito por você pela tela de Backup (só exportar): `backup_precifica_ja_2026-10-19.json`, versão 2, completo, 0 falhas, 2 lojas, 18 coleções, 882 documentos; conteúdo idêntico ao backup de 17/10 (fora a data) |
| Publicação | Só o site (`firebase deploy --only hosting`), regras do banco intactas. O site entrega o mesmo build local (abertura de 989 KB), login sem erros no console, e você conferiu o app publicado |

### Etapa 7 — Unificar parâmetros de preço (T4, T2, T3)

**Ampliado em 18/10/2026:** o T4 passa a ser uma **tabela única e editável de canais de venda por loja** (detalhes abaixo da tabela).

**Só começa depois da Etapa 6.** Estes itens **mudam preços**, então:

1. **Antes de qualquer mudança no código**, gerar uma comparação de preço **antes/depois com produtos e trabalhos reais** das lojas (leitura do banco, sem gravar), mostrando para cada um: preço hoje, preço novo e diferença em R$ e %.
2. Você aprova a comparação.
3. Só então aplicar, um item por vez, na ordem abaixo, repetindo a comparação a cada item.

| Ordem | Item | O que muda | Risco |
|---|---|---|---|
| 1 | **Remover o Elo7** (plataforma encerrada pela Enjoei) — sai da lista de canais para novos orçamentos e das calculadoras; o histórico continua como está (detalhes abaixo) | Nenhum preço já gravado. Só deixa de existir a opção Elo7 para trabalhos novos | baixo |
| 2 | **T4** — tabela única e editável de canais de venda por loja, usada pelos Orçamentos e por todas as calculadoras | O preço de orçamentos e de trabalhos das calculadoras em canais como Shopee e Mercado Livre | alto |
| 3 | T2 — calculadoras abrem com o valor da hora e a Meta de Lucro da Base de Custos (campos continuam editáveis) | O preço sugerido de quem não alterar os campos | alto |
| 4 | T3 — uma tarifa de energia só, na Base de Custos, para Laser e 3D | O custo de energia (hoje 0,78938 no Laser e 0,85 na 3D) | médio |

Orçamentos e trabalhos já gravados não mudam: eles guardam os valores do momento em que foram criados.

**✅ Feita e publicada (19/10/2026), tag `etapa-7-ok`.** Backup do banco real conferido antes da publicação: completo, 0 falhas, 885 documentos; os 59 preços de catálogo da T&N estavam zerados pela versão antiga (sincronização com a meta de 100%) e voltam aos valores exatos da manhã (59 de 59) na primeira abertura de Produtos na T&N. Comparação antes/depois aprovada com o backup do banco
real de 19/10 (só leitura); refeita no fim com o código final: **65 de 65 produtos com preço igual ao do catálogo
gravado** (T&N volta a ter preço; A Caverna não muda), nenhum sem preço.

| Item | Resultado |
|---|---|
| 1. Proteção do catálogo | A tela Produtos nunca grava R$ 0 por cima de um preço existente (`lib/catalog.ts`) |
| 2. Avisos | "Base de Custos — <loja>" no título; "Meta de Lucro inválida — ajuste na Base de Custos" em vez de R$ 0,00 |
| 3. Elo7 | Removido (nenhum registro real usava) |
| 4. Markup sobre o custo (0–500%) | Base de Custos, Produtos, orçamento e calculadoras. Conversão na leitura: margem ÷ (1 − margem); 95% ou mais já era markup (T&N 100% → 100%; A Caverna 60% → 150%). Ao salvar, grava `markupPct` (e a margem equivalente em `profitGoal`). A margem real depois das taxas aparece ao lado. Nos canais com taxa, o preço cai ~30% em relação à regra de margem (mesmo lucro em R$ da venda direta) |
| 5. Tabela única de canais por loja | Em `costBases/{loja}.salesChannels`, editável na Base de Custos (comissão, taxa fixa, pagamento, observação, conferido em). Valores: Venda Direta 0%, Instagram 3,5%, Atacado 5%, Shopee 20% + R$ 4 (opção A: markup também sobre a taxa fixa), Mercado Livre 18%, iFood 26,5%, 99Food 13%. Usada pelo orçamento, pela 3D e (campo novo) por Laser, Papelaria e Cestas |
| 6. T2 | As calculadoras abrem com o valor da hora e o markup da Base de Custos (editáveis) |
| T3 | **Adiado** (sem a tarifa de energia real) |

Testes: 121 → 149. Regras do banco não mudaram.

#### Remover o Elo7 (primeiro item da Etapa 7, decidido em 19/10/2026)

O Elo7 foi encerrado pela Enjoei.

- **Sai da lista de canais** para novos orçamentos e das calculadoras.
- **Nada do histórico é apagado nem recalculado:** orçamentos, trabalhos e produtos antigos que usam Elo7 continuam
  aparecendo com o nome e os valores originais.
- **Antes de mexer no código, levantar (só lendo o banco real) quantos registros usam Elo7**, por coleção, e mostrar
  o resultado para você.
- Onde está hoje (19/10/2026): só na tabela de canais da **Impressão 3D** (`src/lib/printPricing.ts`, comissão de
  12%). A Precificação e as outras calculadoras não têm Elo7. Os trabalhos 3D guardam o canal escolhido; a tela
  precisa continuar mostrando "Elo7" nos trabalhos antigos mesmo depois de ele sair da lista.

#### T4 — Tabela de canais de venda (ampliado em 18/10/2026)

- **Uma tabela só, por loja, editável na tela.** Cada canal tem:
  - comissão (%);
  - taxa fixa (R$);
  - taxa de pagamento (%);
  - observação;
  - data da última conferência.
- **Quem usa:** os Orçamentos (Precificação) e **todas as calculadoras** (Corte a Laser, Impressão 3D, Papelaria e
  Cestas). Hoje há duas tabelas fixas no código, com valores diferentes (orçamento: Shopee 20%; 3D: Shopee 14% + R$ 4).
- **Canais novos:** **iFood** e **99Food**. **Os valores serão preenchidos por você, conforme o seu
  contrato**: o app não inventa taxas para eles. O **Keeta** saiu da Etapa 7 por ora (19/10/2026) e está no
  Estacionamento.
- **Taxas informadas por você (19/10/2026):** Shopee **20% + R$ 4,00 por produto** · iFood **26,5%** ·
  99Food **13%** · Mercado Livre: você quer a **API oficial**, que está prevista na **Etapa 9**.
- **Comparação antes/depois feita (19/10/2026)** com o backup do banco real de 19/10 (só leitura): nenhum registro
  usa Elo7; os 2 orçamentos, o trabalho 3D e os 65 produtos gravados não mudam; na Shopee, os R$ 4 fixos aumentam o
  preço por unidade de orçamentos novos.
- A comparação de preço antes/depois (passos 1 a 3 acima) vale também para esta tabela.

### Etapa 7.1 — Segurança

**✅ Feita (19/10/2026), tag `etapa-7.1-ok` (não publicada).** Puxada do Estacionamento depois da publicação da
Etapa 7, quando uma aba com a versão antiga regravou R$ 0 no catálogo da T&N.

| Item | Resultado |
|---|---|
| 1a. Aviso de nova versão | O app procura versão nova a cada 5 minutos e ao voltar para a aba; quando acha, mostra "Nova versão disponível". O PWA passou de `autoUpdate` (recarregava sozinho, sem aviso) para `prompt` |
| 1b. Versão antiga não grava | A janela de aviso cobre a tela (nada pode ser salvo) até "Atualizar agora"; a sincronização do catálogo para. Conferido com dois builds seguidos ligados ao emulador |
| 1c. Regra do banco | `products`: update recusa trocar `catalogPrice` > 0 por 0, de qualquer versão. Criar sem preço, mudar o preço e ocultar do catálogo continuam livres (testado no emulador: zerar = 403, o resto = 200). **Exceção rara:** restaurar um backup com preço 0 por cima de um produto com preço é recusado |
| 1d. Versão visível | "versão dd/mm hh:mm" no menu lateral |
| 2. Catálogo sem silêncio | Falhas da sincronização viram um aviso só, com a quantidade e o motivo |
| 2b. Estoque sem silêncio | Registros de movimento e falhas de reserva, baixa e liberação mostram aviso; a baixa que falha avisa que o estoque NÃO foi baixado |
| 3. Checklist | Markup, tabela de canais (margem real por canal), orçamento nos 7 canais, calculadoras, aviso de versão |

Testes: 149 → 155.

### Etapa 8 — Central de Calculadoras

**Só começa depois da Etapa 7. Por enquanto é só planejamento:** o detalhamento (telas, campos, riscos e testes) será feito quando a etapa começar.

- **Primeiro item (vindo da Etapa 5):** dividir `Products.tsx` (1.342 linhas) e `Pricing.tsx` (1.142) em partes menores, sem mudar nada na tela, com os testes de HTML da Etapa 4B como rede de segurança.
- As 4 calculadoras (Corte a Laser, Impressão 3D, Papelaria e Cestas) **continuam independentes**, mas ficam numa **única guia do menu**.
- Um **trabalho salvo** pode ser transformado em **Produto** e publicado no **Catálogo**, na hora ou depois.
- **Acrescentado em 19/10/2026 (não implementar antes da Etapa 8):**
  - **Preço manual com respaldo:** ao digitar um preço manual, mostrar o **lucro real em cada canal** (depois das
    taxas) e se ele fica **acima ou abaixo da meta**. A análise de mercado por IA continua existindo, mas só como
    opinião.
  - **Preço sugerido por canal de venda, numa tabela:** para cada produto, o preço sugerido em cada canal da tabela
    de canais (T4), lado a lado.
  - **Catálogo com preço no Pix e preço no crédito** (com a taxa do cartão embutida no preço do crédito), com
    opção de escolher o que aparece no catálogo.
  - **Markup extra opcional por canal** na tabela de canais (19/10/2026): com o markup da Etapa 7, Shopee e Mercado
    Livre ficam ~30% mais baratos que hoje (o lucro em R$ fica igual ao da venda direta). Um campo opcional por
    canal permite cobrar a mais em um canal específico, se você quiser.

### Etapa 9 — Monitor de taxas

**Só começa depois da Etapa 8. Por enquanto é só planejamento:** o detalhamento será feito quando a etapa começar.
Depende da tabela de canais do T4 (Etapa 7), que guarda a data da última conferência.

- **Aviso no app** quando um canal estiver há **mais de 60 dias sem conferência**.
- **Comissão do Mercado Livre pela API oficial**, se for viável.
- **Verificação mensal assistida por IA:** pesquisa as páginas oficiais dos canais e **envia para você as mudanças
  encontradas, com as fontes**.
- **Nada é alterado no app sem a sua aprovação.**

---

## 7. Estacionamento (não é enxugamento — para depois)

- **Ícone do app instalado quebrado:** o manifesto aponta para `pwa-192x192.png` e `pwa-512x512.png`, que não existem, e o `includeAssets: ['favicon.ico']` também não existe. Criar os ícones.
- **Deploy automático:** cadastrar os secrets `VITE_FIREBASE_*` no GitHub para o merge na `main` voltar a publicar.
- **Testes automáticos** dos cálculos (motor de preços, 3D, G-code), que hoje são feitos com scripts avulsos.
- **Follow-up de orçamentos por WhatsApp:** lembrar o cliente de um orçamento pendente ("Seu orçamento ainda está disponível…"). O código antigo era só um esboço sem uso — `checkFollowUps()` vazio em `automations.ts` e `generateFollowUpMessage()` em `whatsapp.ts` — e foi **removido na Etapa 3** (itens 2 e 3). Para fazer de verdade: rotina no servidor (Cloud Functions) que acha orçamentos pendentes há X dias e envia a mensagem, e uma tela para ligar/desligar. O campo `followUpStatus` dos orçamentos antigos ficou no banco e no tipo (opcional).
- **T7 — Categoria principal em Produtos:** ficar só com as categorias múltiplas (exige reclassificar produtos que só têm a categoria em texto).
- **T9 — Estoque × Matéria-prima:** levar o ajuste rápido +1/−1 para Matéria-prima ou manter Estoque como atalho.
- **Notificação real ao aprovar usuário** (e-mail ou WhatsApp). O T11 só remove a notificação falsa.
- **Estatísticas do cliente** calculadas no servidor: o T1 calcula na tela, a partir dos orçamentos; levar para o servidor se ficar lento com muitos orçamentos.
- **Margem padrão das calculadoras (60%):** avaliar um valor menor, agora que é margem sobre o preço.
- **Segurança:** a chave do Gemini vai no código do navegador (`VITE_GEMINI_API_KEY`); mover a chamada para o servidor.
- **`npm audit`:** a instalação limpa no GitHub mostrou 17 vulnerabilidades em dependências (4 moderadas, 13 altas) na versão antiga; rever na versão atual.
- **Lista de Compras:** o registro de compra atualiza o estoque sem transação (`PurchaseList.tsx`), diferente do resto do app.
- **Janela de exclusão de Clientes com largura `max-md`** (`Clients.tsx`): provável erro de digitação de `max-w-md`. Mantido igual na Etapa 4B, porque corrigir muda o visual.
- **Unificações de tela que ficaram de fora na Etapa 4B:** janela de exclusão de Usuários; buscas de Catálogo, Produtos, Catálogo público e Lista de Compras; histórico e cartão de resultado da Impressão 3D; `useStoreJobs`. Todas exigem aceitar uma pequena mudança visual ou ter teste da exclusão primeiro.
- **Estoque Atual não aceita 0 no cadastro de Matéria-prima** (`Materials.tsx`): o campo é obrigatório e mostra 0 como vazio, então não dá para cadastrar um insumo com estoque zero. Mesmo problema que o T14 resolveu no estoque mínimo (encontrado em 18/10/2026).
- **Precificação: mensagem de PDF gerado antes de o PDF ficar pronto** (`Pricing.tsx`, botões do Orçamento Gerado): falta `await` na geração, então "gerado com sucesso" aparece mesmo se der erro. No Histórico já está certo.
- **Desconto de fornecedor aplicado de verdade no custo da matéria-prima** (campo que reduz o custo unitário). O campo antigo, que não entrava em conta nenhuma, foi removido no T12 (Etapa 5); fornecedores antigos ainda guardam o valor `discount` no banco. **Muda preço:** entra com comparação antes/depois, como na Etapa 7.
- **Keeta como canal de venda:** retirado da Etapa 7 em 19/10/2026, a seu pedido. Volta para a tabela de canais quando você tiver a taxa do contrato.
- **Impressão 3D: sem impressora selecionada, a mensagem deveria pedir para cadastrar/selecionar uma impressora.** Hoje o Resultado mostra "Preencha os parâmetros para calcular." mesmo com todos os campos preenchidos, porque a conta exige uma impressora (`PrintCalculator.tsx:172`). Comportamento igual na tag `antes-de-enxugar` (conferido em 17/10/2026): não foi causado pelo enxugamento. Vale conferir o mesmo no Corte a Laser, que também exige máquina.
