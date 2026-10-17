# Checklist de Testes — PrecificaAteliê

Lista para conferir, tela por tela, se o app funciona e se os cálculos estão certos.
Marque `[x]` em cada item que passar. Quando um item falhar, anote o que apareceu na tela.

Os resultados esperados foram calculados com as mesmas fórmulas do código, então devem bater
exatamente (diferenças de 1 centavo são arredondamento).

---

## ⚠️ Antes de começar (importante)

- **O app usa o banco de dados real.** Rodando no seu computador, ele conecta direto no Firebase
  do projeto `saas-1-0-0` — não existe um banco separado de testes. Tudo que você cadastrar aqui
  aparece para os usuários de verdade.
- **Por isso:** crie uma loja chamada **"Loja Teste"** e faça todos os testes dentro dela. No final,
  apague os dados de teste e a loja.
- **Não teste a importação de backup** (seção 17) com dados reais: ela sobrescreve registros.
- Use nomes começando com **"TESTE"** em tudo que criar, para achar e apagar depois.

### Dados de referência usados nos testes

| Coisa | Valor |
|---|---|
| Custos fixos mensais | R$ 3.200,00 |
| Horas produtivas mensais | 160 |
| Meta de lucro | 50% |
| → Valor da hora | **R$ 20,00** |

---

## 1. Rodar o app

- [ ] No terminal, dentro da pasta do projeto: `npm install` termina sem erro.
- [ ] O arquivo `.env` existe na pasta (já existe hoje) com as chaves do Firebase preenchidas.
- [ ] `npm run dev` mostra um endereço como `http://localhost:5173`.
- [ ] Abrindo esse endereço no navegador aparece a tela de login.
- [ ] `npm run lint` termina sem erros (confere os tipos do código).
- [ ] `npm run build` termina sem erros e cria a pasta `dist`.

## 2. Login, cadastro e aprovação

| # | Passo | Resultado esperado |
|---|---|---|
| 2.1 | Entrar com o e-mail de administrador | Entra direto no Dashboard. Menu mostra também **Lojas**, **Usuários** e **Backup**. |
| 2.2 | Criar conta nova com um e-mail qualquer (aba de cadastro: Nome, Telefone, E-mail, Senha) | Conta criada com status **pendente**: a pessoa não entra no sistema até ser aprovada. |
| 2.3 | Como admin, ir em **Usuários** e aprovar essa conta | Mensagem "Usuário aprovado com sucesso!". A pessoa agora consegue entrar. |
| 2.4 | Bloquear essa conta | Mensagem "Usuário bloqueado com sucesso!". A pessoa não consegue mais usar o sistema. |
| 2.5 | Tentar bloquear ou excluir o seu próprio usuário | Erro: "Você não pode bloquear/excluir seu próprio usuário." |
| 2.6 | "Esqueci a senha" com um e-mail cadastrado | Chega um e-mail de redefinição de senha. |
| 2.7 | Senha errada | Mensagem de erro, não entra. |

## 3. Lojas (só ADMIN)

- [ ] Criar **"Loja Teste"** com Razão Social, Nome Fantasia, Telefone, E-mail, Endereço, Bairro, CEP, Cidade, Estado.
- [ ] Enviar um logo (imagem) e escolher Cor Primária e Cor Secundária → aparecem no cadastro da loja.
- [ ] A loja aparece no seletor de loja no topo da tela.
- [ ] Trocar de loja no seletor → as listas (produtos, materiais etc.) mudam para os dados daquela loja.

## 4. Permissões por cargo

Crie dois usuários de teste: um **GERENTE** e um **OPERADOR**, os dois vinculados só à "Loja Teste".

