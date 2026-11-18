"""Extrait un planning depuis le fichier ODS « Planning individuel » de la clinique.

Le fichier a une feuille par vétérinaire. Chaque feuille contient un à quatre
blocs, un par semaine du roulement, sous la forme :

    Carole                      <- titre
    Semaine 1, 3 et 4 --> 30h   <- à quelles semaines du roulement ce bloc
          L  Mar  Me  J  V  S  D   s'applique (parfois absent)
    9-10h  …                    <- 14 lignes horaires, l'ACTIVITÉ EST LA
    …                              COULEUR DE FOND de la cellule
    22-7h  …

⚠ Deux pièges, tous deux rencontrés en production :

1. Un bloc peut valoir pour PLUSIEURS semaines (« Semaine 1, 3 et 4 »,
   « Semaine 1 2 3 4 »). Prendre le bloc n° 2 pour la semaine 2 fait
   disparaître des journées entières du planning de certaines personnes.

2. « Semaine 1 » n'est pas la première semaine du mois : c'est un rang dans un
   roulement de quatre semaines (S1, S2, S3, S4) qui tourne sans fin. Il faut
   donc dire au script quel lundi est un S1 de référence.

    python -I scripts/extract_planning_ods.py <fichier.ods> <sortie.json> \\
        <lundi S1 de référence> <lundi de la 1re semaine voulue> [nb semaines]

Exemple (janvier 2027, roulement calé sur le lundi 02/11/2026 = S1) :

    python -I scripts/extract_planning_ods.py planning.ods sortie.json \\
        2026-11-02 2027-01-04 4
"""

import collections
import datetime as dt
import json
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

NS = {
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "style": "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
    "fo": "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
}

# Nuances équivalentes (mêmes conventions que le planning 2026).
UNIFY = {
    "FF0000": "FF5050",
    "F714E9": "FF00FF",
    "ED7D31": "F88628",
    "F1A983": "F4B183",
}

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

# Habillage du tableau (bandeaux de titre, colonnes de week-end grisées) :
# ce ne sont pas des activités.
DECOR = {"FFFFFF", "9999FF", "DAE3F3", "D9D9D9", "000000"}

JOURS = {"L": 0, "MAR": 1, "ME": 2, "J": 3, "V": 4, "S": 5, "D": 6}


def nom_personne(feuille):
    """'Anne_Sophie' -> 'Anne Sophie' ; 'Pauline_F' -> 'Pauline'.

    Les feuilles portent parfois l'initiale du nom de famille pour distinguer
    deux homonymes ; les comptes de l'application, eux, n'ont que le prénom.
    """
    nom = feuille.replace("_", " ").strip()
    morceaux = nom.split()
    if len(morceaux) > 1 and len(morceaux[-1]) == 1:
        nom = " ".join(morceaux[:-1])
    return nom


def styles_couleur(z):
    """{nom de style -> 'RRGGBB'} : la couleur de fond est dans les styles."""
    couleurs = {}
    for membre in ("styles.xml", "content.xml"):
        racine = ET.fromstring(z.read(membre))
        for st in racine.iter(f"{{{NS['style']}}}style"):
            nom = st.get(f"{{{NS['style']}}}name")
            for props in st.iter(f"{{{NS['style']}}}table-cell-properties"):
                col = props.get(f"{{{NS['fo']}}}background-color")
                if col and col != "transparent":
                    couleurs[nom] = col.upper().lstrip("#")
    return couleurs


def grille_de(table, couleurs):
    """Feuille -> liste de lignes, chaque ligne étant [(texte, couleur), …]."""
    lignes = []
    for ligne in table.iter(f"{{{NS['table']}}}table-row"):
        rep_l = int(ligne.get(f"{{{NS['table']}}}number-rows-repeated", 1))
        cases = []
        for cell in ligne.iter(f"{{{NS['table']}}}table-cell"):
            rep = int(cell.get(f"{{{NS['table']}}}number-columns-repeated", 1))
            st = cell.get(f"{{{NS['table']}}}style-name")
            couleur = couleurs.get(st, "")
            texte = "".join(cell.itertext()).strip()
            for _ in range(min(rep, 40)):
                cases.append((texte, couleur))
        for _ in range(min(rep_l, 40)):
            lignes.append(cases)
    return lignes


def heures_de(libelle):
    """'9-10h' -> (9, 10) ; '22-7h' -> (22, 31) (franchit minuit)."""
    m = re.match(r"^\s*(\d{1,2})\s*-\s*(\d{1,2})\s*h", libelle)
    if not m:
        return None
    debut, fin = int(m.group(1)), int(m.group(2))
    if fin <= debut:
        fin += 24  # 22-7h : se termine le lendemain matin
    return debut, fin


def semaines_de(libelle, defaut):
    """'Semaine 1, 3 et 4 --> 30h' -> [1, 3, 4] ; 'Carole' -> [defaut]."""
    tete = re.split(r"-+>|→", libelle)[0]  # « --> 30h » ne doit pas donner 3 et 0
    nums = [int(n) for n in re.findall(r"[1-4]", tete)]
    return sorted(set(nums)) or [defaut]


