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
| 2 — Rede de segurança | Configurar o Firebase Emulator para o `npm run dev` usar um banco local, e criar testes automáticos do motor de preços e das 4 calculadoras com os valores do `CHECKLIST-TESTES.md`. Não muda o app. | ⏳ Pendente |
| 3 — Remover lixo | Ver seção 6. | ⏳ Pendente |
| 4 — Unificar duplicações | Ver seção 6. Os testes da Etapa 2 têm que dar os mesmos números antes e depois. | ⏳ Pendente |
| 5 — Peso e telas aprovadas | Ver seção 6 (inclui T1, T5, T6, T8, T10, T11 e T12). | ⏳ Pendente |
| 6 — Validação final | Você testa o app no emulador seguindo o `CHECKLIST-TESTES.md`; depois code review, build e publicação. | ⏳ Pendente |
| 7 — Unificar parâmetros de preço | T4, T2 e T3, só depois da Etapa 6. Ver seção 6. | ⏳ Pendente |

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
| Campo `discount` no formulário de Fornecedores | 4 pontos (`Suppliers.tsx:47,108,141,299`) | O valor é zerado e copiado, mas **não existe campo na tela** para digitar; sempre grava 0. **Decidido (T12): remover**, na Etapa 5. |
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
| `ATUALIZACAO-MAQUINAS.md` | 2 KB | Notas de uma versão antiga ("Extraia este ZIP…"). Não é lixo de código; decidir se fica. |
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
| T4 | Precificação × Impressão 3D | Duas tabelas de canais diferentes: o orçamento usa Shopee 20%, e a 3D usa Shopee 14% + R$ 4. | ➡️ Uma tabela só de canais, com taxa percentual e fixa. **Primeiro item da Etapa 7.** | Etapa 7 |
| T5 | Corte a Laser | Largura e altura da peça são gravadas, mas não aparecem na tela (sempre 100 × 100 mm). | ✅ **Aprovado:** deixar de gravar (trabalhos antigos mantêm o valor no banco). | Etapa 5 |
| T6 | Papelaria | "Quantidade de folhas/peças impressas" não muda o cálculo, e o campo `printedAreaCm2` do tipo nunca é usado. | ✅ **Aprovado:** tirar o campo da tela (e o `printedAreaCm2` do tipo). | Etapa 5 |
| T7 | Produtos | "Categoria principal (opcional)", em texto livre, convive com as **categorias** múltiplas da tela Categorias. | 🅿️ Estacionamento. | Seção 7 |
| T8 | Lojas | Dois campos para o logo: envio de imagem e "Logo (URL opcional)". | ✅ **Aprovado:** tirar o campo de URL. **Logos já cadastradas por URL continuam aparecendo** (o campo `logo` do registro não muda). | Etapa 5 |
| T9 | Estoque × Matéria-prima | Estoque só tem +1/−1 e um contador, e o mesmo saldo é editado em Matéria-prima. | 🅿️ Estacionamento. | Seção 7 |
| T10 | Histórico | O botão "Gerar Nota Fiscal" gera um PDF que **não é nota fiscal** (`pdf.ts:256` diz "representação"). Pode confundir o cliente. | ✅ **Aprovado:** renomear para **"Recibo"** (botão, mensagens e título do PDF). | Etapa 5 |
| T11 | Usuários | Ao aprovar, a função diz notificar por e-mail e WhatsApp, mas só escreve no console (`Users.tsx:97-104`). | ✅ **Aprovado:** remover a função que finge notificar. A notificação real fica no estacionamento. | Etapa 5 |
| T12 | Fornecedores | O campo "desconto" existe no registro, mas não há onde digitar (sempre 0). | ✅ **Aprovado:** remover (registros antigos mantêm o valor no banco). | Etapa 5 |

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
| Apagar `bun.lock` (fica só o `package-lock.json` do npm) | baixo |
| Apagar `public/manifest.webmanifest` (o real é gerado pelo `vite.config.ts`) | baixo |
| Pôr `.firebase/` no `.gitignore` e tirar o cache do git | baixo |
| `.agents/` e `skills-lock.json` | — **ficam** (decisão de 17/10/2026) |
| `ATUALIZACAO-MAQUINAS.md` | **só com sua confirmação** (ainda não decidido) |

### Etapa 4 — Unificar duplicação (mesmo comportamento, menos código)

