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

## Escalação

- Sorteio equilibrado: um goleiro por time e zagueiros, meias e atacantes divididos por igual. Se faltar goleiro, a faixa fica vazia e o app avisa.
- Botão **2 / 3 times**: o terceiro time é o Vermelho (goleiro de colete azul). Com 3 times o resultado é campeão (3 pts) e 2º lugar (1 pt); com 2 times segue placar ou vencedor (3/1/0).
- Convidado entra só na rodada, com posição escolhida na hora (conta no sorteio, não pontua).

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