| # | Entrando como | Verificar | Esperado |
|---|---|---|---|
| 4.1 | OPERADOR | Menu lateral | **Não** aparecem Lojas, Usuários, Backup. |
| 4.2 | OPERADOR | Base de Custos | Só visualiza; aparece o aviso "Você não tem permissão para alterar a base de custos". |
| 4.3 | OPERADOR | Seletor de loja | Só mostra a "Loja Teste". |
| 4.4 | GERENTE | Menu lateral | Aparece Usuários; **não** aparecem Lojas e Backup. |
| 4.5 | GERENTE | Lista de usuários | Não aparece nenhum ADMIN. Na criação, o cargo "Administrador" não está disponível. |
| 4.6 | GERENTE | Finalizar orçamento criado por outra pessoa | Permitido. |
| 4.7 | OPERADOR | Finalizar orçamento criado por outra pessoa | Erro: "Somente o criador do orçamento, administrador ou gerente pode finalizar." |

## 5. Base de Custos

| Campo | Digitar |
|---|---|
| Custos Fixos Mensais | 3200 |
| Horas Produtivas Mensais | 160 |
| Meta de Lucro (%) | 50 |

- [ ] O quadro **Valor da Hora Trabalhada** mostra **R$ 20,00** enquanto você digita.
- [ ] Clicar **Salvar Configurações** → "Base de custos salva com sucesso!".
- [ ] Recarregar a página → os valores continuam lá.
- [ ] Horas = 0 → valor da hora mostra **R$ 0,00** (não dá erro).

> Observação: a "Meta de Lucro" funciona como **acréscimo sobre o custo** (custo × 1,50), e não como
> margem sobre o preço. Com 50% de meta, a margem real fica em 33,3% (veja o teste 8.1).

## 6. Fornecedores

- [ ] Criar "TESTE Fornecedor" com Nome da Empresa, Nome do Contato, E-mail, Telefone, Website, Endereço, Observações.
- [ ] Forma de Pagamento: as opções são Dinheiro, Pix, Crédito, Boleto.
- [ ] Condição: Crédito à vista, Crédito parcelado, Boleto 30, 60, 90, 30/60, 30/60/90.
- [ ] Campo Desconto aceita número.
- [ ] Buscar por nome, contato ou e-mail → filtra a lista.
- [ ] Editar e excluir → "Fornecedor excluído com sucesso!".

## 7. Matéria-prima

Cadastre estes três materiais (com o fornecedor de teste):

| Nome | Unidade | Preço de Compra | Pacote? | Quantidade | Estoque Atual | Estoque Mínimo | Custo unitário esperado |
|---|---|---|---|---|---|---|---|
| TESTE MDF 3mm | un | 60,00 | não | Quantidade Comprada = 4 | 10 | 2 | **R$ 15,00** |
| TESTE Argola | pct | 25,00 | sim (automático) | Itens no Pacote = 100 | 100 | 20 | **R$ 0,25** |
| TESTE Fita cetim | m | 12,00 | não | Quantidade Comprada = 10 | 2 | 5 | **R$ 1,20** |

- [ ] Escolher a unidade "Pacote (pct)" marca sozinho a opção de pacote e troca o campo para "Quantidade de Itens no Pacote".
- [ ] Os custos unitários aparecem como na última coluna.
- [ ] Categorias: atribuir duas categorias a um material e filtrar pela barra de categorias.
- [ ] Deixar o Nome ou o Preço vazio e salvar → o navegador pede para preencher o campo.
- [ ] Preço de Compra **0** → aviso "Preencha o nome e um preço de compra maior que zero."
- [ ] Pacote com **0** itens → aviso "Informe a quantidade de itens no pacote (maior que zero)."

## 8. Produtos

Crie **"TESTE Chaveiro"**:

| Campo | Valor |
|---|---|
| Nome do Produto | TESTE Chaveiro |
| Tempo de Produção (min) | 15 |
| Custo de Embalagem (R$) | 0,75 |
| Materiais | TESTE MDF 3mm, quantidade **0,1** · TESTE Argola, quantidade **1** |

