# Plano de Enxugamento — PrecificaAteliê

## Regras

1. **Uma etapa por vez.** A próxima só começa quando a anterior estiver feita.
2. **Cada etapa termina com:** testes + `npm run lint` + `npm run build` + commit + tag `etapa-N-ok`.
3. **Ideias novas vão para o Estacionamento** (seção 7), não entram na etapa em andamento.
4. **Enxugar não muda nenhum preço.** Mudanças de preço só na Etapa 7, com comparação antes/depois aprovada.
5. **REGRA FIXA (24/10/2026): o trabalho "founder" é um projeto SEPARADO** (fica em `C:\caverna-founder\`) e
   **nunca se mistura com o PrecificaAteliê**. Aqui não se lê, não se cita e não se usa nada da pasta `founder/` nem
   das sessões "founder".

## Rota

| Etapa | O que é | Status |
|---|---|---|
| 0 — Fechar o que está aberto | Juntar todas as branches na `main`, backup novo conferido, item 11 resolvido, tag `antes-de-enxugar`. | ✅ **Feita e publicada** (17/10/2026): item 11 em produção; tag `antes-de-enxugar` em `f5279f0`. |
| 1 — Diagnóstico (só leitura) | Este plano + decisões T1–T12. | ✅ **Feita** (17/10/2026), só documento, nada a publicar. |
| 2 — Rede de segurança | Firebase Emulator no `npm run dev` e testes automáticos do motor de preços e das calculadoras. | ✅ **Feita** (17/10/2026), tag `etapa-2-ok`; ferramentas de teste, nada a publicar. |
| 3 — Remover lixo | Ver seção 6. | ✅ **Feita e publicada** (17/10/2026, no ar desde 19/10/2026), tag `etapa-3-ok`. |
| 4A — Unificar duplicações (contas e textos) | Ver seção 6. | ✅ **Feita e publicada** (17/10/2026, no ar desde 19/10/2026), tags `etapa-4a-ok` e `etapa-4-ok`. |
| 4B — Unificar duplicações (telas) | Ver seção 6. | ✅ **Feita e publicada** (18/10/2026, no ar desde 19/10/2026), tag `etapa-4b-ok`. |
| 5 — Peso e telas aprovadas | Ver seção 6 (T13, T1, T5, T6, T8, T10, T11, T12 e T14). | ✅ **Feita e publicada** (18/10/2026, no ar desde 19/10/2026), tag `etapa-5-ok`. |
| 6 — Validação final | Você testa no emulador com o `CHECKLIST-TESTES.md`; code review, build e publicação. | ✅ **Feita e publicada** (19/10/2026), tag `etapa-6-ok`, a partir de `80f64b5`. |
| 7 — Unificar parâmetros de preço | Elo7 removido, tabela única de canais por loja (T4), meta como markup (T2). Ver seção 6. | ✅ **Feita e publicada** (19/10/2026), tag `etapa-7-ok`. |
| 7.1 — Segurança | Aviso de nova versão, regra contra zerar o preço do catálogo, falhas visíveis. | ✅ **Feita e publicada** (19/10/2026, site + regras do banco), tag `etapa-7.1-ok`. |
| 7.2 — Tarifa de energia única (T3) | Tarifa de energia na Base de Custos de cada loja, usada no Laser e na 3D. | ✅ **Feita e publicada** (19/10/2026), tag `etapa-7.2-ok`. |
| 8 — Central de Calculadoras | Partes 8A, 8B, 8C, 8D-1 e 8D-2, e a correção do Preço de Compra (abaixo). Ver seção 6. | ✅ **Feita e publicada** (24 a 26/10/2026). |
| 8A — Orçamento e divisão das telas | Aviso do "Gerar Orçamento"; `Products.tsx` e `Pricing.tsx` divididos. | ✅ **Feita e publicada** (24/10/2026), tag `etapa-8a-ok`. |
| 8B — Menu e preço por canal | Nomes no menu, guia única "Calculadoras", preço manual com respaldo, preço sugerido por canal. | ✅ **Feita e publicada** (24/10/2026), tag `etapa-8b-ok`. |
| 8C — Canais e catálogo | Atacado por quantidade, Pix e crédito, Instagram 0%, trabalho salvo vira Produto (item 8 → Estacionamento). | ✅ **Feita e publicada** (item 3 em 25/10/2026; item 4 em 26/10/2026, com as correções de custo, sugerido e centavos publicadas em 26/10/2026). |
| 8D-1 — Sublimação: máquinas e tabela | Aba "Sublimação" com máquinas e tabela de referência (40 linhas). | ✅ **Feita e publicada** (24/10/2026, regras do banco + site), tag `etapa-8d1-ok`. |
| 8D-2 — Sublimação: custo e preço | Custo por peça, preço sugerido, preço manual e histórico de trabalhos. | ✅ **Feita e publicada** (24/10/2026, regras do banco + site), tag `etapa-8d2-ok`. |
| Correção do Preço de Compra | Matéria-prima e Lista de Compras: escolher "por unidade" ou "valor total pago". | ✅ **Feita e publicada** (24/10/2026), tag `preco-compra-ok`. |
| 9 — Monitor de taxas | 9A aviso de 60 dias, 9B Mercado Livre pela API, 9C verificação de taxas com IA. Ver seção 6. | ✅ **Feita e publicada** (26/10/2026): 9A e 9C; 9B foi para a Etapa 10. |
| 10 — Ferramentas de venda | Registrada em 25/10/2026. Ver seção 6. | ⏸️ **Fora do projeto** (o projeto termina na Etapa 9, decidido em 26/10/2026); fica só registrada. Recebeu em 26/10/2026 o 9B (Mercado Livre pela API) e o lembrete de orçamento por WhatsApp. |

**Onde paramos (26/10/2026):**

- No ar (26/10/2026, `index-CEo5kbog.js`): Etapas 0 a 9 completas, **regras do Storage por loja** e a **IA pelo
  Firebase AI Logic + App Check** (nenhuma chave do Gemini no site, conferido no site publicado).
- **Falta você, no site:** (1) "Atualizar agora"; (2) testar "Verificar taxas com IA"; (3) funcionou → App Check →
  APIs → Firebase AI Logic → **Exigir** e testar de novo; (4) funcionou → **apagar a chave antiga do Gemini**;
  (5) enviar uma foto de produto (confere as regras novas do Storage); (6) "Atualizar preço do produto" na Caneca Mágica.
- Se a foto não subir: o Firebase pede uma permissão para o Storage ler o banco (console → Storage → Regras).
- Próximo item: produtos do catálogo sem custo público (seção 7.1, item 4). Código no GitHub. Nenhum item aberto.

## Entregue

O que cada etapa trouxe para quem usa o app:

- **0** — Tudo o que estava pronto foi juntado num lugar só, com cópia de segurança do banco conferida.
- **1** — Diagnóstico do app; nada mudou na tela.
- **2** — Banco de testes no computador e contas testadas sozinhas: dá para mexer sem arriscar os dados reais.
- **3** — App mais limpo: saiu código e arquivo que não eram usados.
- **4A** — As mesmas contas em todo lugar: o mesmo produto dá o mesmo preço em qualquer tela.
- **4B** — Buscas, janelas de exclusão e listas de trabalhos iguais em todas as telas.
- **5** — App abre quase duas vezes mais rápido e os botões ficam sempre visíveis, no celular e no computador.
- **6** — Tudo testado por você e publicado.
- **7** — Meta de lucro como markup sobre o custo e tabela de taxas dos canais de venda de cada loja.
- **7.1** — Aviso de nova versão e o preço do catálogo nunca vira R$ 0 por engano.
- **7.2** — Tarifa de energia de cada loja, usada no Corte a Laser e na Impressão 3D.
- **8A** — "Gerar Orçamento" explica o que falta preencher.
- **8B** — Menu com "Orçamentos" e uma guia só para as calculadoras; preço manual conferido e preço por canal.
- **8C** — Desconto de atacado por quantidade, preço no Pix e no crédito, Instagram sem taxa e trabalho salvo virando
  produto.
- **8D-1** — Calculadora de Sublimação com as máquinas e a tabela de temperatura, tempo e pressão.
- **8D-2** — Custo e preço por peça na sublimação, com histórico de trabalhos.
- **Preço de Compra** — Você escolhe se o valor digitado é por unidade ou o total pago: acabou o custo errado.

## Falta

**Etapa 9 — Monitor de taxas**

- **9A** — Aviso de canal sem conferência há mais de 60 dias, com o botão "Conferi hoje" (feita e publicada).
- **9B** — Comissão do Mercado Livre pela API: foi para a Etapa 10 (exige app, login e servidor).
- **9C** — Botão "Verificar taxas com IA": mudanças sugeridas com as fontes, cada uma aprovada por você (feita e publicada).

**Estacionamento — escolhidos, nesta ordem (ver seção 7.1)**

1. Chave do Gemini: contenção de emergência no Google Cloud (você, hoje).
2. ✅ Regras do Storage por loja (feito e publicado em 26/10/2026).
3. ✅ Chave do Gemini fora do site — opção A (Firebase AI Logic + App Check): publicado em 26/10/2026; falta você ligar o "Exigir" e apagar a chave antiga.
4. Produtos do catálogo sem custo público (coleção pública só com nome, foto, descrição e preço).
5. Regras do Firestore: atualizar só documentos da própria loja.
6. Revisar o `npm audit`.
7. Lista de Compras atualizar o estoque com transação.
8. Mensagem de PDF só depois de o PDF ficar pronto.
9. Cartão do produto vindo de trabalho: "Custo da calculadora: [nome]".
10. Matéria-prima aceitar estoque 0 no cadastro.
11. Impressão 3D pedir para escolher a impressora.
12. Ícone do app instalado.
13. Laser escolher material do estoque.

**Estacionamento — decidir depois de usar o app (opcionais):** abrir trabalho salvo na calculadora; seus produtos
na tabela da sublimação; desconto de fornecedor no custo; markup extra por canal.

**Tarefas suas, fora do código**

- Revisar a auditoria das matérias-primas e corrigir pela tela as que estão erradas.
- Cadastrar as máquinas de sublimação em cada loja.
- Ajustar a impressora 3D para 150 W.

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
| T4 | Precificação × Impressão 3D | Duas tabelas de canais diferentes: o orçamento usa Shopee 20%, e a 3D usa Shopee 14% + R$ 4. | ➡️ Uma tabela só de canais, **editável e por loja** (comissão %, taxa fixa R$, taxa de pagamento %, observação e data da última conferência), usada pelos Orçamentos e por todas as calculadoras; com iFood e 99Food (18/10/2026). **Primeiro item da Etapa 7.** | Etapa 7 |
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
| T3 | Feito na **Etapa 7.2** (tarifa única de R$ 0,79/kWh na Base de Custos) |

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
  contrato**: o app não inventa taxas para eles.
- **Taxas informadas por você (19/10/2026):** Shopee **20% + R$ 4,00 por produto** · iFood **26,5%** ·
  99Food **13%** · Mercado Livre: você quer a **API oficial**, que está prevista na **Etapa 9**.
- **Comparação antes/depois feita (19/10/2026)** com o backup do banco real de 19/10 (só leitura): nenhum registro
  usa Elo7; os 2 orçamentos, o trabalho 3D e os 65 produtos gravados não mudam; na Shopee, os R$ 4 fixos aumentam o
  preço por unidade de orçamentos novos.
- A comparação de preço antes/depois (passos 1 a 3 acima) vale também para esta tabela.

### Etapa 7.1 — Segurança

**✅ Feita (19/10/2026), tag `etapa-7.1-ok`, publicada em 19/10/2026.** Puxada do Estacionamento depois da publicação da
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

### Etapa 7.2 — Tarifa de energia única (T3)

**✅ Feita (19/10/2026), tag `etapa-7.2-ok`, publicada em 19/10/2026.** Tarifa da sua conta da Enel: **R$ 0,79/kWh**
(TU 0,39492 + TE 0,39401, com tributos, faixa sem desconto social).

| Item | Resultado |
|---|---|
| Campo na Base de Custos | "Tarifa de energia (R$/kWh)" por loja; sem valor gravado mostra 0,79 com aviso, e grava ao salvar (`costBases/{loja}.electricityRate`) |
| Laser e 3D | Abrem com a tarifa da loja (mesmo mecanismo do T2), campo editável. Conferido no emulador: loja com 0,83 → Laser e 3D abrem com 0,83 |
| Padrão | Sem Base de Custos, 0,79 nas duas (antes 0,78938 no Laser e 0,85 na 3D) |
| Comparação aprovada | Laser: diferença desprezível (R$ 43,86 = R$ 43,86); 3D do checklist R$ 35,77 → R$ 35,70 (−0,18%); trabalho 3D real (1.150 W, 7,3 h), se refeito hoje, R$ 52,75 → R$ 51,38 (−2,6%). **Nada gravado foi recalculado** (o trabalho real segue com R$ 33,76) |

Testes: 155 → 157.

### Etapa 8 — Central de Calculadoras

**Dividida em três blocos (24/10/2026), cada um com tag própria:**

| Bloco | Itens | Natureza |
|---|---|---|
| **8A** ✅ **feita** (24/10/2026), tag `etapa-8a-ok` | 1. Aviso do "Gerar Orçamento"; 2. Dividir `Products.tsx` e `Pricing.tsx` | Seguro: não muda preço nem dados. Resultado abaixo |
| **8B** ✅ **feita** (24/10/2026), tag `etapa-8b-ok` | 0. Nomes no menu (24/10/2026, risco baixo, só textos): "Precificação" → "Orçamentos" (título da tela "Novo Orçamento") e "Histórico" → "Histórico de Orçamentos"; endereços e atalhos antigos continuam funcionando; 5. Preço manual com respaldo; 6. Preço sugerido por canal numa tabela; 3. As 4 calculadoras numa única guia | Só exibem, não mudam preço |
| **8C** — canais (3a, 3b, 3c) ✅ feita e publicada (25/10/2026); item 4 ✅ feito e publicado (26/10/2026, com as correções); item 8 → Estacionamento | 4. Trabalho salvo vira Produto do Catálogo; 7. Catálogo com preço no Pix e no crédito; 8. Markup extra opcional por canal. Parte de canais (aprovada em 25/10/2026, ordem 3a → 3b → 3c): 3a atacado por quantidade; 3b Pix/crédito no orçamento e Instagram 0%; 3c opção de preço no catálogo | Mudam dados/preço: só com comparação antes/depois aprovada |
| **8D** — 8D-1 ✅ **feita e publicada** (tag `etapa-8d1-ok`); 8D-2 ✅ **feita e publicada** (tag `etapa-8d2-ok`) | Calculadora de Sublimação: nova aba "Sublimação" na guia Calculadoras e aba "Tabela de referência". Ver "Bloco 8D" abaixo | Nova calculadora: cria preços novos (não muda os atuais); lista com riscos e "aprovado" antes |

**Resultado da 8C, parte 3a (atacado por quantidade):** o canal Atacado (+5%) saiu da tabela padrão (nenhuma loja tinha
tabela gravada nem orçamento com Atacado). Agora cada item do orçamento, em qualquer canal, tem desconto pela quantidade
sobre o preço de varejo: 10–29 un = 10%, 30–99 = 20%, 100+ = 30%, editável na Base de Custos (`wholesaleTiers`; sem
gravar, valem as padrão de `lib/wholesale.ts`). Piso: custo × 1,30 + taxas do canal, nunca acima do varejo; quando o
desconto passa do piso, usa o piso e mostra aviso. Acabamentos e acessórios ficam sem desconto. Os itens gravam
`wholesaleDiscountPct` e `wholesaleFloorApplied`. Com os dados reais (backup de 25/10), o piso não é atingido em nenhum
dos 73 produtos. Testes: 205 → 220; fotos das telas: só saíram a opção, a linha e a coluna "Atacado" (408 linhas).

**Resultado da 8C, parte 3b (Pix e crédito):** o preço de hoje é o preço no Pix; no crédito = Pix ÷ 0,95
(`creditPrice`, cobre os 5% do cartão). O resumo do orçamento e o orçamento gerado mostram "Total no Pix" e "No crédito";
os orçamentos novos gravam `creditTotal`, e os 3 PDFs mostram os dois totais (orçamentos antigos, sem `creditTotal`,
saem exatamente como antes, conferido pelos comandos de desenho). A pedido do usuário, o Instagram passou a 0% de taxa
(antes 3,5%), para não cobrar o cartão duas vezes: no Instagram o preço no Pix fica igual ao da Venda Direta
(ex.: Momento Paizão R$ 40,86 → R$ 39,43 no Pix e R$ 41,51 no crédito). Testes: 220 → 224.

**Resultado da 8C, parte 3c (preço no catálogo):** a tela Catálogo tem a opção "Preço no catálogo: No Pix / No crédito /
Os dois", gravada em `stores/{loja}.catalogPriceDisplay` (o documento que o catálogo público já lê; só gerente ou
administrador alteram, pela regra atual, sem mudar as regras do banco). Padrão: Pix, o mesmo preço de antes, agora com
o rótulo "no Pix". O crédito é calculado na hora (catalogPrice ÷ 0,95); nenhum produto foi regravado. Testes: 224 → 228.
Publicação: só o site.

A numeração dos itens é a da lista apresentada em 24/10/2026 (ordem abaixo).

**Resultado da 8A:**

| Item | Resultado |
|---|---|
| 1. "Gerar Orçamento" | As mensagens que já existiam aparecem abaixo do botão (vermelho = o que falta; verde = criado). Sem itens o botão continua clicável e explica "Adicione pelo menos um item". Durante a gravação o botão mostra o carregando (antes usava `loading`, sempre falso ali) |
| 2. `Products.tsx` | 1.366 → 653 linhas; tabela/cartões em `ProductList.tsx`, janela em `ProductFormModal.tsx`, Precificação e Imagens & Catálogo em `ProductFormSections.tsx`. HTML final idêntico nos 8 estados testados |
| 2. `Pricing.tsx` | 1.170 → 612 linhas; cliente, itens e resumo em `QuoteForm.tsx`, janelas de item e de orçamento gerado em `QuoteModals.tsx`, validade e rótulo de taxas em `lib/quoteFormat.ts`. HTML final idêntico nos 11 estados testados |

Testes: 157 → 167 (telas novas de Produtos e Precificação; a IA é simulada nos testes de tela). O estado, as
gravações e as contas continuam em `Products.tsx` e `Pricing.tsx`.

- **Primeiro item (24/10/2026): "Gerar Orçamento" sem resposta.** O botão não fazia nada, sem nenhum aviso. Voltou
  a funcionar em janela anônima ou preenchendo os dados. Investigar o que o clique valida e mostrar uma mensagem
  clara quando faltar algo. Leitura do código (sem alterar): `handleGenerateQuote` (`Pricing.tsx`) já tem as
  mensagens (falta cliente, falta item, valor inválido, taxa do canal, permissão, erro do banco), mas grava em
  `quoteError`/`quoteSuccess` e **nenhuma parte da tela mostra esses dois**. Além disso, o botão fica desativado sem
  explicação quando não há item (`quoteItems.length === 0`).
- **Segundo item (vindo da Etapa 5):** dividir `Products.tsx` (1.342 linhas) e `Pricing.tsx` (1.142) em partes menores, sem mudar nada na tela, com os testes de HTML da Etapa 4B como rede de segurança.
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

#### Bloco 8D — Calculadora de Sublimação (registrado em 24/10/2026)

**8D-1 ✅ feita (24/10/2026), tag `etapa-8d1-ok`, publicada em 24/10/2026 (regras do banco primeiro, depois o site; versão "24/10 20:02").** Sem custo nem preço (isso é o 8D-2). Tamanhos sempre em cm; polegadas só na prensa grande: "38 × 38 cm (15")".

| Item | Resultado |
|---|---|
| 1. Dados | `src/lib/sublimation.ts`: tabela de 40 linhas igual, linha a linha, ao `tabela-sublimacao.md` (o teste lê o arquivo); 4 máquinas padrão em 220 V; logo 15 × 15 cm da 4 em 1 ligado às linhas de "Prensa plana"; boné da 4 em 1 e mini prensa sem referência |
| 2. Banco | Coleção `sublimationMachines` com regra igual à do Laser (emulador: ADMIN e OPERADOR da loja 200; outra loja, OPERADOR apagando e sem login 403) e incluída no Backup. Sem índice novo (ordena na tela) |
| 3. Aba "Sublimação" | 5ª aba da guia Calculadoras; cadastro (adicionar/editar/excluir, só ADMIN e GERENTE) e botão "Cadastrar as 4 máquinas da tabela" quando a loja não tem nenhuma |
| 4. Parâmetros | Parte da máquina + produto preenchem temperatura, tempo e pressão (editáveis, não gravados); parte sem referência mostra "use os valores do fabricante"; aviso de tabela sugestiva e dicas |
| 5. Tabela de referência | Vista com as 40 linhas, busca sem acento e contador "N de 40" |

**Publicação do 8D-1 (quando você pedir):** primeiro as **regras do banco**
(`firebase deploy --only firestore:rules`), depois o **site** (`--only hosting`). Na ordem inversa, o Backup do
site novo sairia incompleto (sem permissão para ler `sublimationMachines`).

Testes: 178 → 188.

**8D-2 ✅ feita (24/10/2026), tag `etapa-8d2-ok`, publicada em 24/10/2026 (regras do banco primeiro, depois o site; versão "24/10 22:15").** Custo e preço da sublimação, com as mesmas funções
das outras calculadoras.

| Item | Resultado |
|---|---|
| 1. Conta | `calcSublimationJob` (`calculators.ts`), por peça: peça base + papel/tinta (folha A4 ÷ peças por folha) + energia (potência × (tempo de prensa + aquecimento ÷ peças da leva) × tarifa) + mão de obra (min × hora) + embalagem + outros; sugerido com `priceForMarkup`. **Exemplo à mão** (caneca de porcelana na Sun Special, 350 W, 200 s; aquecimento 10 min para 10 canecas; tarifa 0,79; base R$ 12; folha R$ 2,40 com 2 canecas; 5 min a R$ 25/h; embalagem R$ 1,50; outros R$ 0,50; markup 150%): energia R$ 0,02; custo R$ 17,30; sugerido R$ 43,26 (Venda Direta) e R$ 66,57 (Shopee); preço manual R$ 40 → lucro R$ 22,70 |
| 2. Banco | Coleção `sublimationJobs` com a regra dos trabalhos do Laser (excluir só ADMIN/GERENTE), no Backup. Emulador: OPERADOR da loja 200; outra loja e OPERADOR apagando 403. Sem índice novo |
| 3. Custos da peça | Peça base do estoque (matéria-prima × quantidade por peça) ou avulsa; papel + tinta; aquecimento por leva (padrão 10 min) e peças na leva; mão de obra por peça; embalagem; outros; quantidade; hora, markup e tarifa da Base de Custos (editáveis) |
| 4. Preço de venda | Canal, preço manual, composição por peça, preço sugerido com a margem real no canal, quadro do preço manual e "Lucro em cada canal" |
| 5. Trabalhos salvos | "Salvar Trabalho" grava tudo o que foi digitado e, como foto do momento, o custo e o sugerido (nada é recalculado); histórico com máquina · parte e produto. Conferido no emulador |

Conferido também em 375 px (página sem rolagem lateral). Testes: 188 → 197.

**Publicação do 8D-2 (quando você pedir):** primeiro as **regras do banco** (coleção nova `sublimationJobs`), depois o
**site**.


Dados: `tabela-sublimacao.md` (raiz do projeto), montado a partir das fotos das etiquetas/manuais e da tabela
sugestiva da STC Smart Deko. Todas as máquinas em 220 V: mini prensa portátil 250 W; prensa plana 38 × 38 cm (15") 1.800 W;
prensa 4 em 1 (boné 300 W, logo 15 × 15 cm 600 W, caneta 200 W, caneca 11 oz 300 W); prensa de caneca Sun Special
SSH-012A-1 350 W (confirmado em 24/10/2026: só canecas, com a linha "Prensa de canecas e copos" da tabela).
Tabela com 40 combinações de equipamento × produto (temperatura, tempo e pressão).

- **Aba "Sublimação"** na guia Calculadoras (5ª aba, junto de Laser, 3D, Papelaria e Cestas).
- **Ao escolher máquina e produto**, a tabela preenche sozinha temperatura, tempo e pressão; os três continuam
  editáveis.
- **Custo** considera: peça base (do estoque), papel sublimático, tinta por impressão, energia (potência × tempo,
  incluindo o aquecimento da prensa), mão de obra, embalagem, markup e canal (mesma tabela de canais e o mesmo
  quadro de lucro por canal do 8B).
- **Aba "Tabela de referência"** com busca, para consultar a tabela sem calcular.
- **A decidir antes de começar:**
  - como ligar os demais equipamentos da tabela (prensa de canetas, de pratos, 3D) às máquinas cadastradas
    (ex.: acessórios da 4 em 1); a Sun Special já está ligada a "Prensa de canecas e copos";
  - tempo e potência do aquecimento;
  - consumo de tinta e de papel por impressão;
  - onde guardar as máquinas (cadastro, como no Laser e na 3D).
- A tabela é sugestiva (o fabricante avisa que varia conforme o material): mostrar o aviso e as dicas do arquivo na
  tela.

### Correção urgente — preço de compra por unidade ou total (25/10/2026)

**✅ Feita, tag `preco-compra-ok`, publicada em 25/10/2026 (só o site; versão "24/10 22:39").** O "Preço de Compra" da Matéria-prima sempre foi tratado como o
valor TOTAL do lote, mas o nome levava a digitar o preço de UMA unidade (R$ 9 para 10 canecas virava R$ 0,90 cada).

| Item | Resultado |
|---|---|
| 3. Auditoria (só leitura) | Backup de 24/10 22:25: 130 matérias-primas com quantidade > 1 (T&N 66, A Caverna 64), com preço, quantidade, custo por unidade, o custo "se fosse por unidade" e os produtos que usam cada uma. Relatório entregue a você; nada foi alterado. O custo gravado bate com preço ÷ quantidade em todas |
| 1. Matéria-prima | Seletor "Informar: preço por unidade / valor total pago" (começa sem escolha e não salva sem ela; na edição abre em "valor total pago" com o valor gravado) e prévia "= R$ X por unidade · total R$ Y". Grava os mesmos campos (preço total, quantidade, custo por unidade) |
| 2. Lista de Compras | Mesmo seletor e prévia no "Registrar Compra"; preço abre vazio e a sugestão (último preço pago) entra ao escolher o modo. Grava o mesmo de sempre |

Corrigir as matérias-primas cadastradas erradas é com você, pela tela (editar e escolher "por unidade"): isso muda o
custo e o preço sugerido dos produtos que usam cada uma (lista na auditoria). Testes: 197 → 205.

### Etapa 9 — Monitor de taxas

**Só começa depois da Etapa 8. Por enquanto é só planejamento:** o detalhamento será feito quando a etapa começar.
Depende da tabela de canais do T4 (Etapa 7), que guarda a data da última conferência.

- **Aviso no app** quando um canal estiver há **mais de 60 dias sem conferência**.
- **Comissão do Mercado Livre pela API oficial**, se for viável.
- **Verificação mensal assistida por IA:** pesquisa as páginas oficiais dos canais e **envia para você as mudanças
  encontradas, com as fontes**.
- **Nada é alterado no app sem a sua aprovação.**

### Etapa 10 — Ferramentas de venda

**Registrada em 25/10/2026. Só começa depois da Etapa 9. Por enquanto é só planejamento:** cada item terá a lista
de riscos e o "aprovado" antes de começar.

**Vieram do Estacionamento (26/10/2026):** 9B — comissão do Mercado Livre pela API oficial (a API respondeu 403 e
exige app cadastrado, login OAuth e servidor; reaproveita o item 6 abaixo) e lembrete de orçamento pendente por WhatsApp
(rotina no servidor que acha orçamentos pendentes há X dias e envia a mensagem, com tela para ligar/desligar).

Inspirada no STL Seller do STLFlix (R$ 99,90/mês), que tem 5 módulos: Finder, My Ads, Calculadora, Pedidos e
Estoque. A Calculadora já existe aqui, mais completa (3D com G-code, Laser, Papelaria, Cestas, Sublimação, tarifa de
energia e tabela de canais). O objetivo é ter o resto dentro do app, sem pagar ferramenta de fora.

Ordem:

1. **Chamada do Gemini no servidor** (Cloud Functions). É o item de segurança do Estacionamento: hoje a chave vai no
   código do navegador e qualquer um pode copiá-la. Exige o plano Blaze do Firebase (cobrança por uso). É o mesmo
   servidor que o Mercado Livre vai exigir no item 4.
2. **Buscador de tendências** (subiu do item 5 em 25/10/2026, a seu pedido: saber o que vende é a maior dor do
   negócio). Duas partes:
   - **Tendências do Mercado Livre:** buscas que mais cresceram e mais populares, por categoria (a página pública
     `tendencias.mercadolivre.com.br` já mostra isso; pela API oficial, exige login de aplicativo e tem limite de uso).
   - **Pesquisa mensal assistida por IA:** o que está em alta e o que vem nos próximos 3 meses (datas comemorativas,
     Shopee, Instagram, Pinterest, Google), com os links das fontes. Usa o mesmo mecanismo da verificação mensal da
     Etapa 9. Modelo: a página "Radar de Vendas do Ateliê" feita em 25/10/2026.
   - Cada tendência já sai com o preço calculado pela calculadora certa, para ver se a margem fecha no preço da
     concorrência.
3. **Caixa de Ideias** (registrada em 25/10/2026): guarda os produtos que pessoas próximas mandam pela DM do
   Instagram, com foto ou print, link, quem mandou e observação. Colunas: Chegou → Vale a pena? → Preço calculado →
   Testar → Virou produto ou Descartada.
   - **Android:** o app instalado aparece no "Compartilhar" do Instagram (Web Share Target no manifesto do PWA) e a
     ideia entra direto. No iPhone isso não existe: colar o link ou subir o print.
   - **IA lendo o print:** diz o que é o produto, qual calculadora usar e sugere materiais e preço. Depende do item 1.
   - Ler as DMs automaticamente fica de fora: exige conta comercial, aplicativo aprovado pela Meta e servidor.
   - Exige coleção nova no banco (com regra) e guardar imagens no Storage.
4. **Gerador de anúncio com IA:** a partir de um produto do Catálogo, gera título, descrição e texto para Instagram e
   WhatsApp. Aproveita o `rewriteDescription` que já existe. Imagens com IA só depois, porque cobram por imagem.
   Vídeo fica de fora (custo alto).
5. **Painel de estoque:** cards com o que está acabando (abaixo do mínimo) e o que já zerou. Só tela, sem mudar o
   banco.
6. **Mercado Livre:** a comissão automática é da Etapa 9 e é reaproveitada aqui. Depois vem puxar os pedidos para o
   app e, por último, publicar anúncios direto do Catálogo. Exige login do Mercado Livre (OAuth) feito pelo servidor.
   A Shopee fica para depois, porque exige aprovação como parceiro.

---

## 7. Estacionamento (não é enxugamento — para depois)

Classificado em 26/10/2026 (importantes / úteis / dispensáveis). Cada item: lista de riscos curta, o seu "aprovado"
e checkpoint completo; publicação só quando você pedir, juntando vários itens.

### 7.1 Escolhidos, nesta ordem (26/10/2026; reordenado depois da verificação de segurança)

1. **Chave do Gemini: contenção de emergência** (segurança, ALTA; você faz no Google Cloud, sem código): restringir a
   chave ao site `saas-1-0-0.web.app` e só à API do Gemini, e pôr limite diário. Só contenção: a solução é o item 3.
2. ✅ **Regras do Storage por loja** (segurança, ALTA, P) — **feito e publicado** (26/10/2026): gravar e apagar
   fotos só quem tem acesso à loja (admin ou aprovado daquela loja), só imagem, no máximo 5 MB; logos (`logos/`) só o
   admin; o resto fechado; leitura das fotos do catálogo continua pública. 16 casos testados no emulador.
   Publicação: só as regras do Storage (`firebase deploy --only storage`).
3. ✅ **Chave do Gemini fora do site — solução definitiva** (segurança, ALTA) — **feito e publicado**
   (26/10/2026). Escolhida a **opção A, Firebase AI Logic + App Check** (funciona no plano Spark, sem cartão; a B,
   Cloud Functions + Secret Manager, exige o Blaze). A IA passa por `firebase/ai` (Gemini Developer API, modelo
   `gemini-2.5-flash`), com App Check (reCAPTCHA Enterprise) ligado só na primeira chamada; no emulador a IA fica
   desligada. Saíram o `@google/genai`, a `VITE_GEMINI_API_KEY` do `.env`/`.env.example` e qualquer chave do Gemini do
   build (conferido no `dist/`). A 9C mostra as sugestões de pesquisa do Google (obrigatório com a busca). O código
   da IA ficou num pacote próprio (`vendor-firebase-ai`, 59 KB), e a abertura do app continua do mesmo tamanho.
   **Falta você, no console:** ligar o AI Logic, criar a chave do reCAPTCHA, registrar o App Check e me passar a
   chave do site do reCAPTCHA (é pública); depois de publicar, ligar o "Exigir" do App Check e apagar a chave antiga.
4. **Produtos do catálogo sem custo público** (segurança, MÉDIA, M–G): hoje quem lê o banco direto vê custo do
   trabalho, materiais, tempo e a análise da IA dos produtos do catálogo, e produto sem `showInCatalog` conta como
   público. Seus custos não podem ficar visíveis para cliente nem concorrente: coleção pública só com nome, foto,
   descrição e preço.
5. **Regras do Firestore: atualizar só documentos da própria loja** (segurança, MÉDIA, P): hoje a atualização confere
   só a loja nova do documento; exigir acesso à loja atual e loja sem mudar; junto, admin só com e-mail verificado.
6. **Revisar o `npm audit`** (importante, P–M): no site só entra o `dompurify` (via jsPDF; o app não usa a função
   afetada) — `npm audit fix` resolve sem mudança grande; o resto é só do computador de desenvolvimento.
7. **Lista de Compras com transação** (importante, P): o registro de compra atualiza o estoque sem transação
   (`PurchaseList.tsx`); duas pessoas ao mesmo tempo podem deixar o estoque errado.
8. **Mensagem de PDF só depois de o PDF ficar pronto** (importante, P): `Pricing.tsx`, botões do Orçamento Gerado.
9. **Cartão do produto criado de trabalho** (útil, P): "Custo da calculadora: [nome]" no lugar de "0 min · 0 materiais".
10. **Matéria-prima aceitar estoque 0 no cadastro** (útil, P): `Materials.tsx`.
11. **Impressão 3D pedir para escolher a impressora** (útil, P): `PrintCalculator.tsx`; conferir o mesmo no Laser.
12. **Ícone do app instalado** (útil, P): `pwa-192x192.png` e `pwa-512x512.png` não existem.
13. **Laser escolher material do estoque (MDF, acrílico)** (importante, M): para o produto do Laser baixar estoque.

### 7.2 Decidir depois de usar o app

- **Abrir um trabalho salvo de volta na calculadora** (útil, M): hoje não existe; os trabalhos antigos de Laser,
  Papelaria e Cestas sem custo gravado mostram "Abra e salve este trabalho para gravar o custo atual".
- **Seus próprios produtos na tabela de referência da sublimação** (útil, M): temperatura, tempo e pressão por loja,
  além das 40 linhas; exige gravar no banco (coleção ou campo novo, com regra).
- **Desconto de fornecedor aplicado de verdade no custo da matéria-prima** (útil, M): fornecedores antigos ainda
  guardam `discount` no banco. **Muda preço:** comparação antes/depois.
- **Markup extra opcional por canal** (útil, M; 8C item 8): somar um % próprio a cada canal. **Muda preço.**

### 7.3 Foram para a Etapa 10 (26/10/2026)

- **Lembrete de orçamento pendente por WhatsApp** (exige servidor). Ver Etapa 10.
- **9B — Comissão do Mercado Livre pela API oficial** (exige app no Mercado Livre, login OAuth e servidor). Ver Etapa 10.

### 7.5 Verificação de segurança (26/10/2026, só leitura)

- **Produtos do catálogo são públicos por inteiro** (MÉDIA): virou o item 4 da seção 7.1.
- **Baixas:** admin reconhecido pelo e-mail sem exigir e-mail verificado; qualquer conta logada (até pendente) lista
  as lojas (nome, telefone, endereço); qualquer operador apaga trabalhos de Papelaria/Cestas e itens da Lista de
  Compras.
- **Sem problema:** nenhum segredo no GitHub (`.env` fora do git, `.env.example` vazio); a chave do Firebase no
  site é pública por natureza (o acesso é controlado pelas regras). O AgentShield deu D (58/100), mas os 1.248
  "críticos" são falso alarme (códigos de conferência do `package-lock.json`) e o resto é configuração das
  ferramentas de IA, não do app.

### 7.4 Descartados (26/10/2026)

- Publicação automática pelo GitHub — você publica quando pede; automática tiraria esse controle.
- Testes automáticos dos cálculos "com scripts avulsos" — já cobertos pelos testes automáticos (267 em 26/10/2026).
- Margem padrão das calculadoras menor — desatualizado: as calculadoras usam markup, não margem.
- Janela de exclusão de Clientes com a largura certa — só visual, quase imperceptível.
- T9 — Estoque × Matéria-prima (+1/−1) — os dois caminhos já funcionam.
- T7 — Produtos só com categorias múltiplas — exigiria reclassificar produtos para um ganho pequeno.
- Unificações de tela que ficaram de fora na 4B — só organização de código, nada muda para quem usa.
- Aviso real ao aprovar usuário (e-mail ou WhatsApp) — com 2 usuários, avisar à mão resolve.
- Estatísticas do cliente no servidor — só faria diferença com muitos orçamentos.