| Item | Risco |
|---|---|
| D4–D6: funções `laborCost`, `energyCost` e `wearCost` no motor, conferidas com os números do checklist (seções 12–15) | baixo |
| D10: padrões num arquivo só, com os mesmos valores de hoje | baixo |
| D11: cabeçalho e rodapé dos PDFs | baixo |
| D8: uma função só de análise por IA | baixo |
| D9: `SearchBar` e `ConfirmDeleteModal` nas telas de cadastro | médio |
| D2: histórico de trabalhos (`useStoreJobs` + `JobHistoryList`) | médio |
| D1: `MaterialPicker` em Papelaria e Cestas | médio |
| D3: `PriceResultCard` nas 4 calculadoras | médio |

### Etapa 5 — Peso e telas aprovadas

| Item | Risco |
|---|---|
| Carregar gráficos e PDF só quando usados (Dashboard sob demanda e ajuste do `manualChunks`): carga inicial −45% | médio |
| T1: Clientes mostram total gasto, nº de orçamentos e última compra reais | baixo |
| T5: Laser deixa de gravar largura e altura | baixo |
| T6: Papelaria sem o campo "folhas/peças impressas" | baixo |
| T8: Lojas sem o campo "Logo (URL)", mantendo a exibição das logos já cadastradas | baixo |
| T10: "Gerar Nota Fiscal" vira "Recibo" | baixo |
| T11: remover a notificação falsa ao aprovar usuário | baixo |
| T12: remover o desconto de fornecedor | baixo |
| Quebrar `Products.tsx` e `Pricing.tsx` em partes menores, depois das etapas acima | médio |

Nenhum item aprovado da Etapa 5 muda preço ou cálculo.

### Etapa 6 — Validação final

Você testa o app no Firebase Emulator (configurado na Etapa 2) seguindo o `CHECKLIST-TESTES.md`. Depois vêm o code review, o build e a publicação. A Etapa 7 só começa depois dela.

### Etapa 7 — Unificar parâmetros de preço (T4, T2, T3)

**Só começa depois da Etapa 6.** Estes itens **mudam preços**, então:

1. **Antes de qualquer mudança no código**, gerar uma comparação de preço **antes/depois com produtos e trabalhos reais** das lojas (leitura do banco, sem gravar), mostrando para cada um: preço hoje, preço novo e diferença em R$ e %.
2. Você aprova a comparação.
3. Só então aplicar, um item por vez, na ordem abaixo, repetindo a comparação a cada item.

| Ordem | Item | O que muda | Risco |
|---|---|---|---|
| 1 | **T4** — uma tabela só de canais de venda (taxa % + taxa fixa), usada por Precificação e Impressão 3D | O preço de orçamentos ou de trabalhos 3D em canais como Shopee e Mercado Livre | alto |
| 2 | T2 — calculadoras abrem com o valor da hora e a Meta de Lucro da Base de Custos (campos continuam editáveis) | O preço sugerido de quem não alterar os campos | alto |
| 3 | T3 — uma tarifa de energia só, na Base de Custos, para Laser e 3D | O custo de energia (hoje 0,78938 no Laser e 0,85 na 3D) | médio |

Orçamentos e trabalhos já gravados não mudam: eles guardam os valores do momento em que foram criados.

---

## 7. Estacionamento (não é enxugamento — para depois)

- **Ícone do app instalado quebrado:** o manifesto aponta para `pwa-192x192.png` e `pwa-512x512.png`, que não existem, e o `includeAssets: ['favicon.ico']` também não existe. Criar os ícones.
- **Deploy automático:** cadastrar os secrets `VITE_FIREBASE_*` no GitHub para o merge na `main` voltar a publicar.
- **Testes automáticos** dos cálculos (motor de preços, 3D, G-code), que hoje são feitos com scripts avulsos.
- **Follow-up de orçamentos** (era o `checkFollowUps`): lembrete automático via Cloud Functions.
- **T7 — Categoria principal em Produtos:** ficar só com as categorias múltiplas (exige reclassificar produtos que só têm a categoria em texto).
- **T9 — Estoque × Matéria-prima:** levar o ajuste rápido +1/−1 para Matéria-prima ou manter Estoque como atalho.
- **Notificação real ao aprovar usuário** (e-mail ou WhatsApp). O T11 só remove a notificação falsa.
- **Estatísticas do cliente** calculadas no servidor: o T1 calcula na tela, a partir dos orçamentos; levar para o servidor se ficar lento com muitos orçamentos.
- **Margem padrão das calculadoras (60%):** avaliar um valor menor, agora que é margem sobre o preço.
- **Segurança:** a chave do Gemini vai no código do navegador (`VITE_GEMINI_API_KEY`); mover a chamada para o servidor.
- **`npm audit`:** a instalação limpa no GitHub mostrou 17 vulnerabilidades em dependências (4 moderadas, 13 altas) na versão antiga; rever na versão atual.
- **Lista de Compras:** o registro de compra atualiza o estoque sem transação (`PurchaseList.tsx`), diferente do resto do app.