| # | Teste | Resultado esperado |
|---|---|---|
| 8.1 | Sem preço manual | Materiais **R$ 1,75** · Mão de obra **R$ 5,00** · Embalagem **R$ 0,75** · Custo total **R$ 7,50** · Preço sugerido **R$ 11,25** · Margem **33,3%** · Status **🟠 Margem Baixa** |
| 8.2 | Preço de Venda Manual = 15 | Lucro **R$ 7,50** · Margem **50%** · Status **🟡 Bom** |
| 8.3 | Preço Manual = 7 | Lucro **−R$ 0,50** · Margem **−7,1%** · Status **⛔ Prejuízo** · Recomendação cita **R$ 7.50** como preço mínimo |
| 8.4 | Precificação reversa: preço-alvo 20 | Lucro **R$ 12,50** · Margem **62,5%** · Markup **2,67x** · **🟢 Excelente** |
| 8.5 | Marcar "pacote" e Quantidade de itens no pacote = 10 | No orçamento, o preço por item = preço do pacote ÷ 10 |
| 8.6 | Acabamento "Verniz" valor 2 · Acessório "Caixinha" valor 3 | Ficam salvos no produto e aparecem para escolher no orçamento |
| 8.7 | Imagem principal antes de salvar o produto | Erro "Salve o produto primeiro para adicionar imagens." |
| 8.8 | Galeria: tentar adicionar a 7ª imagem | Erro "Máximo de 6 imagens na galeria." |
| 8.9 | "Analisar com IA" o preço manual | Aparece um texto de análise (só funciona se a chave do Gemini estiver no `.env`). |

Faixas do status (margem sobre o preço): 🟢 Excelente ≥ 55% · 🟡 Bom ≥ 35% · 🟠 Margem Baixa ≥ 15% · 🔴 Arriscado ≥ 0% · ⛔ Prejuízo < 0%.

**Antes de seguir, apague o preço manual do TESTE Chaveiro** (os próximos testes usam o preço sugerido).

## 9. Categorias

- [ ] Criar a categoria "TESTE Presentes" para produtos → "Categoria criada!".
- [ ] Criar outra com o mesmo nome → "Já existe uma categoria com esse nome."
- [ ] Renomear → "Categoria renomeada!". Excluir → "Categoria excluída.".

## 10. Precificação (orçamento)

Use o TESTE Chaveiro, **quantidade 10**, sem margem personalizada (vale a meta de 50%).

| # | Canal / ajuste | Preço unitário | Total | Lucro | Margem |
|---|---|---|---|---|---|
| 10.1 | Instagram (0%) | **R$ 11,25** | **R$ 112,50** | **R$ 37,50** | **33,3%** |
| 10.2 | Shopee (20%) | **R$ 14,06** | **R$ 140,63** | **R$ 37,50** | **26,7%** |
| 10.3 | Mercado Livre (18%) | **R$ 13,72** | **R$ 137,20** | **R$ 37,50** | **27,3%** |
| 10.4 | Venda Direta + Margem Personalizada 100% | **R$ 15,00** | **R$ 150,00** | **R$ 75,00** | **50%** |
| 10.5 | Shopee + acabamento Verniz (+R$ 2) | **R$ 16,06** | **R$ 160,63** | **R$ 53,50** | — |

Taxas fixas de canal: Shopee 20% · Mercado Livre 18% · Atacado 5% · Instagram e Venda Direta 0%.

- [ ] O lucro fica igual (R$ 37,50) em 10.1–10.3: o app embute a taxa do canal no preço.
- [ ] Gerar orçamento **sem nome de cliente** → erro "O nome do cliente é obrigatório."
- [ ] Gerar **sem itens** → erro "Adicione pelo menos um item ao orçamento."
- [ ] Gerar com cliente "TESTE Cliente", tipo PJ e CNPJ → modal de sucesso, status **Pendente**.
- [ ] Buscar um cliente já cadastrado no campo "Buscar ou Nome do Cliente" → preenche nome, tipo e documento.
- [ ] Botões **PDF Cliente** e **PDF Interno** baixam os PDFs. O PDF interno mostra custos; o do cliente, não.
- [ ] **Validade:** a tela diz "Válido por **5** dias" e a data no modal e no PDF é **hoje + 5 dias**.

## 11. Histórico e reserva de estoque

Antes: anote o estoque atual de TESTE MDF (10) e TESTE Argola (100). Use o orçamento da 10.1 (10 chaveiros).