def extraire(fichier):
    """[(personne, semaine du roulement, jour 0-6, h début, h fin, activité)]"""
    with zipfile.ZipFile(fichier) as z:
        couleurs = styles_couleur(z)
        racine = ET.fromstring(z.read("content.xml"))

    creneaux = []
    inconnues = collections.Counter()
    resume = []

    for table in racine.iter(f"{{{NS['table']}}}table"):
        personne = nom_personne(table.get(f"{{{NS['table']}}}name"))
        lignes = grille_de(table, couleurs)

        # Lignes d'en-tête des jours : elles ouvrent chaque bloc.
        entetes = [
            i
            for i, ligne in enumerate(lignes)
            if [c[0].upper() for c in ligne if c[0]][:3] == ["L", "MAR", "ME"]
        ]
        if not entetes:
            continue

        semaines_vues = []
        for rang, i_entete in enumerate(entetes, start=1):
            # Colonnes des jours, repérées par leur intitulé.
            colonnes = {}
            for j, (texte, _) in enumerate(lignes[i_entete]):
                jour = JOURS.get(texte.upper().strip())
                if jour is not None and jour not in colonnes.values():
                    colonnes[j] = jour

            # Intitulé du bloc : les deux lignes au-dessus de l'en-tête.
            libelle = " ".join(
                lignes[k][0][0]
                for k in (i_entete - 2, i_entete - 1)
                if k >= 0 and lignes[k] and lignes[k][0][0]
            )
            semaines = semaines_de(libelle, rang)
            semaines_vues.append((libelle.strip() or "(sans intitulé)", semaines))

            # Lignes horaires du bloc, jusqu'à l'en-tête suivant.
            fin_bloc = entetes[rang] if rang < len(entetes) else len(lignes)
            horaires = []
            for k in range(i_entete + 1, fin_bloc):
                if not lignes[k]:
                    continue
                h = heures_de(lignes[k][0][0])
                if h:
                    horaires.append((k, h))

            for col, jour in colonnes.items():
                cases = []
                for k, (h1, h2) in horaires:
                    couleur = lignes[k][col][1] if col < len(lignes[k]) else ""
                    couleur = UNIFY.get(couleur, couleur)
                    activite = None
                    if couleur and couleur not in DECOR:
                        activite = COLORMAP.get(couleur)
                        if not activite:
                            inconnues[couleur] += 1
                    cases.append((activite, h1, h2))

                # Fusionne les heures consécutives de même activité.
                k = 0
                while k < len(cases):
                    activite = cases[k][0]
                    if activite is None:
                        k += 1
                        continue
                    debut, fin = cases[k][1], cases[k][2]
                    while k < len(cases) and cases[k][0] == activite:
                        fin = cases[k][2]
                        k += 1
                    for semaine in semaines:
                        creneaux.append((personne, semaine, jour, debut, fin, activite))

        resume.append((personne, semaines_vues))

    return creneaux, inconnues, resume


def main():
    fichier, sortie, lundi_s1, premier_lundi = sys.argv[1:5]
    nb_semaines = int(sys.argv[5]) if len(sys.argv) > 5 else 4

    ancre = dt.date.fromisoformat(lundi_s1)
    debut = dt.date.fromisoformat(premier_lundi)
    if ancre.weekday() or debut.weekday():
        raise SystemExit("Les deux dates doivent être des lundis.")

    creneaux, inconnues, resume = extraire(fichier)
    par_semaine = collections.defaultdict(list)
    for personne, semaine, jour, h1, h2, activite in creneaux:
        par_semaine[semaine].append((personne, jour, h1, h2, activite))

    items = []
    plan = []
    for n in range(nb_semaines):
        lundi = debut + dt.timedelta(days=7 * n)
        # Rang dans le roulement : S1, S2, S3, S4, S1, … depuis l'ancre.
        semaine = ((lundi - ancre).days // 7) % 4 + 1
        plan.append((lundi, semaine, len(par_semaine[semaine])))

        for personne, jour, h1, h2, activite in par_semaine[semaine]:
            date = lundi + dt.timedelta(days=jour)
            if h2 > 24:
                # Garde de nuit : coupée en deux, la fin bascule au lendemain.
                items.append(
                    {
                        "worker": personne,
                        "date": date.isoformat(),
                        "heureDebut": f"{h1:02d}:00",
                        "heureFin": "23:59",
                        "activity": activite,
                    }
                )
                items.append(
                    {
                        "worker": personne,
                        "date": (date + dt.timedelta(days=1)).isoformat(),
                        "heureDebut": "00:00",
                        "heureFin": f"{h2 - 24:02d}:00",
                        "activity": activite,
                    }
                )
            else:
                items.append(
                    {
                        "worker": personne,
                        "date": date.isoformat(),
                        "heureDebut": f"{h1:02d}:00",
                        "heureFin": "23:59" if h2 >= 24 else f"{h2:02d}:00",
                        "activity": activite,
                    }
                )

    items.sort(key=lambda x: (x["date"], x["heureDebut"], x["worker"]))
    json.dump(
        {
            "source": f"{fichier} (roulement calé sur {lundi_s1} = S1)",
            "semaine1": premier_lundi,
            "nouvellesActivites": {"Chir urg": "#E98FDC", "Back-up chir": "#F7D1D5"},
            "items": items,
        },
        open(sortie, "w", encoding="utf-8"),
        ensure_ascii=False,
        indent=1,
    )

    print(f"{len(items)} créneaux du {items[0]['date']} au {items[-1]['date']}")
    print("\nsemaines produites :")
    for lundi, semaine, n in plan:
        print(f"  {lundi}  ->  S{semaine}  ({n} créneaux)")
    print("\nblocs lus par personne :")
    for personne, blocs in resume:
        detail = " ; ".join(f"{lib} -> S{','.join(map(str, s))}" for lib, s in blocs)
        print(f"  {personne:12s} {detail}")
    if inconnues:
        print("\ncouleurs non reconnues :", dict(inconnues))


if __name__ == "__main__":
    main()
