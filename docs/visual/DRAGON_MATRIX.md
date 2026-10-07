# Matrice des dragons

Générée par `scripts/audit-dragons.py` à partir du dépôt (ne pas modifier à la main).

Variantes trouvées : dragon, dragonne. Stades trouvés : baby, young, adult, legendary. Pas de distinction mâle/femelle en dehors de ces deux variantes (le dragon de l’enfant, la dragonne du parent).

## Couverture des poses

| Variante | Stade | NORMAL | SLEEP | WINGS_UP | WINGS_MID | WINGS_DOWN | Autres | Squelette (os / os souples / maille) | Ancrages | Équipements compatibles |
|---|---|---|---|---|---|---|---|---|---|---|
| dragon | baby | 1236×831 | 472×178 | 470×221 | **manquant** | 457×191 | — | baby.sprite.json (19 / 16 / 26 px) | 13/13 | 22 |
| dragon | young | 1239×931 | 637×232 | 666×262 | **manquant** | 574×284 | — | young.sprite.json (19 / 16 / 26 px) | 13/13 | 28 |
| dragon | adult | 1244×1017 | 1522×631 | 1513×862 | 1512×628 | 1515×806 | — | adult.sprite.json (19 / 16 / 26 px) | 13/13 | 29 |
| dragon | legendary | 1253×1075 | 760×348 | 742×287 | **manquant** | 742×329 | — | legendary.sprite.json (19 / 16 / 26 px) | 13/13 | 29 |
| dragonne | baby | 1510×978 | 457×183 | 490×221 | **manquant** | 532×204 | — | baby.dragonne.json (19 / 16 / 30 px) | 13/13 | 22 |
| dragonne | young | 1524×1024 | 611×227 | 630×264 | **manquant** | 612×289 | — | young.dragonne.json (19 / 16 / 30 px) | 13/13 | 28 |
| dragonne | adult | 1524×1011 | 709×273 | 750×284 | **manquant** | 698×311 | — | adult.dragonne.json (19 / 16 / 30 px) | 13/13 | 29 |
| dragonne | legendary | 1536×1022 | 742×342 | 735×284 | **manquant** | 734×328 | — | legendary.dragonne.json (19 / 16 / 30 px) | 13/13 | 29 |

Assets absents partout : WINGS_MID, yeux fermés, gueule ouverte, ailes séparées du corps (voir DRAGON_ASSET_REQUIREMENTS.md).

## Résolution : source → affichage

Taille de l’illustration sur l’écran Dragon (scène = 60 % de la hauteur), en pixels physiques. « Rapport » = pixels affichés / pixels de la source : < 1 = réduction (risque de scintillement sans mipmaps), > 1 = agrandissement (flou, résolution insuffisante). Les poses de vol sont mesurées à la taille de vol (×0,8). Avant = canvas plafonné à densité 2 puis agrandi par l’écran ; après = canvas à la densité réelle (max 3).

### Android 1080×2400 (densité 2,625)

