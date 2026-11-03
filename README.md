# Tafl : la fuite du jarl

Hnefatafl (échecs vikings) jouable en local, contre l'ordinateur ou à deux. Récit et périmètre
dans `GDD.md`, règles du jeu dans `regles.html`.

## Lancer

Ouvrir `index.html` dans un navigateur. Pas de serveur, pas de build.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | écrans de réglage et de partie |
| `regles.html` | règles pour débutants |
| `js/app.js` | interface : plateau, clavier, annonces, annulation |
| `js/ia.js` | IA à trois niveaux, qui choisit parmi les coups fournis par la bibliothèque |
| `css/app.css` | styles du jeu et de la page de règles |
| `vendor/tafl/` | la bibliothèque tafl et sa licence |

## Bibliothèque tafl

Les règles (coups, prises, fins de partie) viennent de
[tafl](https://github.com/demircancelebi/tafl) de Demircan Celebi, licence MIT
(`vendor/tafl/LICENSE`). Version embarquée : **4.0.0**.

`vendor/tafl/tafl.js` contient son `dist/index.js` intact, dans une enveloppe qui fournit `exports`
et un `require("util")` minimal pour le navigateur. Pour passer à une nouvelle version : récupérer
le paquet (`npm pack tafl@<version>`), puis remplacer le code entre l'en-tête de l'enveloppe et la
ligne `window.TaflLib = exports;` par le nouveau `package/dist/index.js`. Vérifier ensuite que
l'API utilisée n'a pas changé : `initialState`, `getPossibleActions`, `getPossibleMovesFrom`, `act`.

## IA

| Niveau | Comportement |
|---|---|
| Facile | joue au hasard, saisit une victoire une fois sur deux, préfère parfois prendre |
| Normal | regarde un coup devant lui : ne rate pas une victoire, bloque les fuites évidentes |
| Difficile | recherche alpha-bêta dans un budget de 1,5 s (4 coups en 7×7, 3 en 11×11) |

En Brandubh, chaque niveau bat le précédent dans les deux camps. En Copenhague, la difficile reste
faible avec les attaquants : la page se fige pendant sa réflexion, jusqu'à 1,5 s.
