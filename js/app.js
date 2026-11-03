/*
 * Interface du Tafl : écrans, plateau jouable à la souris et au clavier, annonces vocalisées.
 * Les règles viennent de la bibliothèque (window.TaflLib), les coups de l'ordinateur de window.TaflIA.
 */
(function () {
    'use strict';

    var Lib = window.TaflLib;
    var tafl = new Lib.Tafl();
    var ATT = Lib.TaflSide.ATTACKER;
    var DEF = Lib.TaflSide.DEFENDER;

    // Plateau et règles transmis tels quels à la bibliothèque. Copenhague = ses règles par défaut.
    var VARIANTES = {
        brandubh: {
            nom: 'Brandubh 7×7',
            init: { board: Lib.TaflBoard._7_BRANDUBH, rules: { attackerCountToCapture: 2, shieldWalls: false, exitForts: false } }
        },
        copenhague: {
            nom: 'Copenhague 11×11',
            init: { board: Lib.TaflBoard._11_CLASSIC, rules: {} }
        }
    };

    var NOMS_CAMPS = {};
    NOMS_CAMPS[ATT] = 'attaquants';
    NOMS_CAMPS[DEF] = 'défenseurs';

    var NOMS_PIECES = { A: 'attaquant', D: 'défenseur', K: 'jarl' };

    // Fins de partie décrites par la bibliothèque, traduites.
    var FINS = {
        'Attackers captured the king': 'le jarl est capturé.',
        'Attackers surrounded the defenders': 'les défenseurs sont entièrement encerclés.',
        'King escaped from corner': 'le jarl a atteint un coin et pris la mer.',
        'King escaped from edge': 'le jarl a atteint le bord.',
        'King escaped through exit fort': 'le jarl s\'est retranché dans un fort imprenable sur le bord.',
        'Defender loses on repetition': 'la même position est revenue trois fois, les défenseurs perdent.',
        'Mover loses on repetition': 'la même position est revenue trois fois.',
        'Draw on repetition': 'la même position est revenue trois fois.',
        'No move left for opponent': 'l\'adversaire n\'a plus aucun coup possible.'
    };

    var COLONNES = 'abcdefghijklmnopqrs';

    var el = {};
    var partie = null;

    function $(id) {
        return document.getElementById(id);
    }

    // Un seul écran visible à la fois ; le focus va sur son titre pour situer l'utilisateur.
    function afficherEcran(id) {
        ['ecran-reglage', 'ecran-partie'].forEach(function (autre) {
            $(autre).hidden = autre !== id;
        });
        var titre = $(id).querySelector('h1');
        if (titre) {
            titre.focus();
        }
    }

    // Les annonces rapprochées sont groupées en un seul message, pour qu'aucune ne soit écrasée
    // par la suivante. Vider puis remplir au tour suivant force la relecture d'un message identique.
    var fileAnnonces = [];
    var minuterieAnnonce = null;
    function annoncer(texte) {
        if (!fileAnnonces.length) {
            el.annonce.textContent = '';
        }
        fileAnnonces.push(texte);
        window.clearTimeout(minuterieAnnonce);
        minuterieAnnonce = window.setTimeout(function () {
            el.annonce.textContent = fileAnnonces.join(' ');
            fileAnnonces = [];
        }, 50);
    }

    // Refus d'une action : affiché sous le statut et annoncé.
    function signaler(texte) {
        el.message.textContent = texte;
        annoncer(texte);
    }

    function nomCase(r, c) {
        return COLONNES.charAt(c) + (partie.taille - r);
    }

    function compterPieces(board) {
        var compte = { A: 0, D: 0 };
        board.forEach(function (ligne) {
            ligne.forEach(function (p) {
                if (compte[p] !== undefined) {
                    compte[p] += 1;
                }
            });
        });
        return compte;
    }

    function estHumain(camp) {
        return partie.mode === 'deux' || camp === partie.campHumain;
    }

    function peutJouer() {
        return !partie.etat.result.finished && !partie.reflexion && estHumain(tafl.turnSide(partie.etat));
    }

    // Le réglage : camp et niveau n'ont de sens que contre l'ordinateur.
    function majFormulaire() {
        var contreIA = el.form.elements.mode.value === 'ia';
        $('groupe-camp').hidden = !contreIA;
        $('groupe-niveau').hidden = !contreIA;
    }

    function demarrer(reglage) {
        var variante = VARIANTES[reglage.variante];
        var etat = tafl.initialState(variante.init);
        partie = {
            variante: variante,
            mode: reglage.mode,
            campHumain: reglage.camp,
            niveau: reglage.niveau,
            etat: etat,
            taille: etat.board.length,
            initial: compterPieces(etat.board),
            historique: [],
            journal: [],
            selection: null,
            destinations: [],
            focus: { r: Math.floor(etat.board.length / 2), c: Math.floor(etat.board.length / 2) },
            reflexion: false
        };
        construirePlateau();
        el.titrePartie.textContent = variante.nom;
        el.message.textContent = '';
        afficherEcran('ecran-partie');
        rendre();
        annoncer('Partie lancée, ' + variante.nom + '. ' + texteTour());
        enchainer();
    }

    // Grille construite une fois par partie ; rendre() ne fait ensuite que mettre à jour les attributs.
    function construirePlateau() {
        var n = partie.taille;
        el.plateau.innerHTML = '';
        el.plateau.style.setProperty('--taille', n);
        el.plateau.setAttribute('aria-label', 'Plateau ' + n + ' cases sur ' + n);
        el.cases = [];
        for (var r = 0; r < n; r += 1) {
            var ligne = document.createElement('div');
            ligne.setAttribute('role', 'row');
            ligne.className = 'plateau__ligne';
            el.cases[r] = [];
            for (var c = 0; c < n; c += 1) {
                var cell = document.createElement('div');
                cell.setAttribute('role', 'gridcell');
                cell.className = 'case';
                cell.dataset.r = r;
                cell.dataset.c = c;
                cell.tabIndex = -1;
                if (tafl.isCenter(partie.etat.board, { r: r, c: c })) {
                    cell.classList.add('case--trone');
                }
                if (tafl.isCorner(partie.etat, { r: r, c: c })) {
                    cell.classList.add('case--coin');
                }
                var piece = document.createElement('span');
                piece.className = 'piece';
                piece.setAttribute('aria-hidden', 'true');
                cell.appendChild(piece);
                ligne.appendChild(cell);
                el.cases[r][c] = cell;
            }
            el.plateau.appendChild(ligne);
        }
        // Repères visuels de coordonnées, déjà portés par le nom accessible de chaque case.
        el.reperesColonnes.innerHTML = '';
        el.reperesLignes.innerHTML = '';
        for (var i = 0; i < n; i += 1) {
            var col = document.createElement('span');
            col.textContent = COLONNES.charAt(i);
            el.reperesColonnes.appendChild(col);
            var lig = document.createElement('span');
            lig.textContent = String(n - i);
            el.reperesLignes.appendChild(lig);
        }
    }

    function estDestination(r, c) {
        return partie.destinations.some(function (d) {
            return d.r === r && d.c === c;
        });
    }

    function libelleCase(r, c) {
        var etat = partie.etat;
        var piece = etat.board[r][c];
        var morceaux = [nomCase(r, c)];
        morceaux.push(NOMS_PIECES[piece] || 'vide');
        if (tafl.isCenter(etat.board, { r: r, c: c })) {
            morceaux.push('trône');
        } else if (tafl.isCorner(etat, { r: r, c: c })) {
            morceaux.push('coin');
        }
        if (estDestination(r, c)) {
            morceaux.push('destination possible');
        }
        var dernier = etat.lastAction;
        if (dernier && dernier.to.r === r && dernier.to.c === c) {
            morceaux.push('arrivée du dernier coup');
        }
        if (dernier && dernier.from.r === r && dernier.from.c === c) {
            morceaux.push('départ du dernier coup');
        }
        if ((etat.captures || []).some(function (p) {
            return p.r === r && p.c === c;
        })) {
            morceaux.push('pièce prise au dernier coup');
        }
        return morceaux.join(', ');
    }

    // Seules les pièces jouables maintenant portent un état de sélection : ailleurs, le lecteur
    // d'écran annoncerait « non sélectionné » sur chaque case.
    function estSelectionnable(r, c) {
        var piece = partie.etat.board[r][c];
        return piece !== ' ' && peutJouer() && tafl.canControl(tafl.turnSide(partie.etat), piece);
    }

    function rendre() {
        var etat = partie.etat;
        var dernier = etat.lastAction;
        var prises = etat.captures || [];
        for (var r = 0; r < partie.taille; r += 1) {
            for (var c = 0; c < partie.taille; c += 1) {
                var cell = el.cases[r][c];
                var piece = etat.board[r][c];
                cell.firstChild.className = 'piece' + (piece !== ' ' ? ' piece--' + piece : '');
                var choisie = !!partie.selection && partie.selection.r === r && partie.selection.c === c;
                if (choisie || estSelectionnable(r, c)) {
                    cell.setAttribute('aria-selected', choisie ? 'true' : 'false');
                } else {
                    cell.removeAttribute('aria-selected');
                }
                cell.classList.toggle('case--destination', estDestination(r, c));
                cell.classList.toggle('case--depart', !!dernier && dernier.from.r === r && dernier.from.c === c);
                cell.classList.toggle('case--arrivee', !!dernier && dernier.to.r === r && dernier.to.c === c);
                cell.classList.toggle('case--prise', prises.some(function (p) {
                    return p.r === r && p.c === c;
                }));
                cell.setAttribute('aria-label', libelleCase(r, c));
                cell.tabIndex = partie.focus.r === r && partie.focus.c === c ? 0 : -1;
            }
        }
        el.plateau.setAttribute('aria-busy', partie.reflexion ? 'true' : 'false');
        el.statut.textContent = texteStatut();
        var restant = compterPieces(etat.board);
        el.pertesAttaquants.textContent = (partie.initial.A - restant.A) + ' sur ' + partie.initial.A;
        el.pertesDefenseurs.textContent = (partie.initial.D - restant.D) + ' sur ' + partie.initial.D;
        el.annuler.setAttribute('aria-disabled', annulable() ? 'false' : 'true');
        el.journal.innerHTML = '';
        partie.journal.forEach(function (texte) {
            var li = document.createElement('li');
            li.textContent = texte;
            el.journal.appendChild(li);
        });
        el.zoneJournal.scrollTop = el.zoneJournal.scrollHeight;
    }

    function annulable() {
        return partie.historique.length > 0 && !partie.reflexion;
    }

    function texteTour() {
        var camp = tafl.turnSide(partie.etat);
        var qui = 'Aux ' + NOMS_CAMPS[camp] + ' de jouer';
        if (partie.mode === 'ia') {
            qui += camp === partie.campHumain ? ' : à vous.' : ' : l\'ordinateur.';
        } else {
            qui += '.';
        }
        return qui;
    }

    function texteFin() {
        var res = partie.etat.result;
        var cause = FINS[res.desc] || res.desc;
        if (!res.winner) {
            return 'Partie nulle : ' + cause;
        }
        var texte = 'Victoire des ' + NOMS_CAMPS[res.winner] + ' : ' + cause;
        if (partie.mode === 'ia') {
            texte += res.winner === partie.campHumain ? ' Vous avez gagné.' : ' L\'ordinateur a gagné.';
        }
        return texte;
    }

    function texteStatut() {
        if (partie.etat.result.finished) {
            return texteFin();
        }
        if (partie.reflexion) {
            return 'L\'ordinateur réfléchit…';
        }
        return texteTour();
    }

    // Joue un coup déjà validé (clic, clavier ou ordinateur), puis passe la main.
    function appliquer(coup) {
        var camp = tafl.turnSide(partie.etat);
        partie.historique.push(partie.etat);
        partie.etat = tafl.act(partie.etat, coup);
        partie.selection = null;
        partie.destinations = [];
        el.message.textContent = '';
        var texte = NOMS_CAMPS[camp].charAt(0).toUpperCase() + NOMS_CAMPS[camp].slice(1) + ' : ' +
            nomCase(coup.from.r, coup.from.c) + ' vers ' + nomCase(coup.to.r, coup.to.c);
        var prises = partie.etat.captures || [];
        if (prises.length) {
            texte += ', prise en ' + prises.map(function (p) {
                return nomCase(p.r, p.c);
            }).join(' et ');
        }
        texte += '.';
        partie.journal.push(texte);
        rendre();
        annoncer(texte + ' ' + texteStatut());
        enchainer();
    }

    // Fait jouer l'ordinateur si c'est son tour. Le délai laisse la page afficher « réfléchit » et
    // le lecteur d'écran recevoir l'annonce en attente avant que le calcul ne fige la page.
    function enchainer() {
        var etat = partie.etat;
        if (etat.result.finished || estHumain(tafl.turnSide(etat))) {
            return;
        }
        partie.reflexion = true;
        rendre();
        var reference = partie;
        window.setTimeout(function () {
            // Partie abandonnée pendant la réflexion : ce coup ne la concerne plus.
            if (reference !== partie) {
                return;
            }
            var coup = window.TaflIA.choisir(tafl, partie.etat, partie.niveau);
            partie.reflexion = false;
            if (coup) {
                appliquer(coup);
            } else {
                rendre();
            }
        }, 350);
    }

    function selectionner(r, c) {
        var moves = tafl.getPossibleMovesFrom(partie.etat, { r: r, c: c });
        var nom = NOMS_PIECES[partie.etat.board[r][c]];
        if (!moves.length) {
            signaler('Le ' + nom + ' en ' + nomCase(r, c) + ' ne peut pas bouger.');
            return;
        }
        partie.selection = { r: r, c: c };
        partie.destinations = moves;
        el.message.textContent = '';
        rendre();
        annoncer(nom.charAt(0).toUpperCase() + nom.slice(1) + ' en ' + nomCase(r, c) + ' choisi, ' +
            moves.length + (moves.length > 1 ? ' destinations possibles.' : ' destination possible.'));
    }

    function deselectionner(silencieux) {
        if (!partie.selection) {
            return;
        }
        partie.selection = null;
        partie.destinations = [];
        rendre();
        if (!silencieux) {
            annoncer('Choix annulé.');
        }
    }

    // Même logique pour le clic et le clavier : choisir une pièce, puis sa destination.
    function activer(r, c) {
        if (partie.etat.result.finished) {
            annoncer(texteFin());
            return;
        }
        if (!peutJouer()) {
            signaler(partie.reflexion ? 'L\'ordinateur réfléchit, patientez.' : texteTour());
            return;
        }
        var sel = partie.selection;
        if (sel && estDestination(r, c)) {
            appliquer({ from: sel, to: { r: r, c: c } });
            return;
        }
        if (sel && sel.r === r && sel.c === c) {
            deselectionner(false);
            return;
        }
        var piece = partie.etat.board[r][c];
        if (piece !== ' ' && tafl.canControl(tafl.turnSide(partie.etat), piece)) {
            selectionner(r, c);
            return;
        }
        if (sel) {
            signaler(nomCase(r, c) + ' n\'est pas une destination possible.');
        } else if (piece !== ' ') {
            signaler('Cette pièce appartient aux ' + NOMS_CAMPS[tafl.opponentSide(partie.etat)] + '.');
        } else {
            signaler('Choisissez d\'abord une de vos pièces.');
        }
    }

    function deplacerFocus(r, c) {
        var n = partie.taille;
        partie.focus = { r: Math.max(0, Math.min(n - 1, r)), c: Math.max(0, Math.min(n - 1, c)) };
        rendre();
        el.cases[partie.focus.r][partie.focus.c].focus();
    }

    function surTouche(e) {
        var f = partie.focus;
        var n = partie.taille;
        var touches = {
            ArrowUp: [f.r - 1, f.c],
            ArrowDown: [f.r + 1, f.c],
            ArrowLeft: [f.r, f.c - 1],
            ArrowRight: [f.r, f.c + 1],
            Home: [f.r, 0],
            End: [f.r, n - 1]
        };
        if (touches[e.key]) {
            e.preventDefault();
            deplacerFocus(touches[e.key][0], touches[e.key][1]);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activer(f.r, f.c);
        } else if (e.key === 'Escape') {
            deselectionner(false);
        }
    }

    function surClic(e) {
        var cell = e.target.closest('.case');
        if (!cell) {
            return;
        }
        var r = Number(cell.dataset.r);
        var c = Number(cell.dataset.c);
        // La case cliquée devient la case active du tabindex itinérant, même si le clic est refusé.
        partie.focus = { r: r, c: c };
        rendre();
        activer(r, c);
        cell.focus();
    }

    // Contre l'ordinateur, on revient au dernier coup du joueur ; à deux, d'un seul coup.
    function annuler() {
        if (!annulable()) {
            signaler(partie.reflexion ? 'L\'ordinateur réfléchit, patientez.' : 'Aucun coup à annuler.');
            return;
        }
        do {
            partie.etat = partie.historique.pop();
            partie.journal.pop();
        } while (partie.mode === 'ia' && partie.historique.length &&
            tafl.turnSide(partie.etat) !== partie.campHumain);
        partie.selection = null;
        partie.destinations = [];
        el.message.textContent = '';
        rendre();
        annoncer('Coup annulé. ' + texteStatut());
        enchainer();
    }

    document.addEventListener('DOMContentLoaded', function () {
        el = {
            form: $('form-reglage'),
            plateau: $('plateau'),
            reperesColonnes: $('reperes-colonnes'),
            reperesLignes: $('reperes-lignes'),
            statut: $('statut'),
            annonce: $('annonce'),
            journal: $('journal'),
            zoneJournal: $('journal').parentNode,
            annuler: $('annuler'),
            titrePartie: $('titre-partie'),
            message: $('message'),
            pertesAttaquants: $('pertes-attaquants'),
            pertesDefenseurs: $('pertes-defenseurs')
        };
        el.form.addEventListener('change', majFormulaire);
        el.form.addEventListener('submit', function (e) {
            e.preventDefault();
            var champs = el.form.elements;
            demarrer({
                variante: champs.variante.value,
                mode: champs.mode.value,
                camp: champs.camp.value,
                niveau: champs.niveau.value
            });
        });
        el.plateau.addEventListener('keydown', surTouche);
        el.plateau.addEventListener('click', surClic);
        el.annuler.addEventListener('click', annuler);
        $('nouvelle-partie').addEventListener('click', function () {
            // Coupe une éventuelle réflexion en cours : son coup sera ignoré.
            partie = { reflexion: false };
            afficherEcran('ecran-reglage');
        });
        majFormulaire();
    });
}());
