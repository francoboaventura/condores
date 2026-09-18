"""Mock mínimo do Supabase (auth + REST) para testar o app no Playwright sem internet."""
import json, uuid, re
from urllib.parse import urlparse, parse_qs, unquote

DIRETORIA = {'francoboaventura@icloud.com': 'Franco'}
CODIGO = 'CONDORES-39585C'
USERS = {'francoboaventura@icloud.com': '123456'}

nomes = [("Wilson",11,9),("Rodrigo",25,2),("Ivan",4,1),("Lucas",19,9),("Henrique",12,12),("Edson",26,9),("Guilherme",17,2),
         ("Alisson",1,12),("Franco",15,2),("Rafael",12,1),("Guga",2,5),("Jura",21,2),("Maurício",13,10),("Carlos",10,10),
         ("Cassio",11,11),("Anderson",23,7),("Kauan",8,9),("Pico",17,12),("Dudu",9,5),("Simões",None,None)]
DB = {
    'cond_atletas': [dict(id=str(uuid.uuid4()), nome=n, posicao='GOL' if n in ('Pico','Cassio') else 'MEI', aniv_dia=d, aniv_mes=m,
                          whatsapp=None, foto_url=None, dm=False, ativo=True) for n,d,m in nomes],
    'cond_rodadas': [], 'cond_confirmacoes': [], 'cond_escalacoes': [], 'cond_diretoria': [dict(email=e, nome=n) for e,n in DIRETORIA.items()],
}

def resultado(r, t):
    if r['gols_preto'] == r['gols_bege']: return 'E'
    return 'V' if (('P' if r['gols_preto'] > r['gols_bege'] else 'B') == t) else 'D'

def view_ranking():
    enc = [r for r in DB['cond_rodadas'] if r['status'] == 'encerrada']
    out = []
    for a in DB['cond_atletas']:
        js = [(e, next(r for r in enc if r['id'] == e['rodada_id'])) for e in DB['cond_escalacoes'] if e['atleta_id'] == a['id'] and any(r['id']==e['rodada_id'] for r in enc)]
        pts = sum({'V':3,'E':1,'D':0}[resultado(r, e['time'])] for e, r in js)
        out.append(dict(atleta_id=a['id'], nome=a['nome'], posicao=a['posicao'], dm=a['dm'], ativo=a['ativo'], jogos=len(js), pontos=pts,
                        frequencia=(len(js)/len(enc)) if enc else 0, media=(pts/len(js)) if js else 0))
    return out

def view_historico():
    enc = {r['id']: r for r in DB['cond_rodadas'] if r['status'] == 'encerrada'}
    return [dict(atleta_id=e['atleta_id'], rodada_id=e['rodada_id'], data=enc[e['rodada_id']]['data'], time=e['time'], goleiro=e['goleiro'],
                 gols_preto=enc[e['rodada_id']]['gols_preto'], gols_bege=enc[e['rodada_id']]['gols_bege'], resultado=resultado(enc[e['rodada_id']], e['time']))
            for e in DB['cond_escalacoes'] if e['atleta_id'] and e['rodada_id'] in enc]

def filtrar(rows, qs):
    for k, vals in qs.items():
        if k in ('select', 'order', 'limit', 'on_conflict', 'columns'): continue
        for v in vals:
            op, _, val = v.partition('.')
            if op == 'eq': rows = [r for r in rows if str(r.get(k)).lower() == val.lower()]
            elif op == 'gt': rows = [r for r in rows if (r.get(k) or 0) > float(val)]
            elif op == 'in': rows = [r for r in rows if str(r.get(k)) in val.strip('()').split(',')]
    if 'order' in qs:
        for o in reversed(qs['order'][0].split(',')):
            col, _, d = o.partition('.')
            rows = sorted(rows, key=lambda r: (r.get(col) is None, r.get(col)), reverse=(d == 'desc'))
    return rows