| Variante | Stade | Pose | Source (px) | Affiché avant (canvas → écran) | Affiché après | Rapport après | Diagnostic |
|---|---|---|---|---|---|---|---|
| dragon | baby | WINGS_DOWN | 457×191 | 487 → 639 (×1.312) | 639 | 1.40 | **agrandi ×1.40 : résolution insuffisante, flou** |
| dragon | baby | WINGS_UP | 470×221 | 501 → 657 (×1.312) | 657 | 1.40 | **agrandi ×1.40 : résolution insuffisante, flou** |
| dragon | baby | NORMAL | 1236×831 | 545 → 715 (×1.312) | 715 | 0.58 | réduction : mipmaps recommandés |
| dragon | baby | SLEEP | 472×178 | 561 → 736 (×1.312) | 736 | 1.56 | **agrandi ×1.56 : résolution insuffisante, flou** |
| dragon | young | WINGS_DOWN | 574×284 | 490 → 643 (×1.312) | 643 | 1.12 | **agrandi ×1.12 : résolution insuffisante, flou** |
| dragon | young | WINGS_UP | 666×262 | 568 → 746 (×1.312) | 746 | 1.12 | **agrandi ×1.12 : résolution insuffisante, flou** |
| dragon | young | NORMAL | 1239×931 | 618 → 811 (×1.312) | 811 | 0.65 | réduction : mipmaps recommandés |
| dragon | young | SLEEP | 637×232 | 636 → 835 (×1.312) | 835 | 1.31 | **agrandi ×1.31 : résolution insuffisante, flou** |
| dragon | adult | WINGS_DOWN | 1515×806 | 596 → 782 (×1.312) | 782 | 0.52 | forte réduction : mipmaps indispensables |
| dragon | adult | WINGS_MID | 1512×628 | 594 → 780 (×1.312) | 780 | 0.52 | forte réduction : mipmaps indispensables |
| dragon | adult | WINGS_UP | 1513×862 | 595 → 781 (×1.312) | 781 | 0.52 | forte réduction : mipmaps indispensables |
| dragon | adult | NORMAL | 1244×1017 | 668 → 877 (×1.312) | 877 | 0.70 | réduction : mipmaps recommandés |
| dragon | adult | SLEEP | 1522×631 | 744 → 976 (×1.312) | 976 | 0.64 | réduction : mipmaps recommandés |
| dragon | legendary | WINGS_DOWN | 742×329 | 630 → 826 (×1.312) | 826 | 1.11 | **agrandi ×1.11 : résolution insuffisante, flou** |
| dragon | legendary | WINGS_UP | 742×287 | 630 → 826 (×1.312) | 826 | 1.11 | **agrandi ×1.11 : résolution insuffisante, flou** |
| dragon | legendary | NORMAL | 1253×1075 | 684 → 898 (×1.312) | 898 | 0.72 | réduction : mipmaps recommandés |
| dragon | legendary | SLEEP | 760×348 | 705 → 925 (×1.312) | 925 | 1.22 | **agrandi ×1.22 : résolution insuffisante, flou** |
| dragonne | baby | WINGS_DOWN | 532×204 | 541 → 710 (×1.312) | 710 | 1.33 | **agrandi ×1.33 : résolution insuffisante, flou** |
| dragonne | baby | WINGS_UP | 490×221 | 498 → 654 (×1.312) | 654 | 1.33 | **agrandi ×1.33 : résolution insuffisante, flou** |
| dragonne | baby | NORMAL | 1510×978 | 542 → 711 (×1.312) | 711 | 0.47 | forte réduction : mipmaps indispensables |
| dragonne | baby | SLEEP | 457×183 | 558 → 732 (×1.312) | 732 | 1.60 | **agrandi ×1.60 : résolution insuffisante, flou** |
| dragonne | young | WINGS_DOWN | 612×289 | 550 → 723 (×1.312) | 723 | 1.18 | **agrandi ×1.18 : résolution insuffisante, flou** |
| dragonne | young | WINGS_UP | 630×264 | 567 → 744 (×1.312) | 744 | 1.18 | **agrandi ×1.18 : résolution insuffisante, flou** |
| dragonne | young | NORMAL | 1524×1024 | 616 → 808 (×1.312) | 808 | 0.53 | forte réduction : mipmaps indispensables |
| dragonne | young | SLEEP | 611×227 | 634 → 833 (×1.312) | 833 | 1.36 | **agrandi ×1.36 : résolution insuffisante, flou** |
| dragonne | adult | WINGS_DOWN | 698×311 | 571 → 749 (×1.312) | 749 | 1.07 | **agrandi ×1.07 : résolution insuffisante, flou** |
| dragonne | adult | WINGS_UP | 750×284 | 614 → 805 (×1.312) | 805 | 1.07 | **agrandi ×1.07 : résolution insuffisante, flou** |
| dragonne | adult | NORMAL | 1524×1011 | 667 → 875 (×1.312) | 875 | 0.57 | réduction : mipmaps recommandés |
| dragonne | adult | SLEEP | 709×273 | 687 → 902 (×1.312) | 902 | 1.27 | **agrandi ×1.27 : résolution insuffisante, flou** |
| dragonne | legendary | WINGS_DOWN | 734×328 | 629 → 825 (×1.312) | 825 | 1.12 | **agrandi ×1.12 : résolution insuffisante, flou** |
| dragonne | legendary | WINGS_UP | 735×284 | 630 → 826 (×1.312) | 826 | 1.12 | **agrandi ×1.12 : résolution insuffisante, flou** |
| dragonne | legendary | NORMAL | 1536×1022 | 684 → 898 (×1.312) | 898 | 0.58 | réduction : mipmaps recommandés |
| dragonne | legendary | SLEEP | 742×342 | 705 → 925 (×1.312) | 925 | 1.25 | **agrandi ×1.25 : résolution insuffisante, flou** |

