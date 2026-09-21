"""Teste de ponta a ponta do app com um Supabase simulado (test/mock_supabase.py).
Roda: npm run build && python3 test/e2e.py"""
import asyncio, sys, subprocess, time
sys.path.insert(0, 'test')
from mock_supabase import handle
from playwright.async_api import async_playwright

URL = 'http://localhost:4173/condores/'

async def drag(pg, sel, target):
    src = pg.locator(sel).first; sb = await src.bounding_box(); tb = await pg.locator(target).bounding_box()
    await pg.mouse.move(sb['x'] + 10, sb['y'] + 10); await pg.mouse.down()
    await pg.mouse.move(sb['x'] + 30, sb['y'] + 30, steps=3)
    await pg.mouse.move(tb['x'] + tb['width'] / 2, tb['y'] + tb['height'] / 2, steps=8); await pg.mouse.up()
    await pg.wait_for_timeout(250)

async def login(pg, email, senha):
    await pg.wait_for_selector('#login')
    await pg.fill('input[type=email]', email); await pg.fill('input[type=password]', senha); await pg.click('button.btn')
    await pg.wait_for_selector('nav'); await pg.wait_for_timeout(400)

async def aba(pg, i):
    await pg.locator('nav button').nth(i).click(); await pg.wait_for_timeout(400)

