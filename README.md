# PrecificaAteliê

Sistema de precificação e gestão profissional para ateliês e artesãos.

## 🚀 Começando

### Pré-requisitos
- Node.js 18+
- Java 21 ou mais novo (o Firebase Emulator exige). No Windows: `winget install Microsoft.OpenJDK.21`
- Firebase CLI: `npm install -g firebase-tools`

### Rodar no computador (banco local, nunca o real)

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o app com o Firebase Emulator:
   ```bash
   npm run dev
   ```
   Na primeira vez ele baixa os arquivos do emulador (alguns minutos). Quando aparecer
   `[seed] Emulador pronto`, abra **http://localhost:5173**.
3. Entre com o usuário de teste (só existe no emulador):
   - **E-mail:** `admin@teste.local`
   - **Senha:** `Teste@123`
   - Cargo ADMIN, com a "Loja Teste" e a Base de Custos do `CHECKLIST-TESTES.md` já criadas.
4. Para parar, aperte **Ctrl+C** no terminal. O banco local fica salvo em `.emulator-data/` e volta na
   próxima vez. Para começar do zero: `npm run dev:limpo`.

Como funciona: no `npm run dev` o app usa o projeto de demonstração `demo-precificaatelie`, que o
Firebase não deixa sair do computador. Se o emulador estiver desligado, o app só mostra erro de conexão;
ele **nunca** grava no banco real. O painel do emulador (ver e apagar dados) fica em
**http://127.0.0.1:4000**.

### Testes automáticos

```bash
npm test
```
Roda os testes do motor de preços e das 4 calculadoras com os valores do `CHECKLIST-TESTES.md`.

### Build de produção (banco real)

O banco real só é usado no build de produção, com as variáveis do arquivo `.env`
(modelo em `.env.example`). Sem elas o build é cancelado.
```bash
npm run build
```

## 🧪 Procedimentos de Teste

### 1. Geração de Orçamentos
- Acesse a aba **Precificação**.
- Selecione um produto da lista.
- Informe o nome do cliente.
- Clique em **Gerar Orçamento**.
- Verifique se o modal de sucesso aparece e se os PDFs podem ser gerados.
- **Nota:** Teste com usuários de diferentes cargos (ADMIN, GERENTE, OPERADOR) para garantir que todos conseguem gerar orçamentos para suas respectivas lojas.

### 2. Gestão Multi-Loja
- Como **ADMIN**, crie pelo menos duas lojas na aba **Lojas**.
- Crie um usuário **GERENTE** e vincule-o a apenas uma das lojas.
- Faça login com o **GERENTE** e verifique se ele visualiza apenas os dados (produtos, materiais, orçamentos) da loja vinculada.
- Tente trocar de loja no seletor do cabeçalho.

### 3. Hierarquia de Permissões
- **GERENTE vs ADMIN:**
  - O GERENTE não deve visualizar usuários com cargo ADMIN na lista de usuários.
  - O GERENTE não deve conseguir promover ninguém a ADMIN.
  - O GERENTE não deve conseguir editar ou excluir um ADMIN.
- **OPERADOR:**
  - O OPERADOR não deve ter acesso às abas de **Usuários** e **Lojas**.
  - O OPERADOR deve conseguir gerar orçamentos apenas para as lojas às quais está vinculado.

## 📱 PWA (Progressive Web App)

O sistema está configurado como um PWA, permitindo a instalação como um aplicativo nativo.

### Como Instalar:
- **Desktop (Chrome/Edge):** Clique no ícone de instalação na barra de endereços.
- **Android (Chrome):** Clique nos três pontos e selecione "Instalar aplicativo".
- **iOS (Safari):** Clique no botão de compartilhar e selecione "Adicionar à Tela de Início".

## 📦 Publicação no GitHub Pages

Para publicar o projeto no GitHub Pages:

1. Certifique-se de que o `base` no `vite.config.ts` está correto (geralmente `./` ou o nome do repositório).
2. Execute o comando de build:
   ```bash
   npm run build
   ```
3. O conteúdo da pasta `dist` deve ser enviado para o branch `gh-pages`.
4. No GitHub, vá em **Settings > Pages** e selecione o branch `gh-pages`.

---
Desenvolvido para facilitar a vida do artesão.
