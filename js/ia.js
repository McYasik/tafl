/*
 * IA du Tafl : trois niveaux. Toutes les règles (coups, prises, fin de partie) viennent de la
 * bibliothèque ; ce fichier ne fait que choisir parmi les coups qu'elle déclare possibles.
 * Les scores sont toujours exprimés du point de vue des attaquants : positif = bon pour eux.
 */
(function () {
    'use strict';

    var Lib = window.TaflLib;
    var ATT = Lib.TaflSide.ATTACKER;
    var GAGNE = 100000;
    // Une menace imparable vaut presque une victoire, mais reste en dessous d'une victoire réelle.
    var QUASI_GAGNE = 50000;
    var TEMPS_ECOULE = {};

    // Réglages par niveau. Le budget de temps borne le gel de la page pendant la réflexion.
    var NIVEAUX = {
        facile: {},
        normal: { bruit: 8 },
        difficile: { profondeurMax: { 7: 4, 11: 3 }, budgetMs: 1500, bruit: 1 }
    };

    // Le journal des coups est inutile pour chercher et coûte une copie à chaque coup simulé.
    function etatDeRecherche(etat) {
        return Object.assign({}, etat, { rules: Object.assign({}, etat.rules, { saveActions: false }) });
    }

    function trouverRoi(board) {
        for (var r = 0; r < board.length; r += 1) {
            for (var c = 0; c < board.length; c += 1) {
                if (board[r][c] === Lib.Piece.PK) {
                    return { r: r, c: c };
                }
            }
        }
        return null;
    }

    // Nombre de coins reliés à la case par une ligne droite et libre : le roi y filerait au coup suivant.
    function voiesVersCoins(board, r, c) {
        var n = board.length;
        var bords = [];
        if (r === 0 || r === n - 1) {
            bords.push({ fixe: 'r', debut: c, vers: [0, n - 1] });
        }
        if (c === 0 || c === n - 1) {
            bords.push({ fixe: 'c', debut: r, vers: [0, n - 1] });
        }
        var voies = 0;
        for (var i = 0; i < bords.length; i += 1) {
            for (var j = 0; j < 2; j += 1) {
                var cible = bords[i].vers[j];
                var pas = cible > bords[i].debut ? 1 : -1;
                var libre = cible !== bords[i].debut;
                for (var k = bords[i].debut + pas; libre && k !== cible + pas; k += pas) {
                    var cellule = bords[i].fixe === 'r' ? board[r][k] : board[k][c];
                    libre = cellule === Lib.Piece.__;
                }
                if (libre) {
                    voies += 1;
                }
            }
        }
        return voies;
    }

    // Évaluation d'une position. `bonus` départage les victoires : gagner tôt vaut mieux que tard.
    function evaluer(tafl, etat, bonus) {
        var res = etat.result;
        if (res.finished) {
            if (!res.winner) {
                return 0;
            }
            return (res.winner === ATT ? 1 : -1) * (GAGNE + bonus);
        }
        var board = etat.board;
        var n = board.length;
        var attaquants = 0;
        var defenseurs = 0;
        for (var r = 0; r < n; r += 1) {
            for (var c = 0; c < n; c += 1) {
                if (board[r][c] === Lib.Piece.PA) {
                    attaquants += 1;
                } else if (board[r][c] === Lib.Piece.PD) {
                    defenseurs += 1;
                }
            }
        }
        // Les défenseurs sont deux fois moins nombreux : chacun pèse plus lourd.
        var score = attaquants * 10 - defenseurs * 16;
        var roi = trouverRoi(board);
        if (!roi) {
            return score;
        }

        // Fuites du roi : un coin atteignable tout de suite, ou une case d'où un coin s'ouvre.
        var mouvements = tafl.getPossibleMovesFrom(etat, roi);
        var coinsDirects = 0;
        var menaces = 0;
        var fourchette = false;
        for (var i = 0; i < mouvements.length; i += 1) {
            var m = mouvements[i];
            if (tafl.isCorner(etat, m)) {
                coinsDirects += 1;
            } else {
                var voies = voiesVersCoins(board, m.r, m.c);
                menaces += voies;
                fourchette = fourchette || voies > 1;
            }
        }
        var auxDefenseurs = tafl.turnSide(etat) !== ATT;
        // Coin ouvert et trait aux défenseurs, ou deux coins ouverts : les attaquants ne peuvent plus parer.
        if (coinsDirects > 0 && (auxDefenseurs || coinsDirects > 1)) {
            return -QUASI_GAGNE;
        }
        // Trait aux défenseurs et une case qui ouvre deux coins d'un coup : la parade est presque impossible.
        if (auxDefenseurs && fourchette) {
            score -= 400;
        }
        score -= coinsDirects * 120 + menaces * 25 + mouvements.length;

        // Pression autour du roi : attaquants collés et cases hostiles (trône vide, coins).
        var voisins = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (var v = 0; v < 4; v += 1) {
            var case_ = { r: roi.r + voisins[v][0], c: roi.c + voisins[v][1] };
            if (tafl.insideBounds(board, case_) && tafl.canHelpCapture(etat, case_, ATT)) {
                score += 7;
            }
        }

        // Plus le roi est loin du coin le plus proche, mieux c'est pour les attaquants.
        var distance = Math.min(roi.r, n - 1 - roi.r) + Math.min(roi.c, n - 1 - roi.c);
        return score + distance * 3 + verrousDeCoins(board);
    }

    // Stratégie de base des attaquants : barrer l'approche des coins en diagonale. Les cases collées
    // au coin ne comptent pas : le coin est hostile, un attaquant y serait pris trop facilement.
    var VERROUS = [[1, 1, 6], [0, 2, 5], [2, 0, 5], [1, 2, 2], [2, 1, 2]];
    function verrousDeCoins(board) {
        var n = board.length;
        var bonus = 0;
        // Sur un petit plateau, les verrous se confondent avec le centre : la stratégie ne s'applique pas.
        if (n < 9) {
            return 0;
        }
        for (var i = 0; i < VERROUS.length; i += 1) {
            var dr = VERROUS[i][0];
            var dc = VERROUS[i][1];
            var cases = [[dr, dc], [dr, n - 1 - dc], [n - 1 - dr, dc], [n - 1 - dr, n - 1 - dc]];
            for (var j = 0; j < 4; j += 1) {
                if (board[cases[j][0]][cases[j][1]] === Lib.Piece.PA) {
                    bonus += VERROUS[i][2];
                }
            }
        }
        return bonus;
    }

    // Ordre des coups : ceux qui touchent au roi d'abord, l'élagage alpha-bêta coupe alors davantage.
    function ordonner(etat, coups) {
        var roi = trouverRoi(etat.board);
        if (!roi) {
            return coups;
        }
        function priorite(coup) {
            if (coup.from.r === roi.r && coup.from.c === roi.c) {
                return 0;
            }
            var d = Math.abs(coup.to.r - roi.r) + Math.abs(coup.to.c - roi.c);
            var surLigne = coup.to.r === roi.r || coup.to.c === roi.c;
            return d + (surLigne ? 0 : 4);
        }
        return coups.slice().sort(function (a, b) {
            return priorite(a) - priorite(b);
        });
    }

    // Négamax avec élagage alpha-bêta. `signe` vaut 1 quand c'est aux attaquants de jouer.
    function negamax(tafl, etat, profondeur, alpha, beta, signe, limite) {
        if (etat.result.finished || profondeur === 0) {
            return signe * evaluer(tafl, etat, profondeur);
        }
        if (Date.now() > limite) {
            throw TEMPS_ECOULE;
        }
        var coups = ordonner(etat, tafl.getPossibleActions(etat));
        var meilleur = -Infinity;
        for (var i = 0; i < coups.length; i += 1) {
            var valeur = -negamax(tafl, tafl.act(etat, coups[i]), profondeur - 1, -beta, -alpha, -signe, limite);
            if (valeur > meilleur) {
                meilleur = valeur;
            }
            if (valeur > alpha) {
                alpha = valeur;
            }
            if (alpha >= beta) {
                break;
            }
        }
        return meilleur;
    }

    function auHasard(liste) {
        return liste[Math.floor(Math.random() * liste.length)];
    }

    // Facile : joue au hasard, saisit une victoire une fois sur deux et préfère parfois prendre.
    function choisirFacile(tafl, etat, coups) {
        var camp = tafl.turnSide(etat);
        var gagnants = [];
        var prises = [];
        coups.forEach(function (coup) {
            var suite = tafl.act(etat, coup);
            if (suite.result.finished && suite.result.winner === camp) {
                gagnants.push(coup);
            } else if (suite.captures && suite.captures.length) {
                prises.push(coup);
            }
        });
        if (gagnants.length && Math.random() < 0.5) {
            return auHasard(gagnants);
        }
        if (prises.length && Math.random() < 0.4) {
            return auHasard(prises);
        }
        return auHasard(coups);
    }

    // Normal : regarde un coup devant lui. Il ne rate pas une victoire et bloque les fuites évidentes.
    function choisirNormal(tafl, etat, coups, reglage) {
        var signe = tafl.turnSide(etat) === ATT ? 1 : -1;
        var meilleur = null;
        var meilleurScore = -Infinity;
        coups.forEach(function (coup) {
            var score = signe * evaluer(tafl, tafl.act(etat, coup), 1) + Math.random() * reglage.bruit;
            if (score > meilleurScore) {
                meilleurScore = score;
                meilleur = coup;
            }
        });
        return meilleur;
    }

    // Difficile : approfondissement itératif dans un budget de temps. Si le temps manque au milieu
    // d'une profondeur, on garde le meilleur coup déjà calculé à cette profondeur s'il en existe un.
    function choisirDifficile(tafl, etat, coups, reglage) {
        var signe = tafl.turnSide(etat) === ATT ? 1 : -1;
        var profondeurMax = reglage.profondeurMax[etat.board.length] || 2;
        var limite = Date.now() + reglage.budgetMs;
        var racine = ordonner(etat, coups).map(function (coup) {
            return { coup: coup, suite: tafl.act(etat, coup), score: 0 };
        });
        var choix = racine[0].coup;
        for (var profondeur = 1; profondeur <= profondeurMax; profondeur += 1) {
            var alpha = -Infinity;
            var meilleurIci = null;
            try {
                for (var i = 0; i < racine.length; i += 1) {
                    var r = racine[i];
                    r.score = -negamax(tafl, r.suite, profondeur - 1, -Infinity, -alpha, -signe, limite) +
                        Math.random() * reglage.bruit;
                    if (meilleurIci === null || r.score > meilleurIci.score) {
                        meilleurIci = r;
                    }
                    if (r.score > alpha) {
                        alpha = r.score;
                    }
                }
            } catch (e) {
                if (e !== TEMPS_ECOULE) {
                    throw e;
                }
                if (meilleurIci) {
                    choix = meilleurIci.coup;
                }
                break;
            }
            choix = meilleurIci.coup;
            // Une victoire forcée trouvée : inutile de chercher plus loin.
            if (meilleurIci.score >= QUASI_GAGNE) {
                break;
            }
            // Les meilleurs coups de cette profondeur passent en tête pour la suivante.
            racine.sort(function (a, b) {
                return b.score - a.score;
            });
        }
        return choix;
    }

    /**
     * Choisit le coup du camp dont c'est le tour.
     * @param {Object} tafl instance de Tafl de la bibliothèque
     * @param {Object} etat état courant de la partie, non terminée
     * @param {string} niveau 'facile', 'normal' ou 'difficile'
     * @return {Object|null} coup {from, to}, ou null si aucun coup n'est possible
     */
    function choisir(tafl, etat, niveau) {
        var recherche = etatDeRecherche(etat);
        var coups = tafl.getPossibleActions(recherche);
        if (!coups.length) {
            return null;
        }
        var reglage = NIVEAUX[niveau] || NIVEAUX.normal;
        if (niveau === 'facile') {
            return choisirFacile(tafl, recherche, coups);
        }
        if (niveau === 'difficile') {
            return choisirDifficile(tafl, recherche, coups, reglage);
        }
        return choisirNormal(tafl, recherche, coups, reglage);
    }

    window.TaflIA = { choisir: choisir };
}());