| # | Ação | Resultado esperado |
|---|---|---|
| 11.1 | Buscar pelo nome do cliente ou do produto | A lista filtra. |
| 11.2 | Mudar para **Aprovado** | "Status atualizado com sucesso!". Cria uma reserva de **1 MDF** (0,1 × 10) e **10 argolas**. O estoque **ainda não muda**. |
| 11.3 | Abrir **Produção** | O orçamento aparece em Aprovados e a reserva aparece como ativa. |
| 11.4 | Mudar para **Em produção** | Continua uma reserva só (não duplica). |
| 11.5 | Mudar para **Finalizado** | Estoque baixa: MDF **10 → 9**, Argola **100 → 90**. |
| 11.6 | Orçamento novo (10 chaveiros): mudar direto de **Pendente → Finalizado** | O estoque baixa do mesmo jeito: MDF **−1**, Argola **−10** |
| 11.6b | Clicar **Finalizado** de novo no mesmo orçamento | O estoque **não** baixa uma segunda vez |
| 11.7 | Orçamento novo: **Aprovado**, depois voltar para **Pendente** | A reserva some do painel de Produção (fica "liberada"); o estoque não muda |
| 11.8 | Cliente com WhatsApp: botão de mensagem | Abre o WhatsApp com a mensagem do orçamento. Sem telefone: erro "Este cliente não possui telefone cadastrado." |
| 11.9 | Botão Nota Fiscal / PDF Cliente / PDF Interno | Baixa o PDF correspondente. |
| 11.10 | Excluir orçamento | "Orçamento excluído com sucesso!" |

## 12. Corte a Laser

Cadastre a máquina "TESTE Laser":

| Campo | Valor |
|---|---|
| Consumo Elétrico Total (W) | 60 |
| Vida Útil do Módulo (horas) | 10000 |
| Custo de Reposição do Módulo (R$) | 400 |
| Materiais que a máquina trabalha | MDF 3mm, Acrílico 3mm |
| (outros) | deixe o padrão |

Trabalho: Material **MDF 3mm** · Tempo de Corte por peça **10** min · Tempo de Gravação **5** min · Passadas **2** · Custo do Material **20** (total) ·
Quantidade **4** · nas Configurações Avançadas: Tarifa **0,78938** (padrão), Valor Hora **25** (padrão), Margem **60%** (padrão).

| # | Teste | Resultado esperado |
|---|---|---|
| 12.0 | Editar a máquina | O campo de materiais mostra "MDF 3mm, Acrílico 3mm"; o select Material do trabalho lista os dois |
| 12.1 | Tempo total | **30 min por peça** (2 passadas) |
| 12.2 | Custos por peça | Energia **R$ 0,02** · Desgaste **R$ 0,02** · Mão de obra **R$ 12,50** · Material **R$ 5,00** |
| 12.3 | Custo e preço por peça | Custo **R$ 17,54** · Sugerido (60%) **R$ 28,07** |
| 12.4 | Lote (4 peças) | Custo do lote **R$ 70,17** (4 × peça) · Sugerido do lote **R$ 112,28** |
| 12.5 | "Seu preço por peça" = 15 | Prejuízo **R$ 2,54**/peça · Margem **−17,0%** · Aviso de prejuízo |
| 12.6 | Salvar o trabalho | "Trabalho salvo!" e ele aparece no histórico |
| 12.7 | Máquina antiga sem lista de materiais | O campo Material vira texto livre; digitar "MDF" permite salvar |

> Os tempos são **por peça**: energia, desgaste e mão de obra se repetem em cada peça do lote.
> Largura e altura da peça não aparecem na tela (ficam sempre 100 × 100 mm).

## 13. Impressão 3D

Cadastre a impressora "TESTE 3D":

| Campo | Valor |
|---|---|
| Consumo Elétrico (W) | 200 |
| Custo Reposição Hotend / Vida Útil Hotend | 80 / 500 |
| Custo Reposição Mesa / Vida Útil Mesa | 60 / 2000 |
| Custo de Aquisição / Vida Útil da Impressora | 2000 / 5000 |
| Manutenção Geral (R$/h) | 0,1 |