async def main():
    srv = subprocess.Popen(['npx', 'vite', 'preview', '--port', '4173', '--strictPort'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 430, 'height': 860})
            pg = await ctx.new_page()
            erros = []
            pg.on('pageerror', lambda e: erros.append(str(e)))
            pg.on('console', lambda m: erros.append(m.text) if m.type == 'error' and '400' not in m.text else None)
            await ctx.route('https://ynwumghaptydfoaskbui.supabase.co/**', handle)
            await pg.goto(URL)
            await pg.wait_for_selector('#login'); await pg.screenshot(path='test/t0-login.png')

            # senha errada
            await pg.fill('input[type=email]', 'francoboaventura@icloud.com'); await pg.fill('input[type=password]', 'x'); await pg.click('button.btn')
            await pg.wait_for_selector('.toast'); assert 'incorretos' in await pg.locator('.toast').inner_text()
            await pg.fill('input[type=password]', '123456'); await pg.click('button.btn')
            await pg.wait_for_selector('nav'); await pg.wait_for_selector('.item'); await pg.screenshot(path='test/t1-atletas.png')
            assert 'Franco' in await pg.locator('header .usr').inner_text()

            # ---- atletas (diretor) ----
            bb = await pg.locator('.posbtn').first.bounding_box()
            await pg.mouse.move(bb['x'] + 5, bb['y'] + 5); await pg.mouse.down(); await pg.wait_for_timeout(600); await pg.mouse.up()
            await pg.wait_for_selector('.pop'); await pg.click('.pop button:has-text("ZAG")'); await pg.wait_for_timeout(300)
            assert (await pg.locator('.posbtn').first.inner_text()) == 'ZAG'
            await pg.locator('.item').nth(2).locator('.more:not([title])').click(); await pg.click('text=Enviar para o DM'); await pg.wait_for_timeout(300)
            assert 'no DM' in await pg.locator('.tag').first.inner_text()
            await pg.locator('.item').nth(5).locator('.more:not([title])').click(); await pg.click('text=Afastamento justificado'); await pg.wait_for_timeout(300)
            assert 'afastado' in await pg.locator('.tag').first.inner_text()
            # número e tamanho da camisa
            assert await pg.locator('.item:has-text("Wilson") .av.camisa').inner_text() == '17'
            assert '👕 G' in await pg.locator('.item:has-text("Wilson") .sub').inner_text()
            await pg.click('.fab')
            await pg.fill('.modal input.txt >> nth=0', 'Zé Teste')
            await pg.fill('.modal input[type=number]', '77')
            await pg.select_option('.modal select', 'GG')
            await pg.fill('.modal input.txt >> nth=2', '05/06')
            await pg.click('.modal button:has-text("Salvar")')
            await pg.wait_for_timeout(300); assert await pg.locator('.item:has-text("Zé Teste")').count() == 1
            assert await pg.locator('.item:has-text("Zé Teste") .av').inner_text() == '77'
            assert '👕 GG' in await pg.locator('.item:has-text("Zé Teste") .sub').inner_text()

            # ---- filtros e ordenação ----
            total = await pg.locator('.card .item').count()
            await pg.click('.filtros button:has-text("GOL")'); await pg.wait_for_timeout(300)
            gols = await pg.locator('.card .item').count()
            assert 0 < gols < total, (gols, total)
            assert all(p == 'GOL' for p in await pg.locator('.card .item .posbtn').all_inner_texts())
            await pg.click('.filtros button:has-text("GOL")'); await pg.wait_for_timeout(200)
            await pg.click('.filtros button:has-text("Disponíveis")'); await pg.wait_for_timeout(300)
            assert await pg.locator('.card .item.dm').count() == 0
            await pg.click('.filtros button:has-text("DM")'); await pg.wait_for_timeout(300)
            assert await pg.locator('.card .item').count() == 1 and await pg.locator('.card .item.dm').count() == 1
            await pg.screenshot(path='test/t13-filtros.png')
            await pg.click('.filtros button.limpa'); await pg.wait_for_timeout(300)
            assert await pg.locator('.card .item').count() == total
            primeiro = await pg.locator('.card .item .nome').first.inner_text()
            await pg.click('.filtros button.ord'); await pg.wait_for_timeout(300)   # por número
            assert (await pg.locator('.card .item .av').first.inner_text()) == '1'
            await pg.click('.filtros button.ord'); await pg.wait_for_timeout(300)   # por posição
            assert (await pg.locator('.card .item .posbtn').first.inner_text()) == 'GOL'
            await pg.click('.filtros button.ord'); await pg.wait_for_timeout(300)   # por aniversário
            await pg.click('.filtros button.ord'); await pg.wait_for_timeout(300)   # volta para A–Z
            assert (await pg.locator('.card .item .nome').first.inner_text()) == primeiro

            # ---- rodada próxima: confirmações e escalação ----
            await aba(pg, 1); await pg.wait_for_selector('.stat')
            assert 'antiga' in await pg.locator('#root .dica').first.inner_text()
            itens = pg.locator('#root .item')
            for i in range(14): await itens.nth(i).click(); await pg.wait_for_timeout(120)
            await pg.locator('#root .item:has-text("Pico")').click(); await pg.wait_for_timeout(200)  # 2º goleiro
            await pg.wait_for_timeout(300); await pg.screenshot(path='test/t2-conf.png')
            sim = await pg.locator('.stat b').first.inner_text(); assert int(sim) >= 11, sim
            naovao = await pg.locator('.stat b').nth(1).inner_text(); assert naovao == '2', naovao  # 1 no DM + 1 afastado
            assert 'DM/afast' in await pg.locator('.stat .card').nth(1).inner_text()
            assert 'AFASTADO' in (await pg.locator('#root .item').nth(5).inner_text()).upper()
            # caixas de contagem abrem a lista de nomes
            await pg.locator('.stat .card').nth(1).click(); await pg.wait_for_selector('.detalhe')
            det = await pg.locator('.detalhe').inner_text()
            assert 'DM' in det and 'afastado' in det, det
            assert await pg.locator('.detalhe li').count() == 2
            await pg.locator('.stat .card').nth(0).click(); await pg.wait_for_timeout(200)
            assert await pg.locator('.detalhe li').count() == int(sim)
            assert 'CONFIRMADOS' in (await pg.locator('.detalhe h5').inner_text()).upper()
            await pg.screenshot(path='test/t15-detalhe.png')
            await pg.locator('.stat .card').nth(2).click(); await pg.wait_for_timeout(200)
            assert await pg.locator('.detalhe li').count() == int(await pg.locator('.stat b').nth(2).inner_text())
            await pg.click('.detalhe .fechar'); await pg.wait_for_timeout(200)
            assert await pg.locator('.detalhe').count() == 0
            await pg.locator('#root .seg button').nth(1).click(); await pg.wait_for_selector('.times')
            await pg.click('text=Sortear times'); await pg.wait_for_timeout(600)
            assert await pg.locator('.time.preto .gk .j').count() == 1 and await pg.locator('.time.bege .gk .j').count() == 1
            async def posicoes(sel):
                txt = await pg.locator(sel).all_inner_texts()
                return [t.split()[-2] if t.split()[-1] == '⇄' else t.split()[-1] for t in txt]
            pP, pB = await posicoes('.time.preto .linha .j'), await posicoes('.time.bege .linha .j')
            for pos in ('ZAG', 'MEI', 'ATA'):
                assert abs(pP.count(pos) - pB.count(pos)) <= 1, (pos, pP, pB)
            await pg.fill('input[placeholder="Nome do convidado"]', 'Beto')
            await pg.select_option('.conv-add select', 'ATA'); await pg.click('.conv-add button')
            assert await pg.locator('.banco-col[data-pos="ATA"] .chip:has-text("Beto")').count() == 1
            assert await pg.locator('.banco-gol').count() == 1 and await pg.locator('.banco-col').count() == 3
            # apagar convidado direto do banco
            await pg.fill('input[placeholder="Nome do convidado"]', 'Descartado'); await pg.click('.conv-add button')
            await pg.locator('.banco-col[data-pos="MEI"] .chip:has-text("Descartado") .del').click(); await pg.wait_for_timeout(200)
            assert await pg.locator('.banco .chip:has-text("Descartado")').count() == 0
            await drag(pg, '.chip:has-text("Beto")', '.time.bege .linha')
            await pg.wait_for_timeout(400); await pg.screenshot(path='test/t3-esc.png')
            assert await pg.locator('.time.bege .j:has-text("Beto")').count() == 1
            # apagar convidado já escalado e recolocar
            await pg.locator('.time.bege .j:has-text("Beto") .del').click(); await pg.wait_for_timeout(400)
            assert await pg.locator('.j:has-text("Beto")').count() == 0 and await pg.locator('.chip:has-text("Beto")').count() == 0
            await pg.fill('input[placeholder="Nome do convidado"]', 'Beto')
            await pg.select_option('.conv-add select', 'ATA'); await pg.click('.conv-add button')
            await drag(pg, '.chip:has-text("Beto")', '.time.bege .linha')
            await pg.wait_for_timeout(400)
            assert await pg.locator('.time.bege .j:has-text("Beto")').count() == 1
            await drag(pg, '.time.preto .linha .j', '.banco')
            assert await pg.locator('.banco .chip').count() >= 1

            # ---- caminho de volta (breadcrumb) ----
            await pg.click('text=Gerar escalação pro WhatsApp'); await pg.wait_for_selector('pre.msg')
            assert 'Escalação' in await pg.locator('.migalhas').inner_text()
            await pg.screenshot(path='test/t14-migalhas.png')
            assert (await pg.locator('.migalhas button').first.bounding_box())['y'] < 200  # fica no topo, acima do título
            await pg.locator('.migalhas button').first.click(); await pg.wait_for_selector('.times')
            assert await pg.locator('#root .seg button').nth(1).get_attribute('class') == 'on'  # voltou no passo Escalação


            # ---- rodada antiga a lançar ----
            await pg.click('#root button.tag.preto'); await pg.click('.sheet button:has-text("a lançar")')
            await pg.wait_for_selector('#root button.tag.preto:has-text("a lançar")'); await pg.wait_for_selector('.times')
            await pg.click('text=Sortear times'); await pg.wait_for_timeout(500)
            assert await pg.locator('.time .j').count() >= 10
            await pg.screenshot(path='test/t8-antiga.png')

            # ---- 3 times (Preto, Bege e Vermelho) na mesma rodada antiga ----
            await pg.click('.qtd-times button:has-text("3")'); await pg.wait_for_timeout(500)
            assert await pg.locator('.time.vermelho').count() == 1
            await pg.click('text=Sortear times'); await pg.wait_for_timeout(600)
            assert 'Sem goleiro' in await pg.locator('.aviso').inner_text()  # só 2 goleiros para 3 times
            n = [await pg.locator(f'.time.{c} .j').count() for c in ('preto', 'bege', 'vermelho')]
            assert max(n) - min(n) <= 1, n
            await pg.screenshot(path='test/t11-tres.png')
            await pg.locator('#root .seg button').nth(2).click(); await pg.wait_for_selector('.podio')
            await pg.click('.podio button:has-text("Vermelho") >> nth=0')
            await pg.click('.podio button:has-text("Bege") >> nth=1')
            await pg.click('text=Salvar resultado e pontuar'); await pg.wait_for_selector('table'); await pg.wait_for_timeout(500)
            assert '1 rodadas' in await pg.locator('section .tag').first.inner_text()
            await pg.locator('tbody tr').first.click(); await pg.wait_for_selector('.modal')
            ht = await pg.locator('.modal table').inner_text(); assert '1º lugar' in ht, ht
            await pg.screenshot(path='test/t12-podio.png'); await pg.click('text=Fechar')

            # ---- convite ----
            await aba(pg, 0); await pg.wait_for_selector('.item')
            await pg.locator('.item:has-text("Rodrigo") button[title="Convidar para o app"]').click(); await pg.click('text=Usuário comum'); await pg.wait_for_selector('pre.msg')
            texto = await pg.locator('pre.msg').inner_text(); assert '#/convite/' in texto and 'Rodrigo' in texto, texto
            token = texto.split('#/convite/')[1].split()[0]
            await pg.screenshot(path='test/t9-convite.png'); await pg.click('text=Fechar')

            # ---- atleta comum usa o link ----
            await pg.click('header a:has-text("sair")'); await pg.wait_for_selector('#login')
            await pg.goto(URL + '#/convite/' + token); await pg.reload(); await pg.wait_for_selector('text=Convite para')
            await pg.fill('input[type=email]', 'rodrigo@teste.com'); await pg.fill('input[type=password]', 'senha123'); await pg.click('button.btn:has-text("Criar conta")')
            await pg.wait_for_selector('nav'); await pg.wait_for_timeout(500)
            usr = await pg.locator('header .usr').inner_text(); assert 'Rodrigo' in usr and 'atleta' in usr, usr
            assert await pg.locator('.fab').count() == 0 and await pg.locator('button[title="Convidar para o app"]').count() == 0
            await aba(pg, 1); await pg.wait_for_selector('.stat')
            await pg.locator('#root .item:has-text("Rodrigo")').click(); await pg.wait_for_timeout(300)
            assert '✓ vai' in await pg.locator('#root .item:has-text("Rodrigo")').inner_text()
            await pg.locator('#root .item:has-text("Wilson")').click(); await pg.wait_for_timeout(300)
            assert '✓ vai' not in await pg.locator('#root .item:has-text("Wilson")').inner_text()
            await pg.locator('#root .seg button').nth(1).click(); await pg.wait_for_selector('.times')
            assert await pg.locator('text=Sortear times').count() == 0
            await pg.screenshot(path='test/t10-atleta.png')

            # ---- diretor volta, fecha a rodada e confere ranking e mensagens ----
            await pg.click('header a:has-text("sair")'); await login(pg, 'francoboaventura@icloud.com', '123456')
            await aba(pg, 1)
            await pg.locator('#root .seg button').nth(0).click(); await pg.wait_for_selector('.stat')  # o app lembra o último passo
            await pg.locator('#root .seg button').nth(2).click(); await pg.fill('.placar input >> nth=0', '3'); await pg.fill('.placar input >> nth=1', '1')
            await pg.click('text=Salvar resultado e pontuar'); await pg.wait_for_selector('table'); await pg.wait_for_timeout(500)
            await pg.screenshot(path='test/t4-rank.png')
            assert '2 rodadas' in await pg.locator('section .tag').first.inner_text()
            await pg.locator('tbody tr').first.click(); await pg.wait_for_selector('.modal'); await pg.screenshot(path='test/t5-hist.png')
            await pg.click('text=Fechar')
            await pg.locator('#root .seg button').nth(1).click(); await pg.locator('#root .item').first.click(); await pg.screenshot(path='test/t6-histjogos.png')
            await aba(pg, 3); await pg.wait_for_selector('pre.msg'); await pg.wait_for_timeout(400)
            t = await pg.locator('pre.msg').inner_text(); assert 'Ainda não confirmaram' in t, t
            await pg.click('text=Escalação (seg)'); await pg.wait_for_timeout(400)
            t = await pg.locator('pre.msg').inner_text(); assert 'Beto (convidado, ATA)' in t and '🧤' in t, t
            await pg.screenshot(path='test/t7-msg.png')
            await pg.click('text=Ranking'); await pg.wait_for_timeout(400)
            t = await pg.locator('pre.msg').inner_text(); assert 'RANKING CONDORES' in t, t

            # ---- encerrar o ano e destacar o campeão ----
            await aba(pg, 2); await pg.wait_for_selector('table')
            campeao = await pg.locator('#root tbody tr td').nth(1).inner_text()
            pg.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.click('text=Encerrar o ano'); await pg.wait_for_selector('.campeao-faixa')
            await pg.screenshot(path='test/t17-temporada.png')
            faixa = await pg.locator('.campeao-faixa').text_content()
            assert campeao in faixa and 'encerrada' in faixa, faixa
            assert await pg.locator('text=Reabrir').count() == 1
            # destaque na tela inicial
            await aba(pg, 0); await pg.wait_for_selector('.campeao-faixa.home')
            assert campeao in await pg.locator('.campeao-faixa.home').text_content()
            await pg.screenshot(path='test/t18-campeao-home.png')
            await pg.click('.campeao-faixa.home'); await pg.wait_for_selector('table')  # leva ao ranking
            # reabrir devolve o ranking ao vivo
            pg.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.click('text=Reabrir'); await pg.wait_for_timeout(800)
            assert await pg.locator('.campeao-faixa').count() == 0
            await aba(pg, 0); await pg.wait_for_selector('.item')
            assert await pg.locator('.campeao-faixa.home').count() == 0
            await aba(pg, 2); await pg.wait_for_selector('table')

            # ---- "saiu do time": some das listas e do ranking ----
            await aba(pg, 2); await pg.wait_for_selector('table')
            antes = await pg.locator('#root tbody tr').count()
            alvo = await pg.locator('#root tbody tr td').nth(1).inner_text()
            await aba(pg, 0); await pg.wait_for_selector('.item')
            await pg.locator(f'.item:has-text("{alvo}") .more:not([title])').click()
            pg.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.click('text=Saiu do time'); await pg.wait_for_timeout(600)
            assert await pg.locator(f'.card .item:has-text("{alvo}")').count() == 0, alvo
            await aba(pg, 2); await pg.wait_for_selector('table')
            assert await pg.locator('#root tbody tr').count() == antes - 1
            await pg.click('text=Mostrar quem saiu'); await pg.wait_for_timeout(300)
            assert await pg.locator('#root tbody tr').count() == antes
            assert 'saiu' in await pg.locator(f'#root tbody tr:has-text("{alvo}")').inner_text()
            await pg.screenshot(path='test/t16-saiu.png')
            # volta ao time pelo filtro "Saíram"
            await aba(pg, 0); await pg.click('.filtros button:has-text("Saíram")'); await pg.wait_for_timeout(500)
            assert await pg.locator(f'.card .item:has-text("{alvo}")').count() == 1
            await pg.locator(f'.item:has-text("{alvo}") .more:not([title])').click()
            await pg.click('text=Voltou ao time'); await pg.wait_for_timeout(600)
            await pg.click('.filtros button.limpa'); await pg.wait_for_timeout(400)
            assert await pg.locator(f'.card .item:has-text("{alvo}")').count() == 1
            print('ERROS:', erros)
            assert not erros, erros
            await b.close()
    finally:
        srv.terminate()
    print('OK')

asyncio.run(main())
