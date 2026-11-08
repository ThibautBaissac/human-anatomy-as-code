"""Spike 1: how many BodyParts3D concepts get FR / Latin names via Wikidata (FMA ID -> P1402).

Usage: python3 -I analyze.py <bodyparts3d_dir> <wikidata_fma.csv> <out_dir>
"""
import csv
import sys
from collections import defaultdict
from pathlib import Path

bp_dir, wd_csv, out_dir = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])


def read_tsv(name):
    with open(bp_dir / name, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


names = {}
for tree in ("isa", "partof"):
    for row in read_tsv(f"{tree}_parts_list_e.txt"):
        names[row["concept id"]] = row["en"]

elements = defaultdict(set)  # concept -> FJ mesh files
for tree in ("isa", "partof"):
    for row in read_tsv(f"{tree}_element_parts.txt"):
        elements[row["concept id"]].add(row["element file id"])

parents = set()
for tree in ("isa", "partof"):
    for row in read_tsv(f"{tree}_inclusion_relation_list.txt"):
        parents.add(row["parent id"])

all_mesh_files = set().union(*elements.values())
# A concept rendered by exactly one mesh file = an individually pickable structure.
single_mesh = {c for c, fj in elements.items() if len(fj) == 1}
leaves = {c for c in names if c not in parents}

# Wikidata: several items may share an FMA id; keep the best-labelled one.
wd = {}
with open(wd_csv, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        key = "FMA" + row["fma"]
        score = sum(bool(row[k]) for k in ("ta2", "fr", "la"))
        if key not in wd or score > wd[key][0]:
            wd[key] = (score, row)


def coverage(label, concepts):
    n = len(concepts)
    rows = [wd[c][1] for c in concepts if c in wd]

    def pct(k):
        return 100 * k / n if n else 0

    in_wd = len(rows)
    ta2 = sum(1 for r in rows if r["ta2"])
    fr = sum(1 for r in rows if r["fr"])
    la = sum(1 for r in rows if r["la"])
    fr_la = sum(1 for r in rows if r["fr"] and r["la"])
    return (
        f"| {label} | {n} | {in_wd} ({pct(in_wd):.0f} %) | {ta2} ({pct(ta2):.0f} %) "
        f"| {fr} ({pct(fr):.0f} %) | {la} ({pct(la):.0f} %) | {fr_la} ({pct(fr_la):.0f} %) |"
    )


lines = [
    f"Distinct mesh files (FJ*.obj) referenced: {len(all_mesh_files)}",
    f"Concepts total (isa ∪ partof): {len(names)}",
    "",
    "| Set | N | In Wikidata (FMA) | TA2 ID | Label FR | Label LA | FR + LA |",
    "|---|---|---|---|---|---|---|",
    coverage("All concepts", set(names)),
    coverage("Leaf concepts", leaves),
    coverage("Single-mesh concepts", single_mesh),
]
report = "\n".join(lines)
print(report)
out_dir.mkdir(parents=True, exist_ok=True)
(out_dir / "coverage.md").write_text(report + "\n", encoding="utf-8")

with open(out_dir / "structures_labels.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["fma", "en_bp3d", "mesh_files", "wikidata", "ta2", "ta98", "fr", "la", "en_wd"])
    for c in sorted(names):
        r = wd.get(c, (0, {}))[1]
        w.writerow([
            c, names[c], " ".join(sorted(elements.get(c, ()))),
            r.get("item", "").rsplit("/", 1)[-1], r.get("ta2", ""), r.get("ta98", ""),
            r.get("fr", ""), r.get("la", ""), r.get("en", ""),
        ])

# Laterality folding: "left femur" -> generic "femur" (FR/LA then get a side suffix).
import re

by_en = {}
for _, r in wd.values():
    if r["en"]:
        by_en.setdefault(r["en"].lower(), r)
for c, n in names.items():
    if c in wd:
        by_en.setdefault(n.lower(), wd[c][1])

SIDE = re.compile(r"\b(left|right)\b ?")


def resolve(c):
    r = wd.get(c, (0, None))[1]
    if r and r["fr"]:
        return r, "direct"
    generic = SIDE.sub("", names[c]).strip()
    if generic != names[c]:
        g = by_en.get(generic.lower())
        if g and g["fr"]:
            return g, "folded"
    return r, "none"


def folded_coverage(label, concepts):
    n = len(concepts)
    res = [resolve(c) for c in concepts]
    fr = sum(1 for r, how in res if r and r["fr"] and how != "none")
    la = sum(1 for r, how in res if r and r["la"] and how != "none")
    folded = sum(1 for _, how in res if how == "folded")
    return f"| {label} | {n} | {fr} ({100*fr/n:.0f} %) | {la} ({100*la/n:.0f} %) | {folded} |"


lateral = sum(1 for c in single_mesh if SIDE.search(names[c]))
report2 = "\n".join([
    "",
    f"Single-mesh concepts with left/right in name: {lateral} ({100*lateral/len(single_mesh):.0f} %)",
    "",
    "After laterality folding (generic term + side suffix):",
    "",
    "| Set | N | Label FR | Label LA | of which folded |",
    "|---|---|---|---|---|",
    folded_coverage("All concepts", set(names)),
    folded_coverage("Leaf concepts", leaves),
    folded_coverage("Single-mesh concepts", single_mesh),
])
print(report2)
with open(out_dir / "coverage.md", "a", encoding="utf-8") as f:
    f.write(report2 + "\n")

missing = sorted((c for c in single_mesh if resolve(c)[1] == "none"), key=names.get)
with open(out_dir / "missing_fr.txt", "w", encoding="utf-8") as f:
    for c in missing:
        f.write(f"{c}\t{names[c]}\n")