### Android 1080×2400 (densité 3)

| Variante | Stade | Pose | Source (px) | Affiché avant (canvas → écran) | Affiché après | Rapport après | Diagnostic |
|---|---|---|---|---|---|---|---|
| dragon | baby | WINGS_DOWN | 457×191 | 426 → 638 (×1.5) | 638 | 1.40 | **agrandi ×1.40 : résolution insuffisante, flou** |
| dragon | baby | WINGS_UP | 470×221 | 438 → 657 (×1.5) | 657 | 1.40 | **agrandi ×1.40 : résolution insuffisante, flou** |
| dragon | baby | NORMAL | 1236×831 | 476 → 714 (×1.5) | 714 | 0.58 | réduction : mipmaps recommandés |
| dragon | baby | SLEEP | 472×178 | 490 → 735 (×1.5) | 735 | 1.56 | **agrandi ×1.56 : résolution insuffisante, flou** |
| dragon | young | WINGS_DOWN | 574×284 | 428 → 642 (×1.5) | 642 | 1.12 | **agrandi ×1.12 : résolution insuffisante, flou** |
| dragon | young | WINGS_UP | 666×262 | 497 → 745 (×1.5) | 745 | 1.12 | **agrandi ×1.12 : résolution insuffisante, flou** |
| dragon | young | NORMAL | 1239×931 | 540 → 810 (×1.5) | 810 | 0.65 | réduction : mipmaps recommandés |
| dragon | young | SLEEP | 637×232 | 556 → 834 (×1.5) | 834 | 1.31 | **agrandi ×1.31 : résolution insuffisante, flou** |
| dragon | adult | WINGS_DOWN | 1515×806 | 520 → 781 (×1.5) | 781 | 0.52 | forte réduction : mipmaps indispensables |
| dragon | adult | WINGS_MID | 1512×628 | 519 → 779 (×1.5) | 779 | 0.52 | forte réduction : mipmaps indispensables |
| dragon | adult | WINGS_UP | 1513×862 | 520 → 780 (×1.5) | 780 | 0.52 | forte réduction : mipmaps indispensables |
| dragon | adult | NORMAL | 1244×1017 | 584 → 876 (×1.5) | 876 | 0.70 | réduction : mipmaps recommandés |
| dragon | adult | SLEEP | 1522×631 | 650 → 975 (×1.5) | 975 | 0.64 | réduction : mipmaps recommandés |
| dragon | legendary | WINGS_DOWN | 742×329 | 550 → 825 (×1.5) | 825 | 1.11 | **agrandi ×1.11 : résolution insuffisante, flou** |
| dragon | legendary | WINGS_UP | 742×287 | 550 → 825 (×1.5) | 825 | 1.11 | **agrandi ×1.11 : résolution insuffisante, flou** |
| dragon | legendary | NORMAL | 1253×1075 | 598 → 897 (×1.5) | 897 | 0.72 | réduction : mipmaps recommandés |
| dragon | legendary | SLEEP | 760×348 | 616 → 924 (×1.5) | 924 | 1.22 | **agrandi ×1.22 : résolution insuffisante, flou** |
| dragonne | baby | WINGS_DOWN | 532×204 | 473 → 709 (×1.5) | 709 | 1.33 | **agrandi ×1.33 : résolution insuffisante, flou** |
| dragonne | baby | WINGS_UP | 490×221 | 435 → 653 (×1.5) | 653 | 1.33 | **agrandi ×1.33 : résolution insuffisante, flou** |
| dragonne | baby | NORMAL | 1510×978 | 473 → 710 (×1.5) | 710 | 0.47 | forte réduction : mipmaps indispensables |
| dragonne | baby | SLEEP | 457×183 | 487 → 731 (×1.5) | 731 | 1.60 | **agrandi ×1.60 : résolution insuffisante, flou** |
| dragonne | young | WINGS_DOWN | 612×289 | 481 → 722 (×1.5) | 722 | 1.18 | **agrandi ×1.18 : résolution insuffisante, flou** |
| dragonne | young | WINGS_UP | 630×264 | 495 → 743 (×1.5) | 743 | 1.18 | **agrandi ×1.18 : résolution insuffisante, flou** |
| dragonne | young | NORMAL | 1524×1024 | 538 → 807 (×1.5) | 807 | 0.53 | forte réduction : mipmaps indispensables |
| dragonne | young | SLEEP | 611×227 | 554 → 832 (×1.5) | 832 | 1.36 | **agrandi ×1.36 : résolution insuffisante, flou** |
| dragonne | adult | WINGS_DOWN | 698×311 | 499 → 748 (×1.5) | 748 | 1.07 | **agrandi ×1.07 : résolution insuffisante, flou** |
| dragonne | adult | WINGS_UP | 750×284 | 536 → 804 (×1.5) | 804 | 1.07 | **agrandi ×1.07 : résolution insuffisante, flou** |
| dragonne | adult | NORMAL | 1524×1011 | 583 → 874 (×1.5) | 874 | 0.57 | réduction : mipmaps recommandés |
| dragonne | adult | SLEEP | 709×273 | 600 → 900 (×1.5) | 900 | 1.27 | **agrandi ×1.27 : résolution insuffisante, flou** |
| dragonne | legendary | WINGS_DOWN | 734×328 | 549 → 824 (×1.5) | 824 | 1.12 | **agrandi ×1.12 : résolution insuffisante, flou** |
| dragonne | legendary | WINGS_UP | 735×284 | 550 → 825 (×1.5) | 825 | 1.12 | **agrandi ×1.12 : résolution insuffisante, flou** |
| dragonne | legendary | NORMAL | 1536×1022 | 598 → 897 (×1.5) | 897 | 0.58 | réduction : mipmaps recommandés |
| dragonne | legendary | SLEEP | 742×342 | 616 → 924 (×1.5) | 924 | 1.25 | **agrandi ×1.25 : résolution insuffisante, flou** |

