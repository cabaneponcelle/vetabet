"""Extrait un planning hebdomadaire depuis un classeur .xlsx « assistovet ».

Le classeur a une feuille par semaine (« semaine 1 » … « semaine 4 »), sept
blocs de jour par feuille (en-tête « Heures » en colonne B), les personnes en
colonnes C.. et une ligne par tranche horaire. L'activité n'est écrite nulle
part : elle est codée par la COULEUR DE FOND de la cellule.

⚠ Piège coûteux : la moitié des fonds ne sont pas stockés en RVB mais sous la
forme « couleur de thème n, éclaircie de x % » (classeur créé avec un thème
personnalisé). Une première version ne lisait que les fonds RVB et perdait
60 % du planning sans rien signaler. On résout donc le thème du classeur et on
applique la teinte, comme le fait Excel à l'affichage.

Les quatre feuilles sont les quatre rangs d'un roulement (S1…S4) qui tourne
sans fin : on indique donc un lundi S1 de référence, puis la première semaine
à produire et leur nombre. Produit le JSON attendu par
prisma/import-planning-2027.ts :

    python -I scripts/extract_planning_xlsx.py <classeur.xlsx> <sortie.json> \\
        <lundi S1 de référence> <lundi de la 1re semaine voulue> [nb semaines]

Exemple (novembre 2026, roulement calé sur le lundi 02/11/2026 = S1) :

    python -I scripts/extract_planning_xlsx.py classeur.xlsx sortie.json \\
        2026-11-02 2026-11-02 4
"""

import collections
import colorsys
import datetime as dt
import json
import re
import sys

import openpyxl

# L'index « theme » d'une cellule ne suit pas l'ordre du clrScheme : Excel
# intervertit les deux premières paires (fond 1 / texte 1, fond 2 / texte 2).
ORDRE = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3",
         "accent4", "accent5", "accent6", "hlink", "folHlink"]


def palette_du_theme(xml: str) -> dict:
    """{index theme -> 'RRGGBB'} depuis le XML de thème du classeur."""
    bloc = re.search(r"<a:clrScheme.*?</a:clrScheme>", xml, re.S)
    if not bloc:
        return {}
    couleurs = {}
    for nom, corps in re.findall(r"<a:(\w+)>(.*?)</a:\1>", bloc.group(0), re.S):
        m = re.search(r'(?:srgbClr val|sysClr[^>]*lastClr)="([0-9A-Fa-f]{6})"', corps)
        if m:
            couleurs[nom] = m.group(1).upper()
    return {i: couleurs[n] for i, n in enumerate(ORDRE) if n in couleurs}


def applique_teinte(hexv: str, tint: float) -> str:
    """Éclaircit (tint > 0) ou assombrit (tint < 0) comme le fait Excel."""
    if not tint:
        return hexv
    r, g, b = (int(hexv[i : i + 2], 16) / 255 for i in (0, 2, 4))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = l * (1 + tint) if tint < 0 else l * (1 - tint) + tint
    r, g, b = colorsys.hls_to_rgb(h, min(max(l, 0), 1), s)
    return "".join(f"{round(c * 255):02X}" for c in (r, g, b))


def couleur_cellule(cell, palette):
    """'RRGGBB' du fond d'une cellule, ou None si pas de fond / fond blanc."""
    f = cell.fill
    if f is None or f.patternType != "solid":
        return None
    fg = f.fgColor
    t = getattr(fg, "type", None)
    if t == "rgb" and isinstance(fg.rgb, str):
        hexv = fg.rgb[-6:].upper()
    elif t == "theme":
        base = palette.get(fg.theme)
        if not base:
            return None
        hexv = applique_teinte(base, float(fg.tint or 0))
    else:
        return None
    return None if hexv in ("FFFFFF", "000000") else hexv

# Nuances considérées comme équivalentes (reprise de scripts/extract_planning.py).
UNIFY = {
    "FF0000": "FF5050",
    "F714E9": "FF00FF",
    "ED7D31": "F88628",
    "F1A983": "F4B183",
    # Teintes du thème du classeur rapprochées de la légende de la clinique.
    # Chaque ligne s'appuie sur le fichier ODS de janvier, où les mêmes
    # personnes font la même activité, nommée en toutes lettres.
    "FA1F00": "FF5050",  # rouge      → chirurgie tissus mous
    "0079BF": "0070C0",  # bleu       → scanner (Florent, Pauline)
    "10AD9B": "3AA87E",  # vert-bleu  → échographie (Florent, Clémence, Arnaud)
    "CCECFF": "66FFFF",  # bleu ciel  → consultation (le plus fréquent, comme en janvier)
    "FFD9EC": "FFCCFF",  # rose pâle  → back up
    "FFB3D9": "FFCCFF",  # idem, 1 créneau
    "A0E886": "00FF00",  # vert clair → hospitalisation (Caroline, Clémence)
    "C0EFAF": "00FF00",  # idem, 1 créneau
    "FFA295": "FFA6A6",  # saumon     → formation chirurgie (Pauline)
    "FFC000": "F88628",  # ambre      → dentisterie (confirmé : Jil, corrigé dans l'app)
    "FF8EC7": "F4B183",  # rose       → consultation spécialisée (Carole, Clarice, Florent)
    "FF42A1": "FA26CD",  # rose vif   → garde, 1 créneau
}

