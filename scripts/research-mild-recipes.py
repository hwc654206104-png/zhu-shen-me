"""Research-only source screening. Does not modify the app or live catalog."""
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'build/recipe-research/sichuan'
existing = json.loads((ROOT / 'docs/miniapp/recipes/recipes.json').read_text('utf-8'))
names = {r.get(k, '') for r in existing for k in ('name', 'source_title')}
preferred = set('锅巴肉片 粉蒸肉 荷叶蒸肉 大南瓜蒸肉 罐烧肉 三菌炖鸡 生烧鸡腿 糯米鸡 冷汁盐水鸭 清蒸鲢鱼 松鼠鱼 翡翠虾仁 番茄炒虾仁 锅贴豆腐 椿芽烘蛋 冬菜蒸肉饼 火腿烘蛋 酿茄饼 清炖牛肉汤 清炖牛尾汤 清汤白菜'.split())
rows = []
for path in sorted((SOURCE / 'latex').glob('recipe-*.tex')):
    raw = path.read_text('utf-8')
    text = '\n'.join(line for line in raw.splitlines() if not line.lstrip().startswith('%'))
    match = re.search(r'\\begin\{recipe\}(?:\[([^\]]+)\])?\{([^}]+)\}', text)
    assert match, path
    alias, name = match.groups()
    ingredients = re.findall(r'\\ingredient\{([^}]+)\}\{([^}]+)\}', text)
    chili = bool(re.search('辣|豆瓣|泡椒|剁椒|红油|芥末', text))
    rows.append(dict(name=name, alias=alias, ingredients=ingredients,
                     noChiliDetected=not chili,
                     existingExactName=name in names or bool(alias and alias in names),
                     householdShortlist=name in preferred and not chili,
                     sourceUrl='https://github.com/neo954/sichuan-cookbook/blob/master/latex/'+path.name,
                     sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
assert len(rows) == 312
candidates = [r for r in rows if r['householdShortlist'] and not r['existingExactName']]
report = dict(checkedDate='2026-10-22', source='neo954/sichuan-cookbook',
              license='BSD-3-Clause; retain copyright and license notices',
              scanned=len(rows), noChiliDetected=sum(r['noChiliDetected'] for r in rows),
              candidateCount=len(candidates), candidates=candidates, recipes=rows,
              limitations=['No chili keyword is a screening signal, not verified taste.',
                            'Exact-name deduplication only; similar compositions require review.',
                            'Historical units and terminology require explicit conversion review.',
                            'Research only; no catalog import or cloud upload performed.'])
out = ROOT / 'docs/miniapp/recipes/mild-source-research.json'
out.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({k:report[k] for k in ('scanned','noChiliDetected','candidateCount')}, ensure_ascii=True))
print(json.dumps([r['name'] for r in candidates], ensure_ascii=True))
