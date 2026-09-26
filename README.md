# Condores

App de gestão do grupo de futebol Condores: atletas, confirmações, escalação, resultado, ranking e mensagens prontas para o WhatsApp.

**Endereço do app:** https://francoboaventura.github.io/condores/

## Como funciona

- Toda alteração enviada para a branch `main` é publicada automaticamente no GitHub Pages (aba *Actions* mostra o andamento; leva 1–2 minutos).
- Os dados ficam no Supabase (projeto `togethere-teste`), nas tabelas com prefixo `cond_`.
- Só entra quem está na tabela `cond_usuarios` (ligado a um atleta, com papel diretor ou atleta).

## Acessos

- **Diretoria**: cadastra atletas, escala, lança resultado, corrige placar, convida.
- **Atleta (usuário comum)**: vê tudo e confirma a própria presença.
- Convite: na tela Atletas, o ✉ ao lado do nome gera um link pessoal (usuário comum ou diretor). Quem abre cria e-mail + senha e a conta já nasce ligada à ficha.

## Atletas

Cada atleta tem número e tamanho de camisa; o número aparece no lugar das iniciais. Filtros por posição (GOL/ZAG/MEI/ATA) e por situação (disponíveis / DM / afastados), com botão ⇅ para alternar a ordem entre A–Z, número, posição e aniversário.

Em "Rodadas registradas" (passo Resultado), tocar na data expande a escalação daquele dia; a diretoria tem ali o botão para corrigir o placar.

## Temporadas (encerrar o ano)

O ranking é por ano: a tela Ranking tem os botões dos anos disponíveis. No ano em aberto a tabela é calculada ao vivo; a diretoria encerra com "🏁 Encerrar o ano", o que congela o ranking daquele ano, registra o campeão e faz o ano seguinte começar do zero (as rodadas novas já são do ano novo). Anos encerrados aparecem com 🏆 no seletor e trazem a faixa do campeão; "Reabrir" desfaz o encerramento. Assim que existe um ano encerrado, a tela inicial (Atletas) mostra o destaque do campeão, que leva ao ranking daquele ano.

Tabelas: `cond_temporadas` (ano, campeão, total de rodadas) e `cond_temporada_ranking` (o retrato final); view `cond_ranking_ano`; funções `cond_encerrar_ano` e `cond_reabrir_ano`.

## Quem saiu do time

No menu ⋯ do atleta, "Saiu do time" o deixa oculto nas listas e fora do ranking, mantendo o histórico das rodadas. O filtro "🚪 Saíram" mostra essas pessoas e permite trazê-las de volta; no topo do ranking, um botão mostra ou oculta quem saiu. DM e afastamento continuam aparecendo normalmente.

## Confirmações

As três caixas de contagem (Confirmados / Não vão / Sem resposta) abrem ao toque e listam os nomes, com a posição de cada um; em "Não vão" aparecem também os que estão no DM ou afastados, com a etiqueta.

## Escalação

- Sorteio equilibrado: um goleiro por time e zagueiros, meias e atacantes divididos por igual. Se faltar goleiro, a faixa fica vazia e o app avisa.
- Botão **2 / 3 times**: o terceiro time é o Vermelho (goleiro de colete azul). Com 3 times o resultado é campeão (3 pts) e 2º lugar (1 pt); com 2 times segue placar ou vencedor (3/1/0).
- Convidado entra só na rodada, com posição escolhida na hora (conta no sorteio, não pontua); o × ao lado do nome apaga.
- Os confirmados sem time aparecem agrupados: goleiros em cima e ZAG / MEI / ATA em três colunas.
- Dentro de cada time os nomes seguem a ordem do campo: goleiro, depois ZAG, MEI e ATA — na tela, na escalação de rodadas antigas e na mensagem do WhatsApp.
- Ao gerar uma mensagem, o caminho de volta ("‹ Rodada › Escalação › WhatsApp") fica no topo da tela de Mensagens.

## Histórico

As 26 rodadas preenchidas na planilha "Condores 2026" foram importadas (`dados/importar-planilha.sql`, gerado a partir de `dados/condores-2026.csv`). Rodadas sem resultado aparecem como "a lançar" na tela Rodada (toque na data).

## Desenvolvimento

```
npm install
npm run dev
```

Teste automático (usa um Supabase de mentira, sem internet): `npm run build && python3 test/e2e.py`.

## Estrutura

- `src/App.jsx` — login, cabeçalho, navegação
- `src/Atletas.jsx`, `src/Rodada.jsx`, `src/Ranking.jsx`, `src/Mensagens.jsx` — as quatro telas
- `src/lib/dados.js` — todas as leituras e gravações no Supabase
- `src/lib/mensagens.js` — os textos de WhatsApp
- `prototipo/condores-prototipo.html` — protótipo aprovado que definiu o visual