# Légende de la clinique (identique à celle du planning 2026 et du fichier ODS).
COLORMAP = {
    "66FFFF": "Consultation",
    "F4B183": "Consultation spécialisée",
    "FBE5D6": "Formation consult spé",
    "FF00FF": "Urgences",
    "00FF00": "Hospitalisation",
    "E2F0D9": "Formation hospi",
    "FF5050": "Chirurgie tissus mous",
    "CCCCFF": "Chirurgie spécialisée",
    "FFA6A6": "Formation chirurgie",
    "7030A0": "Anesthésie",
    "CC99FF": "Formation anesthésie",
    "3AA87E": "Échographie",
    "0070C0": "Scanner",
    "87D5B7": "Formation imagerie",
    "F88628": "Dentisterie",
    "FFCCFF": "Back up",
    "0066FF": "Bureau",
    "8FAADC": "Divers",
    "BFBFBF": "Congé",
    "E98FDC": "Chir urg",
    "F7D1D5": "Back-up chir",
    "FA26CD": "Garde",
}

# Couleurs du classeur absentes de la légende : on les importe quand même, sous
# un nom provisoire, pour ne pas perdre les créneaux. Le nom reste à confirmer.
A_PRECISER = {
    "CCECFF": ("À préciser (bleu ciel)", "#CCECFF"),
    "FFD9EC": ("À préciser (rose pâle)", "#FFD9EC"),
    "A0E886": ("À préciser (vert clair)", "#A0E886"),
    "92D050": ("À préciser (vert)", "#92D050"),
    "FFC000": ("À préciser (ambre)", "#FFC000"),
    "72F2E3": ("À préciser (turquoise pâle)", "#72F2E3"),
    "DFF7D7": ("À préciser (vert très pâle)", "#DFF7D7"),
    "987C00": ("À préciser (ocre)", "#987C00"),
    "FF8EC7": ("À préciser (rose)", "#FF8EC7"),
    "FFC1B8": ("À préciser (saumon pâle)", "#FFC1B8"),
    "FFA295": ("À préciser (saumon)", "#FFA295"),
    "FFF0AD": ("À préciser (jaune pâle)", "#FFF0AD"),
    "CFBEA5": ("À préciser (beige)", "#CFBEA5"),
    "FF42A1": ("À préciser (rose vif)", "#FF42A1"),
    "DDE8CB": ("À préciser (vert amande)", "#DDE8CB"),
    "C0EFAF": ("À préciser (vert d'eau)", "#C0EFAF"),
    "16E7CF": ("À préciser (turquoise)", "#16E7CF"),
    "61D836": ("À préciser (vert vif)", "#61D836"),
    "61D992": ("À préciser (vert menthe)", "#61D992"),
    "52BA75": ("À préciser (vert sapin)", "#52BA75"),
    "03C97E": ("À préciser (émeraude)", "#03C97E"),
    "FFB3D9": ("À préciser (rose layette)", "#FFB3D9"),
}


def nom_colonne(brut):
    """'Int 3 Melek' -> 'Melek' ; 'Anne So' -> 'Anne Sophie' ; 'Int 1' -> None."""
    s = str(brut).strip()
    if not s or s.lower() in ("jour", "heures"):
        return None
    if s.startswith("Anne So"):
        return "Anne Sophie"
    m = re.match(r"^(?:Int|In)\s*\d*\s*(.*)$", s)
    if m:
        reste = m.group(1).strip()
        return reste or None  # « Int 1 » (intérimaire anonyme) : ignoré
    return s