Trabalho: Filamento **PLA** · Custo do Filamento **80** R$/kg · Filamento Usado **50** g · Tempo **2** h ·
Taxa de Falha **5%** · Quantidade **1** · Avançadas: Tarifa **0,85**, Valor Hora Operador **12**, Margem **60**,
Pós-processamento **0,5** h, Embalagem **2**, Outros custos **0** · Canal **Venda direta**.

| # | Teste | Resultado esperado |
|---|---|---|
| 13.1 | Detalhamento | Energia **R$ 0,36** · Filamento **R$ 4,20** · Hotend **R$ 0,34** · Mesa **R$ 0,06** · Depreciação **R$ 0,84** · Manutenção **R$ 0,21** · Mão de obra **R$ 6,30** · Embalagem **R$ 2,00** · Taxas **R$ 0,00** |
| 13.2 | Totais | Custo **R$ 14,31** · Sugerido **R$ 22,89** · Lucro **R$ 8,58** · Margem **37,5%** |
| 13.3 | Canal **Shopee** (14% + R$ 4 fixo) | Sugerido **R$ 31,27** · Taxas **R$ 8,38** · Lucro **R$ 8,58** · Margem **27,5%** |
| 13.4 | Quantidade 3 (venda direta) | Custo do lote **R$ 42,92** · Sugerido do lote **R$ 68,67** |
| 13.5 | Preço manual 20 (venda direta) | Lucro **R$ 5,69** · Margem **28,5%** |
| 13.6 | Comissão + pagamento = 120 | O campo trava em **95** |
| 13.7 | Salvar sem nome | Erro "Preencha nome e tempo de impressão." |

**Importar G-code:** crie no Bloco de Notas um arquivo `teste.gcode` com este conteúdo:

```
;TIME:7200
; filament used [g] = 50.5
; generated by PrusaSlicer 2.7
```

- [ ] Importar → "Arquivo lido com sucesso.", Tempo **2** h, Filamento **50,5** g, fatiador **PrusaSlicer 2.7**.
- [ ] Arquivo sem essas linhas → erro "Não encontrei tempo nem peso neste arquivo."
- [ ] Com `; filament used [g] = 12,5` (vírgula decimal) → **12,5 g**.
- [ ] Com `; filament used [g] = 12.5, 3.2` (duas extrusoras) → **15,7 g**.

**Baixa de estoque:** crie a matéria-prima "TESTE PLA" com unidade **kg** e estoque **1**.

- [ ] Escolher em "Material do estoque", marcar "Baixar o material do estoque ao salvar" e salvar (50 g, qtd 1) → estoque vai de **1 → 0,95**.
- [ ] Com estoque **0,01** → erro "Estoque insuficiente para registrar esta impressão." e o trabalho **não** é salvo.
- [ ] Com material em unidade **g** → baixa **50**.
- [ ] Com material em **un** (ou outra unidade) → aviso "Não foi possível baixar o estoque: o material está em "un". Use kg ou g para filamento." e o trabalho **não** é salvo.

## 14. Papelaria

Trabalho "TESTE Convite", **Quantidade final (kits/conjuntos) = 5**.
Materiais (todos os valores são **do lote inteiro**, não de 1 kit):

| Material avulso | Custo unitário | Quantidade |
|---|---|---|
| Papel 180g | 1,20 | 10 |
| Adesivo vinil | 2,50 | 2 |

Laminação **8** · Encadernação **5** · Tempos: Montagem **30**, Acabamento **15**, Embalagem **15** min ·
Valor Hora **25** · Margem **60%**.