### Android 1440×3120 (densité 3,5)

| Variante | Stade | Pose | Source (px) | Affiché avant (canvas → écran) | Affiché après | Rapport après | Diagnostic |
|---|---|---|---|---|---|---|---|
| dragon | baby | WINGS_DOWN | 457×191 | 487 → 852 (×1.75) | 852 | 1.86 | **agrandi ×1.86 : résolution insuffisante, flou** |
| dragon | baby | WINGS_UP | 470×221 | 501 → 877 (×1.75) | 877 | 1.86 | **agrandi ×1.86 : résolution insuffisante, flou** |
| dragon | baby | NORMAL | 1236×831 | 545 → 953 (×1.75) | 953 | 0.77 | réduction : mipmaps recommandés |
| dragon | baby | SLEEP | 472×178 | 561 → 981 (×1.75) | 981 | 2.08 | **agrandi ×2.08 : résolution insuffisante, flou** |
| dragon | young | WINGS_DOWN | 574×284 | 490 → 857 (×1.75) | 857 | 1.49 | **agrandi ×1.49 : résolution insuffisante, flou** |
| dragon | young | WINGS_UP | 666×262 | 568 → 995 (×1.75) | 995 | 1.49 | **agrandi ×1.49 : résolution insuffisante, flou** |
| dragon | young | NORMAL | 1239×931 | 618 → 1081 (×1.75) | 1081 | 0.87 | proche du 1:1 |
| dragon | young | SLEEP | 637×232 | 636 → 1114 (×1.75) | 1114 | 1.75 | **agrandi ×1.75 : résolution insuffisante, flou** |
| dragon | adult | WINGS_DOWN | 1515×806 | 596 → 1042 (×1.75) | 1042 | 0.69 | réduction : mipmaps recommandés |
| dragon | adult | WINGS_MID | 1512×628 | 594 → 1040 (×1.75) | 1040 | 0.69 | réduction : mipmaps recommandés |
| dragon | adult | WINGS_UP | 1513×862 | 595 → 1041 (×1.75) | 1041 | 0.69 | réduction : mipmaps recommandés |
| dragon | adult | NORMAL | 1244×1017 | 668 → 1170 (×1.75) | 1170 | 0.94 | proche du 1:1 |
| dragon | adult | SLEEP | 1522×631 | 744 → 1301 (×1.75) | 1301 | 0.85 | proche du 1:1 |
| dragon | legendary | WINGS_DOWN | 742×329 | 630 → 1102 (×1.75) | 1102 | 1.49 | **agrandi ×1.49 : résolution insuffisante, flou** |
| dragon | legendary | WINGS_UP | 742×287 | 630 → 1102 (×1.75) | 1102 | 1.49 | **agrandi ×1.49 : résolution insuffisante, flou** |
| dragon | legendary | NORMAL | 1253×1075 | 684 → 1197 (×1.75) | 1197 | 0.96 | proche du 1:1 |
| dragon | legendary | SLEEP | 760×348 | 705 → 1233 (×1.75) | 1233 | 1.62 | **agrandi ×1.62 : résolution insuffisante, flou** |
| dragonne | baby | WINGS_DOWN | 532×204 | 541 → 947 (×1.75) | 947 | 1.78 | **agrandi ×1.78 : résolution insuffisante, flou** |
| dragonne | baby | WINGS_UP | 490×221 | 498 → 872 (×1.75) | 872 | 1.78 | **agrandi ×1.78 : résolution insuffisante, flou** |
| dragonne | baby | NORMAL | 1510×978 | 542 → 948 (×1.75) | 948 | 0.63 | réduction : mipmaps recommandés |
| dragonne | baby | SLEEP | 457×183 | 558 → 976 (×1.75) | 976 | 2.14 | **agrandi ×2.14 : résolution insuffisante, flou** |
| dragonne | young | WINGS_DOWN | 612×289 | 550 → 963 (×1.75) | 963 | 1.57 | **agrandi ×1.57 : résolution insuffisante, flou** |
| dragonne | young | WINGS_UP | 630×264 | 567 → 992 (×1.75) | 992 | 1.57 | **agrandi ×1.57 : résolution insuffisante, flou** |
| dragonne | young | NORMAL | 1524×1024 | 616 → 1078 (×1.75) | 1078 | 0.71 | réduction : mipmaps recommandés |
| dragonne | young | SLEEP | 611×227 | 634 → 1110 (×1.75) | 1110 | 1.82 | **agrandi ×1.82 : résolution insuffisante, flou** |
| dragonne | adult | WINGS_DOWN | 698×311 | 571 → 999 (×1.75) | 999 | 1.43 | **agrandi ×1.43 : résolution insuffisante, flou** |
| dragonne | adult | WINGS_UP | 750×284 | 614 → 1074 (×1.75) | 1074 | 1.43 | **agrandi ×1.43 : résolution insuffisante, flou** |
| dragonne | adult | NORMAL | 1524×1011 | 667 → 1167 (×1.75) | 1167 | 0.77 | réduction : mipmaps recommandés |
| dragonne | adult | SLEEP | 709×273 | 687 → 1202 (×1.75) | 1202 | 1.70 | **agrandi ×1.70 : résolution insuffisante, flou** |
| dragonne | legendary | WINGS_DOWN | 734×328 | 629 → 1100 (×1.75) | 1100 | 1.50 | **agrandi ×1.50 : résolution insuffisante, flou** |
| dragonne | legendary | WINGS_UP | 735×284 | 630 → 1102 (×1.75) | 1102 | 1.50 | **agrandi ×1.50 : résolution insuffisante, flou** |
| dragonne | legendary | NORMAL | 1536×1022 | 684 → 1197 (×1.75) | 1197 | 0.78 | réduction : mipmaps recommandés |
| dragonne | legendary | SLEEP | 742×342 | 705 → 1233 (×1.75) | 1233 | 1.66 | **agrandi ×1.66 : résolution insuffisante, flou** |

