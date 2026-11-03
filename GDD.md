# Tafl : la fuite du jarl

## Récit d'ouverture

Hiver 793. Le jarl Ragnvald s'est retranché au cœur de sa halle, sa garde serrée autour de lui.
Dehors, les guerriers de Sigurd ont refermé le cercle. Aux quatre coins du domaine, des barques
attendent dans la brume. Si le jarl atteint un coin, il prend la mer et le clan survit. S'il tombe,
tout tombe avec lui. Choisis ton camp.

## Le jeu

Hnefatafl, jeu de plateau viking asymétrique : le jarl et sa garde au centre, les attaquants autour,
deux fois plus nombreux. Les règles sont celles de la bibliothèque
[tafl](https://github.com/demircancelebi/tafl), qui n'a pas d'interface : ce projet lui en donne une.

## V1 (livrée)

- Deux variantes : Brandubh 7×7 (courte) et Copenhague 11×11 (référence).
- Contre l'ordinateur (facile, normal, difficile) ou à deux sur le même écran.
- Plateau jouable à la souris et au clavier, coups annoncés aux lecteurs d'écran.
- Annulation de coup, journal des coups, page de règles pour les débutants.
- 100 % local : `index.html` s'ouvre en double-clic, sans serveur ni build.
- Pas d'écran d'intro (retiré à la demande de Yasik) : le récit tient en une ligne d'ambiance sur
  l'écran de réglage.

## V2 (idées)

- **Daily tafl** : une position du jour, la même pour tous, à résoudre.
- **IA plus forte**, surtout côté attaquants en Copenhague, où la difficile reste faible faute de
  pouvoir calculer assez loin en 1,5 s. Pistes : calcul dans un Web Worker, table de transposition,
  évaluation plus fine.
