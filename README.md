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