## Équipements (écran de référence 1)

| Objet | Catégorie | Stade | Source | Affiché après | Rapport |
|---|---|---|---|---|---|
| head_light_helmet | head | baby | 584×511 | 286 | 0.49 |
| head_light_helmet | head | young | 584×511 | 245 | 0.42 |
| head_light_helmet | head | adult | 584×511 | 233 | 0.40 |
| head_light_helmet | head | legendary | 584×511 | 247 | 0.42 |
| head_ornate_helmet | head | baby | 607×521 | 286 | 0.47 |
| head_ornate_helmet | head | young | 607×521 | 245 | 0.40 |
| head_ornate_helmet | head | adult | 607×521 | 233 | 0.38 |
| head_ornate_helmet | head | legendary | 607×521 | 247 | 0.41 |
| head_royal_helmet | head | baby | 609×550 | 286 | 0.47 |
| head_royal_helmet | head | young | 609×550 | 245 | 0.40 |
| head_royal_helmet | head | adult | 609×550 | 233 | 0.38 |
| head_royal_helmet | head | legendary | 609×550 | 247 | 0.41 |
| head_draconic_crown | head | adult | 620×607 | 233 | 0.38 |
| head_draconic_crown | head | legendary | 620×607 | 247 | 0.40 |
| neck_simple_collar | neck | baby | 542×566 | 210 | 0.39 |
| neck_simple_collar | neck | young | 542×566 | 180 | 0.33 |
| neck_simple_collar | neck | adult | 542×566 | 171 | 0.32 |
| neck_simple_collar | neck | legendary | 542×566 | 181 | 0.33 |
| neck_ornate_collar | neck | baby | 539×595 | 210 | 0.39 |
| neck_ornate_collar | neck | young | 539×595 | 180 | 0.33 |
| neck_ornate_collar | neck | adult | 539×595 | 171 | 0.32 |
| neck_ornate_collar | neck | legendary | 539×595 | 181 | 0.34 |
| neck_gem_collar | neck | baby | 586×652 | 210 | 0.36 |
| neck_gem_collar | neck | young | 586×652 | 180 | 0.31 |
| neck_gem_collar | neck | adult | 586×652 | 171 | 0.29 |
| neck_gem_collar | neck | legendary | 586×652 | 181 | 0.31 |
| neck_ancestral_collar | neck | baby | 588×685 | 210 | 0.36 |
| neck_ancestral_collar | neck | young | 588×685 | 180 | 0.31 |
| neck_ancestral_collar | neck | adult | 588×685 | 171 | 0.29 |
| neck_ancestral_collar | neck | legendary | 588×685 | 181 | 0.31 |
| body_light_plate | body | baby | 580×537 | 286 | 0.49 |
| body_light_plate | body | young | 580×537 | 245 | 0.42 |
| body_light_plate | body | adult | 580×537 | 233 | 0.40 |
| body_light_plate | body | legendary | 580×537 | 247 | 0.43 |
| body_reinforced_plate | body | baby | 572×559 | 286 | 0.50 |
| body_reinforced_plate | body | young | 572×559 | 245 | 0.43 |
| body_reinforced_plate | body | adult | 572×559 | 233 | 0.41 |
| body_reinforced_plate | body | legendary | 572×559 | 247 | 0.43 |
| body_royal_armor | body | young | 606×633 | 245 | 0.40 |
| body_royal_armor | body | adult | 606×633 | 233 | 0.38 |
| body_royal_armor | body | legendary | 606×633 | 247 | 0.41 |
| body_draconic_armor | body | young | 590×625 | 245 | 0.41 |
| body_draconic_armor | body | adult | 590×625 | 233 | 0.40 |
| body_draconic_armor | body | legendary | 590×625 | 247 | 0.42 |
| legs_simple_guards | legs | baby | 565×595 | 225 | 0.40 |
| legs_simple_guards | legs | young | 565×595 | 193 | 0.34 |
| legs_simple_guards | legs | adult | 565×595 | 183 | 0.32 |
| legs_simple_guards | legs | legendary | 565×595 | 195 | 0.34 |
| legs_metal_claws | legs | baby | 560×583 | 225 | 0.40 |
| legs_metal_claws | legs | young | 560×583 | 193 | 0.34 |
| legs_metal_claws | legs | adult | 560×583 | 183 | 0.33 |
| legs_metal_claws | legs | legendary | 560×583 | 195 | 0.35 |
| legs_runic_claws | legs | baby | 591×615 | 225 | 0.38 |
| legs_runic_claws | legs | young | 591×615 | 193 | 0.33 |
| legs_runic_claws | legs | adult | 591×615 | 183 | 0.31 |
| legs_runic_claws | legs | legendary | 591×615 | 195 | 0.33 |
| legs_golden_claws | legs | baby | 578×632 | 225 | 0.39 |
| legs_golden_claws | legs | young | 578×632 | 193 | 0.33 |
| legs_golden_claws | legs | adult | 578×632 | 183 | 0.32 |
| legs_golden_claws | legs | legendary | 578×632 | 195 | 0.34 |
| wings_guards | wings | baby | 1198×305 | 590 | 0.49 |
| wings_guards | wings | young | 1198×305 | 506 | 0.42 |
| wings_guards | wings | adult | 1198×305 | 479 | 0.40 |
| wings_guards | wings | legendary | 1198×305 | 509 | 0.42 |
| wings_ornate | wings | baby | 1191×296 | 590 | 0.49 |
| wings_ornate | wings | young | 1191×296 | 506 | 0.42 |
| wings_ornate | wings | adult | 1191×296 | 479 | 0.40 |
| wings_ornate | wings | legendary | 1191×296 | 509 | 0.43 |
| wings_armor | wings | young | 1178×273 | 506 | 0.43 |
| wings_armor | wings | adult | 1178×273 | 479 | 0.41 |
| wings_armor | wings | legendary | 1178×273 | 509 | 0.43 |
| wings_divine | wings | young | 1214×353 | 506 | 0.42 |
| wings_divine | wings | adult | 1214×353 | 479 | 0.40 |
| wings_divine | wings | legendary | 1214×353 | 509 | 0.42 |
| tail_rings | tail | baby | 1244×290 | 218 | 0.17 |
| tail_rings | tail | young | 1244×290 | 187 | 0.15 |
| tail_rings | tail | adult | 1244×290 | 177 | 0.14 |
| tail_rings | tail | legendary | 1244×290 | 188 | 0.15 |
| tail_guards | tail | baby | 1246×305 | 218 | 0.17 |
| tail_guards | tail | young | 1246×305 | 187 | 0.15 |
| tail_guards | tail | adult | 1246×305 | 177 | 0.14 |
| tail_guards | tail | legendary | 1246×305 | 188 | 0.15 |
| tail_spikes | tail | young | 1246×309 | 187 | 0.15 |
| tail_spikes | tail | adult | 1246×309 | 177 | 0.14 |
| tail_spikes | tail | legendary | 1246×309 | 188 | 0.15 |
| tail_blade | tail | young | 1239×342 | 187 | 0.15 |
| tail_blade | tail | adult | 1239×342 | 177 | 0.14 |
| tail_blade | tail | legendary | 1239×342 | 188 | 0.15 |