def embed(rows, select):
    # suporta "*, cond_escalacoes(*, cond_atletas(nome, posicao))"
    m = re.search(r'cond_escalacoes\((.*)\)', select)
    if not m: return rows
    out = []
    for r in rows:
        r = dict(r)
        escs = [dict(e) for e in DB['cond_escalacoes'] if e['rodada_id'] == r['id']]
        if 'cond_atletas' in m.group(1):
            for e in escs:
                a = next((a for a in DB['cond_atletas'] if a['id'] == e['atleta_id']), None)
                e['cond_atletas'] = {'nome': a['nome'], 'posicao': a['posicao']} if a else None
        r['cond_escalacoes'] = escs
        out.append(r)
    return out

async def handle(route, request):
    u = urlparse(request.url); qs = parse_qs(unquote(u.query)); path = u.path; method = request.method
    body = json.loads(request.post_data) if request.post_data else None
    hdr = {'content-type': 'application/json', 'access-control-allow-origin': '*'}
    async def send(data, status=200): await route.fulfill(status=status, headers=hdr, body=json.dumps(data))

    if method == 'OPTIONS':
        return await route.fulfill(status=204, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'})
    if path.startswith('/auth/v1/token'):
        if USERS.get(body['email']) == body['password']:
            return await send(dict(access_token='tok', token_type='bearer', expires_in=3600, expires_at=9999999999, refresh_token='ref', user=dict(id='u1', email=body['email'], aud='authenticated', role='authenticated')))
        return await send(dict(error='invalid_grant', error_description='Invalid login credentials', msg='Invalid login credentials'), 400)
    if path.startswith('/auth/v1/user'):
        return await send(dict(id='u1', email='francoboaventura@icloud.com', aud='authenticated', role='authenticated'))
    if path.startswith('/auth/v1/logout'):
        return await send({}, 204)
    if path.startswith('/rest/v1/rpc/cond_aceitar_convite'):
        return await send('francoboaventura@icloud.com')

    tabela = path.split('/rest/v1/')[1]
    if tabela == 'cond_ranking': return await send(filtrar(view_ranking(), qs))
    if tabela == 'cond_historico': return await send(filtrar(view_historico(), qs))
    rows = DB[tabela]
    if method == 'GET':
        res = filtrar(rows, qs); res = embed(res, qs.get('select', ['*'])[0])
        if 'object' in request.headers.get('accept', ''): return await send(res[0] if res else None)
        return await send(res)
    prefer = request.headers.get('prefer', '')
    if method == 'POST':
        items = body if isinstance(body, list) else [body]
        saved = []
        for it in items:
            it = dict(it)
            if 'resolution=merge-duplicates' in prefer:
                key = ['rodada_id', 'atleta_id'] if tabela == 'cond_confirmacoes' else ['id']
                ex = next((r for r in rows if all(r.get(k) == it.get(k) for k in key) and it.get(key[0]) is not None), None)
                if ex: ex.update(it); saved.append(ex); continue
            if 'id' not in it: it['id'] = str(uuid.uuid4())
            if tabela == 'cond_rodadas': it.setdefault('status', 'aberta'); it.setdefault('gols_preto', None); it.setdefault('gols_bege', None)
            if tabela == 'cond_atletas': it.setdefault('dm', False); it.setdefault('ativo', True); it.setdefault('posicao', 'MEI')
            if tabela == 'cond_escalacoes': it.setdefault('goleiro', False); it.setdefault('atleta_id', None); it.setdefault('convidado_nome', None)
            rows.append(it); saved.append(it)
        return await send(saved if isinstance(body, list) else (saved[0] if 'object' in request.headers.get('accept', '') else saved), 201)
    if method == 'PATCH':
        for r in filtrar(rows, qs): r.update(body)
        return await send([])
    if method == 'DELETE':
        alvo = filtrar(rows, qs)
        DB[tabela] = [r for r in rows if r not in alvo]
        return await send([])
    await send({'message': 'não tratado'}, 500)
