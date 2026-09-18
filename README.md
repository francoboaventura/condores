# Condores

App de gestão do grupo de futebol Condores: atletas, confirmações, escalação, resultado, ranking e mensagens prontas para o WhatsApp.

**Endereço do app:** https://francoboaventura.github.io/condores/

## Como funciona

- Toda alteração enviada para a branch `main` é publicada automaticamente no GitHub Pages (aba *Actions* mostra o andamento; leva 1–2 minutos).
- Os dados ficam no Supabase (projeto `togethere-teste`), nas tabelas com prefixo `cond_`.
- Só entra quem está na tabela `cond_diretoria`. Quem recebe o link de convite cria a conta com e-mail, senha e o código do convite.

## Convidar alguém da diretoria

Envie o link `https://francoboaventura.github.io/condores/#/convite/CODIGO` (o código está na tabela `cond_config`, chave `codigo_convite`). A pessoa cria a conta e já entra liberada.

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
