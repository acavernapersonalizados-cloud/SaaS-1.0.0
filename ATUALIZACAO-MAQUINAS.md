# Atualização do gerenciamento de máquinas

## O que foi corrigido
- Aprovar, colocar em produção e finalizar orçamentos não fazem mais uma consulta de estoque sem o filtro da loja, que causava a mensagem de acesso negado.
- Somente o criador do orçamento, um ADMIN ou um GERENTE pode finalizar o serviço; a restrição existe na tela e nas regras do banco.
- Orçamentos antigos sem autor identificado continuam podendo ser finalizados por ADMIN ou GERENTE.
- Impressoras 3D e máquinas a laser padrão agora podem ser editadas e excluídas por ADMIN ou GERENTE.
- Uma máquina excluída não é mais recriada ao abrir a tela.
- Quando a máquina selecionada é excluída, outra disponível é selecionada automaticamente.
- O histórico mantém o nome da máquina usada, mesmo após a exclusão.
- O botão de criar máquina fica restrito a ADMIN e GERENTE, como as regras do banco.

## Funções adicionadas à impressão 3D
- Botão visível **Importar arquivo G-code**, com leitura de `.gcode`, `.gco`, `.g` e `.3mf` para preencher peso e tempo.
- O trabalho salvo registra também o nome do G-code e o programa fatiador identificado.
- Custo de aquisição e vida útil da impressora.
- Pós-processamento, embalagem e outros custos.
- Canal de venda e taxas, limitadas a 95% para evitar cálculo inválido.
- Material opcional do estoque e baixa atômica, sem permitir saldo negativo.
- O trabalho salvo registra custo e preço sugerido para preservar o histórico.

## Publicação segura (PowerShell)
1. Faça uma cópia da pasta atual.
2. Extraia este ZIP em uma nova pasta.
3. Copie o mesmo arquivo `.env` usado na versão em produção para a nova pasta.
4. Execute `npm install`.
5. Execute `npm run build`.
6. Publique primeiro as regras incluídas: `firebase deploy --only firestore:rules`.
7. Publique o site: `firebase deploy --only hosting`.

Não há migração nem alteração automática nos dados existentes.