| # | Teste | Resultado esperado |
|---|---|---|
| 14.1 | Custo do lote | Materiais R$ 17 + Laminação R$ 8 + Encadernação R$ 5 + Mão de obra R$ 25 = **R$ 55,00** |
| 14.2 | Por kit | Custo **R$ 11,00** · Sugerido **R$ 17,60** · Lote sugerido **R$ 88,00** · Margem **37,5%** |
| 14.3 | "Seu preço por unidade" = 15 | Lucro **R$ 4,00** · Margem **26,7%** |
| 14.4 | Adicionar "Do estoque": TESTE Fita cetim, quantidade 3 | Entra com custo R$ 1,20 × 3 = R$ 3,60 |
| 14.5 | Do estoque com quantidade maior que o saldo (ex.: 50) | Aviso em laranja "quantidade acima do estoque atual" (não bloqueia) |
| 14.6 | Salvar sem nome | Erro "Preencha nome, materiais e/ou tempos de producao." |

> O campo "Quantidade de folhas/peças impressas" só é guardado; ele **não muda** o cálculo.
> Salvar aqui **não baixa** o estoque.

## 15. Cestas

Cesta "TESTE Café da manhã", **Quantidade de Cestas = 1**:

| Item avulso | Custo | Qtd |
|---|---|---|
| Caneca | 15,00 | 1 |
| Chocolate | 4,00 | 3 |
| Café | 10,00 | 1 |

Embalagem **8** · Fitas e Laços **3** · Etiqueta/Tag **1** · Montagem **30** min · Valor Hora **25** ·
Frete **10** · Comissão Vendedor **10%** · Margem **60%**.

| # | Teste | Resultado esperado |
|---|---|---|
| 15.1 | Detalhamento | Produtos **R$ 37,00** · Embalagem **R$ 12,00** · Mão de obra **R$ 12,50** · Frete **R$ 10,00** · Custo total **R$ 71,50** |
| 15.2 | Preço | Sugerido **R$ 127,11** · Comissão **R$ 12,71** · Lucro **R$ 42,90** · Margem **33,75%** |
| 15.3 | Comissão 0% | Sugerido **R$ 114,40** |
| 15.4 | Mesmos dados, Quantidade de Cestas = **2** | Custo por cesta cai para **R$ 35,75**: os itens contam como **total do lote**. Para 2 cestas iguais, dobre as quantidades. |
| 15.5 | Salvar sem itens | Erro "Preencha nome e adicione ao menos um produto na cesta." |

## 16. Estoque e Lista de Compras

| # | Teste | Resultado esperado |
|---|---|---|
| 16.1 | **Estoque**: botão + no TESTE MDF | Estoque +1 e "Estoque atualizado com sucesso!" |
| 16.2 | Botão − até chegar a 0 e clicar − de novo | Erro "Estoque não pode ficar negativo." |
| 16.3 | Contador de estoque baixo | Conta itens com estoque ≤ mínimo (TESTE Fita cetim: 2 ≤ 5) |
| 16.4 | **Lista de Compras** | TESTE Fita cetim aparece com quantidade sugerida **8** (mínimo × 2 − atual = 10 − 2) |
| 16.5 | Material com estoque mínimo **0** e estoque 0 | **Não** aparece como baixo em nenhuma tela (Estoque, Matéria-prima, Dashboard, Lista de Compras) |
| 16.6 | Incluir manualmente um item que já está pendente | Erro "Esse item já está na lista de pendentes." |
| 16.7 | Registrar Compra da Fita: quantidade 8, valor total 40 | "Compra registrada e estoque atualizado!" · estoque **2 → 10** · custo unitário vira **R$ 5,00** |
| 16.8 | Copiar lista | "Lista copiada!" e o texto fica na área de transferência |
| 16.9 | Registrar compra de um material **em pacote** (TESTE Argola) | O campo diz "Pacotes comprados (1 pacote = 100 itens)". Com 1 pacote por R$ 25 → estoque **+100**, custo por item **R$ 0,25** |

## 17. Dashboard, Catálogo, Clientes e Backup

**Dashboard** (com só o orçamento da 10.1 aprovado):
- [ ] Faturamento Aprovado **R$ 112,50** · Lucro Total **R$ 37,50**.
- [ ] Pendente de Aprovação = soma dos orçamentos Pendentes.
- [ ] Barras de status dos produtos (Excelente, Bom, Margem Baixa, Arriscado, Prejuízo, Sem Preço) batem com a tela Produtos.

