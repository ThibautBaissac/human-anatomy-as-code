"""Builds the reduced BodyParts3D extract in bp3d/ (same file formats as BodyParts3D 4.0).

Run: python3 -I make-bp3d.py   (from this directory). Each block covers one import case.
"""
partof = {  # concept: (name, part-of parent or None)
 'FMA20394': ('human body', None),
 # bilateral fold, with a canonical concept that is itself a candidate (lower limb)
 'FMA7184': ('lower limb', 'FMA20394'),
 'FMA24981': ('left lower limb', 'FMA7184'),
 'FMA24980': ('right lower limb', 'FMA7184'),
 'FMA24475': ('left femur', 'FMA24981'),
 'FMA24474': ('right femur', 'FMA24980'),
 'FMA70248': ('left femoral artery', 'FMA24981'),
 'FMA70247': ('right femoral artery', 'FMA24980'),
 # no-fold pair, unpaired side, side word inside the name
 'FMA9576': ('thorax', 'FMA20394'),
 'FMA7088': ('heart', 'FMA9576'),
 'FMA7097': ('left atrium', 'FMA7088'),
 'FMA7096': ('right atrium', 'FMA7088'),
 'FMA5028': ('right lymphatic duct', 'FMA9576'),
 'FMA7333': ('superior lobe of left lung', 'FMA9576'),
 # group owning the fragments no specific concept claims
 'FMA10427': ('body wall', 'FMA20394'),
 'FMA13335': ('external oblique', 'FMA10427'),
 # parent conflict between sides; canonical name only in Wikidata (upper limb, biceps brachii)
 'FMA7186': ('left upper limb', 'FMA20394'),
 'FMA7185': ('right upper limb', 'FMA20394'),
 'FMA24896': ('left arm', 'FMA7186'),
 'FMA24895': ('right arm', 'FMA7185'),
 'FMA37672': ('left biceps brachii', 'FMA24896'),
 'FMA37671': ('right biceps brachii', 'FMA7185'),
 # slug collision (case only)
 'FMA12519': ('First cervical vertebra', 'FMA20394'),
 # side word inside the name: folds when both sides exist
 'FMA37690': ('long head of left biceps brachii', 'FMA24896'),
 'FMA37689': ('long head of right biceps brachii', 'FMA24895'),
 # side word inside the name, on the no-fold list as a suffix ("... of ventricle"): stays apart
 'FMA9300': ('anterior wall of left ventricle', 'FMA7088'),
 'FMA9301': ('anterior wall of right ventricle', 'FMA7088'),
 # canonical is-a concept owning one trunk mesh per side (common carotid artery)
 'FMA4058': ('left common carotid artery', 'FMA9576'),
 'FMA3941': ('right common carotid artery', 'FMA9576'),
}
isa = {  # concept: (name, is-a parents)
 'FMA9611': ('femur', ['FMA5018']),
 'FMA5018': ('bone organ', []),
 'FMA7163': ('skin', ['FMA7161']),
 'FMA7161': ('integument', []),
 'FMA99999': ('first cervical vertebra', ['FMA5018']),
 'FMA3939': ('common carotid artery', []),
}
own = {  # concept: meshes listed for it in its own right (part-of tree)
 'FMA24475': ['FJ3259M'], 'FMA24474': ['FJ3259'], 'FMA70248': ['FJ3001M'], 'FMA70247': ['FJ3001'],
 'FMA7097': ['FJ2420'], 'FMA7096': ['FJ2421'], 'FMA5028': ['FJ4001'], 'FMA7333': ['FJ4100'],
 'FMA10427': ['FJ9001', 'FJ9002'], 'FMA13335': ['FJ9003'], 'FMA37672': ['FJ1234M'], 'FMA37671': ['FJ1234'],
 'FMA12519': ['FJ5001'],
 'FMA37690': ['FJ1300M'], 'FMA37689': ['FJ1300'], 'FMA9300': ['FJ2430'], 'FMA9301': ['FJ2431'],
 'FMA4058': ['FJ7001M', 'FJ7101M', 'FJ7102M'], 'FMA3941': ['FJ7001', 'FJ7101', 'FJ7102'],
}
children = {}
for c, (_, p) in partof.items():
    if p: children.setdefault(p, []).append(c)
def elements(c):
    out = set(own.get(c, []))
    for k in children.get(c, []): out |= elements(k)
    return out
el_partof = {c: elements(c) for c in partof}
el_isa = {
 'FMA9611': {'FJ3259', 'FJ3259M'},
 'FMA5018': {'FJ3259', 'FJ3259M', 'FJ5001', 'FJ5002'},
 'FMA7163': {'FJ2810'}, 'FMA7161': {'FJ2810'},
 'FMA99999': {'FJ5002'},
 'FMA3939': {'FJ7001', 'FJ7001M'},
}
def w(name, header, rows):
    with open(f'bp3d/{name}', 'w') as f:
        f.write('\t'.join(header) + '\n')
        for r in rows: f.write('\t'.join(r) + '\n')
w('partof_parts_list_e.txt', ['concept id', 'representation id', 'en'], [(c, f'BP{i}', n) for i, (c, (n, _)) in enumerate(sorted(partof.items()))])
w('isa_parts_list_e.txt', ['concept id', 'representation id', 'en'], [(c, f'BPI{i}', n) for i, (c, (n, _)) in enumerate(sorted(isa.items()))])
w('partof_inclusion_relation_list.txt', ['parent id', 'parent name', 'child id', 'child name'],
  [(p, partof[p][0], c, n) for c, (n, p) in sorted(partof.items()) if p])
w('isa_inclusion_relation_list.txt', ['parent id', 'parent name', 'child id', 'child name'],
  [(p, isa[p][0], c, n) for c, (n, ps) in sorted(isa.items()) for p in ps])
w('partof_element_parts.txt', ['concept id', 'name', 'element file id'], [(c, partof[c][0], fj) for c in sorted(el_partof) for fj in sorted(el_partof[c])])
w('isa_element_parts.txt', ['concept id', 'name', 'element file id'], [(c, isa[c][0], fj) for c in sorted(el_isa) for fj in sorted(el_isa[c])])