def heures_de(libelle):
    """'9h - 10h' -> (9, 10) ; '22h - 24h' -> (22, 24) ; sinon None."""
    m = re.match(r"^\s*(\d{1,2})\s*h?\s*-\s*(\d{1,2})\s*h", str(libelle))
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def lire(classeur):
    """{rang du roulement 1-4 -> [(personne, jour 0-6, h début, h fin, activité)]}"""
    wb = openpyxl.load_workbook(classeur, data_only=True)
    brut = wb.loaded_theme
    palette = palette_du_theme(brut.decode("utf-8") if isinstance(brut, bytes) else brut or "")

    par_semaine = collections.defaultdict(list)
    inconnues = collections.Counter()
    qui = collections.defaultdict(collections.Counter)
    ignorees = collections.Counter()

    for semaine in range(1, 5):
        ws = wb[f"semaine {semaine}"]
        entetes = [
            r
            for r in range(1, ws.max_row + 1)
            if ws.cell(r, 2).value and "Heure" in str(ws.cell(r, 2).value)
        ]
        for jour, hr in enumerate(entetes[:7]):
            # Lignes horaires du bloc : jusqu'à l'en-tête suivant.
            fin_bloc = entetes[jour + 1] if jour + 1 < len(entetes) else ws.max_row + 1
            lignes = []
            for r in range(hr + 1, fin_bloc):
                h = heures_de(ws.cell(r, 2).value)
                if h:
                    lignes.append((r, h))

            colonnes = {}
            for c in range(3, ws.max_column + 1):
                val = ws.cell(hr, c).value
                nom = nom_colonne(val) if val else None
                if nom:
                    colonnes[c] = nom
                elif val:
                    ignorees[str(val).strip()] += 1

            for c, personne in colonnes.items():
                cases = []
                for r, (h1, h2) in lignes:
                    col = couleur_cellule(ws.cell(r, c), palette)
                    act = None
                    if col:
                        col = UNIFY.get(col, col)
                        act = COLORMAP.get(col)
                        if not act and col in A_PRECISER:
                            act = A_PRECISER[col][0]
                        if not act:
                            inconnues[col] += 1
                        else:
                            qui[act][personne] += 1
                    cases.append((act, h1, h2))

                # Fusionne les heures consécutives de même activité.
                k = 0
                while k < len(cases):
                    act = cases[k][0]
                    if act is None:
                        k += 1
                        continue
                    debut = cases[k][1]
                    fin = cases[k][2]
                    while k < len(cases) and cases[k][0] == act:
                        fin = cases[k][2]
                        k += 1
                    par_semaine[semaine].append((personne, jour, debut, fin, act))

    return par_semaine, inconnues, qui, ignorees


def main():
    classeur, sortie, lundi_s1, premier_lundi = sys.argv[1:5]
    nb_semaines = int(sys.argv[5]) if len(sys.argv) > 5 else 4

    ancre = dt.date.fromisoformat(lundi_s1)
    debut = dt.date.fromisoformat(premier_lundi)
    if ancre.weekday() or debut.weekday():
        raise SystemExit("Les deux dates doivent être des lundis.")

    par_semaine, inconnues, qui, ignorees = lire(classeur)

    items = []
    plan = []
    for n in range(nb_semaines):
        lundi = debut + dt.timedelta(days=7 * n)
        semaine = ((lundi - ancre).days // 7) % 4 + 1
        plan.append((lundi, semaine, len(par_semaine[semaine])))

        for personne, jour, h1, h2, act in par_semaine[semaine]:
            date = lundi + dt.timedelta(days=jour)
            items.append(
                {
                    "worker": personne,
                    "date": date.isoformat(),
                    "heureDebut": f"{h1:02d}:00",
                    "heureFin": "23:59" if h2 >= 24 else f"{h2:02d}:00",
                    "activity": act,
                }
            )

    items.sort(key=lambda x: (x["date"], x["heureDebut"], x["worker"]))
    nouvelles = {
        nom: couleur
        for hexv, (nom, couleur) in A_PRECISER.items()
        if any(i["activity"] == nom for i in items)
    }
    nouvelles["Garde"] = "#FA26CD"

    json.dump(
        {
            "source": f"{classeur} (couleurs de thème résolues, roulement calé sur {lundi_s1} = S1)",
            "semaine1": premier_lundi,
            "nouvellesActivites": nouvelles,
            "items": items,
        },
        open(sortie, "w", encoding="utf-8"),
        ensure_ascii=False,
        indent=1,
    )

    dates = sorted({i["date"] for i in items})
    print(f"{len(items)} créneaux, du {dates[0]} au {dates[-1]}")
    print(f"{len({i['worker'] for i in items})} personnes")
    print("\nsemaines produites :")
    for lundi, semaine, n in plan:
        print(f"  {lundi}  ->  S{semaine}  ({n} créneaux)")
    print("\npar activité (et qui la fait) :")
    for a, n in collections.Counter(i["activity"] for i in items).most_common():
        gens = ", ".join(p for p, _ in qui[a].most_common(5))
        print(f"  {n:4d}  {a:34s} {gens}")
    if ignorees:
        print("\ncolonnes ignorées :", dict(ignorees))
    if inconnues:
        print("couleurs non reconnues :", dict(inconnues))


if __name__ == "__main__":
    main()
