# Condores

App de gestão do grupo de futebol Condores: atletas, confirmações, escalação, resultado, ranking e mensagens prontas para o WhatsApp.

**Endereço do app:** https://francoboaventura.github.io/condores/

## Como funciona

- Toda alteração enviada para a branch `main` é publicada automaticamente no GitHub Pages (aba *Actions* mostra o andamento; leva 1–2 minutos).
- Os dados ficam no Supabase (projeto `togethere-teste`), nas tabelas com prefixo `cond_`.
- Só entra quem está na tabela `cond_usuarios` (ligado a um atleta, com papel diretor ou atleta).

## Acessos

- **Diretoria**: tudo — cadastra atletas, abre e fecha as confirmações, escala e libera a escalação, lança resultado, corrige placar, convida, abre a lista do churrasco, vê ranking e resultado da votação. No menu ⋯ do atleta, "⭐ Tornar diretoria" / "👤 Tirar da diretoria" (ninguém tira a si mesmo).
- **Atleta**: confirma a própria presença só quando a diretoria abre as confirmações; vê a escalação da rodada só depois de liberada (rodadas antigas sempre); marca "vou / não vou" no churrasco enquanto a lista está aberta; vota na Atleta Mais Condores. Não vê ranking nem resultado da votação.
- As travas de confirmação, escalação e churrasco estão no banco, não só na tela (`dados/permissoes-e-churrasco.sql`).
- Quem vira diretoria antes do primeiro acesso também precisa criar a própria senha.
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
- Na mensagem do WhatsApp cada jogador vem com o emoji da cor do time no lugar do número: ⚫ Preto e ⚪ Bege, com os goleiros na cor do colete (🟢 e 🟠). No terceiro time é 🔴 com goleiro 🔵. Os times não levam título: o emoji ao lado do nome já diz de que lado cada um joga; os blocos ficam separados por uma linha em branco.
- Ao gerar uma mensagem, o caminho de volta ("‹ Rodada › Escalação › WhatsApp") fica no topo da tela de Mensagens.

## Acesso dos atletas

- Na tela de entrada o atleta escolhe o próprio nome e digita a senha. No primeiro acesso usa a **senha padrão** (a diretoria vê qual é na aba Votação), cria a própria senha e confirma WhatsApp e aniversário; a foto é opcional.
- Por trás, cada atleta ativo tem uma conta com e-mail interno (`atleta-<id>@atletas.condores.app`); atleta novo ou que volta ao time ganha a conta sozinho. A senha padrão fica em `cond_config` (`senha_padrao_atletas`), fora do código.
- Esqueceu a senha: no menu ⋯ do atleta, "🔑 Voltar senha para a padrão".
- A diretoria continua entrando com e-mail ("Entrar com e-mail (diretoria)"); convites por link seguem funcionando.
- Por enquanto o **ranking fica só para a diretoria** (aba e mensagem de ranking escondidas para atletas).
- SQL em `dados/acesso-atletas.sql`; fotos no Storage, bucket `cond-fotos`.

## Votação "Atleta Mais Condores"

- Depois do primeiro acesso, o app abre um pop-up para o atleta votar (o próprio nome não aparece). "Votar depois" fecha e o pop-up volta no próximo acesso até ele votar.
- Cada atleta vota uma vez, só como ele mesmo e nunca em si: o banco garante. Voto repetido (dois aparelhos ao mesmo tempo) é recusado com "Esse atleta já votou".
- Em quem cada um votou e a contagem só aparecem para a diretoria, na aba **Votação** (ranking, total de votos, quantos faltam e mensagem pronta para o WhatsApp).
- O link público antigo (`#/votacao`) agora só avisa que a votação é pelo app.
- Banco: tabela `cond_votos_atleta_mais_condores`, função `cond_votacao_resultado`. SQL em `dados/votacao-atleta-mais-condores.sql` e `dados/acesso-atletas.sql`.

## Churrasco

Na tela Rodada, a diretoria abre a lista de presença do churrasco (nome e data). Cada atleta marca "Vou" ou "Não vou" enquanto a lista estiver aberta; a diretoria fecha, reabre, copia a lista para o WhatsApp e, com a lista fechada, pode abrir um churrasco novo. Tabelas `cond_eventos` e `cond_evento_presencas`.

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
- `src/PrimeiroAcesso.jsx` (primeiro acesso do atleta), `src/VotoPopup.jsx` (pop-up da votação), `src/VotacaoResultado.jsx` (resultado, só diretoria), `src/Votacao.jsx` (aviso no link antigo)
- `src/lib/dados.js` — todas as leituras e gravações no Supabase
- `src/lib/mensagens.js` — os textos de WhatsApp
- `prototipo/condores-prototipo.html` — protótipo aprovado que definiu o visual
