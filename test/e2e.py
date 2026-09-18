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
            await pg.locator('.item').nth(4).locator('.more:not([title])').click(); await pg.click('text=Afastamento justificado'); await pg.wait_for_timeout(300)
            assert 'afastado' in await pg.locator('.tag').first.inner_text()
            await pg.click('.fab'); await pg.fill('.modal input.txt >> nth=0', 'Zé Teste'); await pg.fill('.modal input.txt >> nth=1', '05/06'); await pg.click('.modal button:has-text("Salvar")')
            await pg.wait_for_timeout(300); assert await pg.locator('.item:has-text("Zé Teste")').count() == 1

            # ---- rodada próxima: confirmações e escalação ----
            await aba(pg, 1); await pg.wait_for_selector('.stat')
            assert 'antiga' in await pg.locator('#root .dica').first.inner_text()
            itens = pg.locator('#root .item')
            for i in range(14): await itens.nth(i).click(); await pg.wait_for_timeout(120)
            await pg.wait_for_timeout(300); await pg.screenshot(path='test/t2-conf.png')
            sim = await pg.locator('.stat b').first.inner_text(); assert int(sim) >= 11, sim
            assert 'AFASTADO' in (await pg.locator('#root .item').nth(4).inner_text()).upper()
            await pg.locator('#root .seg button').nth(1).click(); await pg.wait_for_selector('.times')
            await pg.click('text=Sortear times'); await pg.wait_for_timeout(500)
            await pg.fill('input[placeholder="Nome do convidado"]', 'Beto'); await pg.click('text=+ Convidado')
            await drag(pg, '.chip:has-text("Beto")', '.time.bege .linha')
            await pg.wait_for_timeout(400); await pg.screenshot(path='test/t3-esc.png')
            assert await pg.locator('.time.bege .j:has-text("Beto")').count() == 1
            await drag(pg, '.time.preto .linha .j', '.banco')
            assert await pg.locator('.banco .chip').count() >= 1

            # ---- rodada antiga a lançar ----
            await pg.click('#root button.tag.preto'); await pg.click('.sheet button:has-text("a lançar")')
            await pg.wait_for_selector('#root button.tag.preto:has-text("a lançar")'); await pg.wait_for_selector('.times')
            await pg.click('text=Sortear times'); await pg.wait_for_timeout(500)
            assert await pg.locator('.time .j').count() >= 10
            await pg.locator('#root .seg button').nth(2).click(); await pg.click('text=🟡 Bege'); await pg.wait_for_selector('table'); await pg.wait_for_timeout(400)
            await pg.screenshot(path='test/t8-antiga.png')
            assert '1 rodadas' in await pg.locator('section .tag').first.inner_text()

            # ---- convite ----
            await aba(pg, 0); await pg.wait_for_selector('.item')
            await pg.locator('.item:has-text("Rodrigo") button[title]').click(); await pg.click('text=Usuário comum'); await pg.wait_for_selector('pre.msg')
            texto = await pg.locator('pre.msg').inner_text(); assert '#/convite/' in texto and 'Rodrigo' in texto, texto
            token = texto.split('#/convite/')[1].split()[0]
            await pg.screenshot(path='test/t9-convite.png'); await pg.click('text=Fechar')

            # ---- atleta comum usa o link ----
            await pg.click('header a:has-text("sair")'); await pg.wait_for_selector('#login')
            await pg.goto(URL + '#/convite/' + token); await pg.reload(); await pg.wait_for_selector('text=Convite para')
            await pg.fill('input[type=email]', 'rodrigo@teste.com'); await pg.fill('input[type=password]', 'senha123'); await pg.click('button.btn:has-text("Criar conta")')
            await pg.wait_for_selector('nav'); await pg.wait_for_timeout(500)
            usr = await pg.locator('header .usr').inner_text(); assert 'Rodrigo' in usr and 'atleta' in usr, usr
            assert await pg.locator('.fab').count() == 0 and await pg.locator('button[title]').count() == 0
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
            await aba(pg, 1); await pg.wait_for_selector('.stat')
            await pg.locator('#root .seg button').nth(2).click(); await pg.fill('.placar input >> nth=0', '3'); await pg.fill('.placar input >> nth=1', '1')
            await pg.click('text=Salvar resultado e pontuar'); await pg.wait_for_selector('table'); await pg.wait_for_timeout(400)
            await pg.screenshot(path='test/t4-rank.png')
            assert '2 rodadas' in await pg.locator('section .tag').first.inner_text()
            await pg.locator('tbody tr').first.click(); await pg.wait_for_selector('.modal'); await pg.screenshot(path='test/t5-hist.png')
            await pg.click('text=Fechar')
            await pg.locator('#root .seg button').nth(1).click(); await pg.locator('#root .item').first.click(); await pg.screenshot(path='test/t6-histjogos.png')
            await aba(pg, 3); await pg.wait_for_selector('pre.msg'); await pg.wait_for_timeout(400)
            t = await pg.locator('pre.msg').inner_text(); assert 'Ainda não confirmaram' in t, t
            await pg.click('text=Escalação (seg)'); await pg.wait_for_timeout(400)
            t = await pg.locator('pre.msg').inner_text(); assert 'Beto (convidado)' in t and '🧤' in t, t
            await pg.screenshot(path='test/t7-msg.png')
            await pg.click('text=Ranking'); await pg.wait_for_timeout(400)
            t = await pg.locator('pre.msg').inner_text(); assert '2 rodadas' in t, t
            print('ERROS:', erros)
            assert not erros, erros
            await b.close()
    finally:
        srv.terminate()
    print('OK')

asyncio.run(main())