**Clientes:**
- [ ] Criar "TESTE Cliente" (Nome/Razão Social, Tipo PF ou PJ, Documento, WhatsApp `5511999999999`, E-mail, Cidade, Estado, Observações).
- [ ] Buscar por nome, telefone ou documento.
- [ ] Depois de um orçamento, o cliente mostra o histórico dele.

**Catálogo e Catálogo Público:**
- [ ] Copiar o link → "Link do catálogo copiado!" (formato `http://localhost:5173/catalogo/<id-da-loja>`).
- [ ] Abrir o link em janela anônima (sem login) → aparecem só produtos com "Mostrar no catálogo" marcado.
- [ ] Produto com "Mostrar preço" desmarcado → aparece sem preço.
- [ ] O preço mostrado é o preço efetivo (manual, se houver; senão o sugerido): TESTE Chaveiro = **R$ 11,25**.
- [ ] Botão de WhatsApp abre conversa com o telefone da loja.

**Backup** (só ADMIN):
- [ ] Exportar → mensagem "Backup exportado com sucesso: N documentos de N loja(s)." com a contagem de cada coleção, e baixa um arquivo JSON.
- [ ] As contagens da mensagem batem com as telas (ex.: número de produtos, matérias-primas, clientes e orçamentos de cada loja).
- [ ] O arquivo tem um bloco `_meta` no início, com data, versão e contagem por coleção.
- [ ] O arquivo tem todas as coleções: lojas, usuários, base de custos, matéria-prima, produtos, orçamentos, clientes,
  fornecedores, categorias, máquinas e trabalhos de laser, impressoras e trabalhos 3D, papelaria, cestas, lista de compras,
  movimentos e reservas de estoque.
- [ ] Se alguma leitura falhar → mensagem "Backup NÃO foi baixado: … leitura(s) falharam" e um botão
  "Baixar mesmo assim (marcado como incompleto)". Baixando, o `_meta` lista as coleções que falharam.
- [ ] **Não teste a importação** com o banco real: ela sobrescreve registros. Se for testar num banco de testes, um arquivo
  antigo sem `_meta` (como `backup_precifica_ja_2026-10-17.json`) deve gerar o aviso de "backup antigo" antes de gravar.

## 18. Limpeza no final

- [ ] Apagar orçamentos, produtos, materiais, clientes, fornecedores, categorias, máquinas e trabalhos com "TESTE".
- [ ] Apagar os usuários GERENTE e OPERADOR de teste.
- [ ] Apagar a "Loja Teste".

---

## Situação dos problemas encontrados na análise

Corrigidos na branch `validacao` (confira com os testes indicados):

1. ✅ **Laser:** máquinas agora têm o campo "Materiais que a máquina trabalha" (12.0, 12.6, 12.7).
2. ✅ **Laser:** os tempos são por peça e o lote = peça × quantidade (12.4).
3. ✅ **Orçamento:** tela e data gravada usam a mesma validade de 5 dias (10).
4. ✅ **Orçamento:** Pendente → Finalizado baixa o estoque; voltar para Pendente libera a reserva (11.6, 11.7).
5. ✅ **3D:** G-code com vírgula decimal é lido certo (13).
6. ✅ **3D:** a baixa de filamento só aceita material em kg ou g e avisa nos outros casos (13).
7. ✅ **Lista de Compras:** compra de material em pacote é registrada por pacotes e convertida em itens (16.9).
8. ✅ **Estoque baixo:** a mesma regra em todas as telas (16.5).
9. ✅ **Backup:** exporta loja por loja, inclui todas as coleções, grava `_meta` e não mostra "sucesso" quando alguma leitura falha (17). Ainda não testado com o Firebase real.
10. ✅ **Matéria-prima:** valores 0 agora mostram aviso (7).

Ainda aberto:

11. ❗ **Base de Custos:** a "Meta de Lucro" é acréscimo sobre o custo, não margem sobre o preço (5). Se a meta for 0, Produtos usa 30% no lugar.
