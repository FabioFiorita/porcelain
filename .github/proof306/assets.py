import json
import sys

assets = json.load(open(sys.argv[1]))
groups = [x for x in assets if x.get('AssetType') == 'IconGroup']
assert groups, 'No compiled IconGroup records'
appearances = {x.get('Appearance', 'UIAppearanceAny') for x in groups}
assert 'UIAppearanceDark' in appearances, appearances
assert 'ISAppearanceTintable' in appearances, appearances
assert appearances & {'UIAppearanceAny', 'UIAppearanceLight'}, appearances
for group in groups:
    assert group['LayerCount'] == 1, group
    assert len(group['Layers']) == 1, group
    for layer in group['Layers']:
        assert layer['LayerSize'] == '1024,1024', layer
        assert layer['LayerPosition'] == '0,0', layer
        assert (layer['PixelWidth'], layer['PixelHeight']) == (1024, 1024), layer
images = [x for x in assets if x.get('AssetType') == 'Icon Image']
for idiom in ['phone', 'pad']:
    for appearance in ['UIAppearanceAny', 'UIAppearanceDark', 'ISAppearanceTintable']:
        matches = [x for x in images if x.get('Idiom') == idiom and x.get('Appearance', 'UIAppearanceAny') == appearance]
        assert matches, (idiom, appearance, 'missing compiled icon')
        assert all((x['PixelWidth'], x['PixelHeight']) == (1024, 1024) for x in matches), matches
print(json.dumps({'result': 'PASS', 'groups': groups, 'images': images}, indent=2))
