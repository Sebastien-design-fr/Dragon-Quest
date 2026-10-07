# Matrice des dragons

Générée par `scripts/audit-dragons.py` à partir du dépôt (ne pas modifier à la main).

Variantes trouvées : dragon, dragonne. Stades trouvés : baby, young, adult, legendary. Pas de distinction mâle/femelle en dehors de ces deux variantes (le dragon de l’enfant, la dragonne du parent).

## Couverture des poses

| Variante | Stade | NORMAL | SLEEP | WINGS_UP | WINGS_MID | WINGS_DOWN | Autres | Squelette (os / os souples / maille) | Ancrages | Équipements compatibles |
|---|---|---|---|---|---|---|---|---|---|---|
| dragon | baby | 1236×831 | 1528×735 | 1472×903 | **manquant** | 1512×977 | — | baby.sprite.json (19 / 16 / 26 px) | 13/13 | 22 |
| dragon | young | 1239×931 | 1518×750 | 1468×945 | **manquant** | 1500×957 | — | young.sprite.json (19 / 16 / 26 px) | 13/13 | 28 |
| dragon | adult | 1244×1017 | 1522×631 | 1513×862 | 1512×628 | 1515×806 | — | adult.sprite.json (19 / 16 / 26 px) | 13/13 | 29 |
| dragon | legendary | 1253×1075 | 1522×780 | 1515×977 | **manquant** | 1515×974 | — | legendary.sprite.json (19 / 16 / 26 px) | 13/13 | 29 |
| dragonne | baby | 1510×978 | 1503×869 | 1523×963 | **manquant** | 1516×1005 | — | baby.dragonne.json (19 / 16 / 30 px) | 13/13 | 22 |
| dragonne | young | 1524×1024 | 1520×880 | 1513×942 | **manquant** | 1508×1014 | — | young.dragonne.json (19 / 16 / 30 px) | 13/13 | 28 |
| dragonne | adult | 1524×1011 | 1519×873 | 1504×988 | **manquant** | 1510×987 | — | adult.dragonne.json (19 / 16 / 30 px) | 13/13 | 29 |
| dragonne | legendary | 1536×1022 | 1526×912 | 1516×980 | **manquant** | 1522×1009 | — | legendary.dragonne.json (19 / 16 / 30 px) | 13/13 | 29 |

Assets absents partout : WINGS_MID, yeux fermés, gueule ouverte, ailes séparées du corps (voir DRAGON_ASSET_REQUIREMENTS.md).

## Résolution : source → affichage

Taille de l’illustration sur l’écran Dragon (scène = 60 % de la hauteur), en pixels physiques. « Rapport » = pixels affichés / pixels de la source : < 1 = réduction (risque de scintillement sans mipmaps), > 1 = agrandissement (flou, résolution insuffisante). Les poses de vol sont mesurées à la taille de vol (×0,8). Avant = canvas plafonné à densité 2 puis agrandi par l’écran ; après = canvas à la densité réelle (max 3).

### Android 1080×2400 (densité 2,625)

| Variante | Stade | Pose | Source (px) | Affiché avant (canvas → écran) | Affiché après | Rapport après | Diagnostic |
|---|---|---|---|---|---|---|---|
| dragon | baby | WINGS_DOWN | 1512×977 | 450 → 591 (×1.312) | 591 | 0.39 | forte réduction : mipmaps indispensables |
| dragon | baby | WINGS_UP | 1472×903 | 380 → 499 (×1.312) | 499 | 0.34 | forte réduction : mipmaps indispensables |
| dragon | baby | NORMAL | 1236×831 | 545 → 715 (×1.312) | 715 | 0.58 | réduction : mipmaps recommandés |
| dragon | baby | SLEEP | 1528×735 | 612 → 803 (×1.312) | 803 | 0.53 | forte réduction : mipmaps indispensables |
| dragon | young | WINGS_DOWN | 1500×957 | 686 → 900 (×1.312) | 900 | 0.60 | réduction : mipmaps recommandés |
| dragon | young | WINGS_UP | 1468×945 | 481 → 632 (×1.312) | 632 | 0.43 | forte réduction : mipmaps indispensables |
| dragon | young | NORMAL | 1239×931 | 618 → 811 (×1.312) | 811 | 0.65 | réduction : mipmaps recommandés |
| dragon | young | SLEEP | 1518×750 | 683 → 897 (×1.312) | 897 | 0.59 | réduction : mipmaps recommandés |
| dragon | adult | WINGS_DOWN | 1515×806 | 662 → 869 (×1.312) | 869 | 0.57 | réduction : mipmaps recommandés |
| dragon | adult | WINGS_MID | 1512×628 | 605 → 795 (×1.312) | 795 | 0.53 | forte réduction : mipmaps indispensables |
| dragon | adult | WINGS_UP | 1513×862 | 595 → 781 (×1.312) | 781 | 0.52 | forte réduction : mipmaps indispensables |
| dragon | adult | NORMAL | 1244×1017 | 668 → 877 (×1.312) | 877 | 0.70 | réduction : mipmaps recommandés |
| dragon | adult | SLEEP | 1522×631 | 645 → 846 (×1.312) | 846 | 0.56 | réduction : mipmaps recommandés |
| dragon | legendary | WINGS_DOWN | 1515×974 | 495 → 649 (×1.312) | 649 | 0.43 | forte réduction : mipmaps indispensables |
| dragon | legendary | WINGS_UP | 1515×977 | 595 → 781 (×1.312) | 781 | 0.52 | forte réduction : mipmaps indispensables |
| dragon | legendary | NORMAL | 1253×1075 | 684 → 898 (×1.312) | 898 | 0.72 | réduction : mipmaps recommandés |
| dragon | legendary | SLEEP | 1522×780 | 744 → 976 (×1.312) | 976 | 0.64 | réduction : mipmaps recommandés |
| dragonne | baby | WINGS_DOWN | 1516×1005 | 463 → 608 (×1.312) | 608 | 0.40 | forte réduction : mipmaps indispensables |
| dragonne | baby | WINGS_UP | 1523×963 | 461 → 606 (×1.312) | 606 | 0.40 | forte réduction : mipmaps indispensables |
| dragonne | baby | NORMAL | 1510×978 | 542 → 711 (×1.312) | 711 | 0.47 | forte réduction : mipmaps indispensables |
| dragonne | baby | SLEEP | 1503×869 | 571 → 750 (×1.312) | 750 | 0.50 | forte réduction : mipmaps indispensables |
| dragonne | young | WINGS_DOWN | 1508×1014 | 599 → 786 (×1.312) | 786 | 0.52 | forte réduction : mipmaps indispensables |
| dragonne | young | WINGS_UP | 1513×942 | 540 → 709 (×1.312) | 709 | 0.47 | forte réduction : mipmaps indispensables |
| dragonne | young | NORMAL | 1524×1024 | 616 → 808 (×1.312) | 808 | 0.53 | forte réduction : mipmaps indispensables |
| dragonne | young | SLEEP | 1520×880 | 530 → 696 (×1.312) | 696 | 0.46 | forte réduction : mipmaps indispensables |
| dragonne | adult | WINGS_DOWN | 1510×987 | 533 → 700 (×1.312) | 700 | 0.46 | forte réduction : mipmaps indispensables |
| dragonne | adult | WINGS_UP | 1504×988 | 532 → 698 (×1.312) | 698 | 0.46 | forte réduction : mipmaps indispensables |
| dragonne | adult | NORMAL | 1524×1011 | 667 → 875 (×1.312) | 875 | 0.57 | réduction : mipmaps recommandés |
| dragonne | adult | SLEEP | 1519×873 | 677 → 889 (×1.312) | 889 | 0.58 | réduction : mipmaps recommandés |
| dragonne | legendary | WINGS_DOWN | 1522×1009 | 492 → 645 (×1.312) | 645 | 0.42 | forte réduction : mipmaps indispensables |
| dragonne | legendary | WINGS_UP | 1516×980 | 595 → 781 (×1.312) | 781 | 0.52 | forte réduction : mipmaps indispensables |
| dragonne | legendary | NORMAL | 1536×1022 | 684 → 898 (×1.312) | 898 | 0.58 | réduction : mipmaps recommandés |
| dragonne | legendary | SLEEP | 1526×912 | 702 → 921 (×1.312) | 921 | 0.60 | réduction : mipmaps recommandés |

### Android 1080×2400 (densité 3)

| Variante | Stade | Pose | Source (px) | Affiché avant (canvas → écran) | Affiché après | Rapport après | Diagnostic |
|---|---|---|---|---|---|---|---|
| dragon | baby | WINGS_DOWN | 1512×977 | 393 → 590 (×1.5) | 590 | 0.39 | forte réduction : mipmaps indispensables |
| dragon | baby | WINGS_UP | 1472×903 | 332 → 498 (×1.5) | 498 | 0.34 | forte réduction : mipmaps indispensables |
| dragon | baby | NORMAL | 1236×831 | 476 → 714 (×1.5) | 714 | 0.58 | réduction : mipmaps recommandés |
| dragon | baby | SLEEP | 1528×735 | 534 → 802 (×1.5) | 802 | 0.53 | forte réduction : mipmaps indispensables |
| dragon | young | WINGS_DOWN | 1500×957 | 599 → 899 (×1.5) | 899 | 0.60 | réduction : mipmaps recommandés |
| dragon | young | WINGS_UP | 1468×945 | 421 → 631 (×1.5) | 631 | 0.43 | forte réduction : mipmaps indispensables |
| dragon | young | NORMAL | 1239×931 | 540 → 810 (×1.5) | 810 | 0.65 | réduction : mipmaps recommandés |
| dragon | young | SLEEP | 1518×750 | 597 → 895 (×1.5) | 895 | 0.59 | réduction : mipmaps recommandés |
| dragon | adult | WINGS_DOWN | 1515×806 | 579 → 868 (×1.5) | 868 | 0.57 | réduction : mipmaps recommandés |
| dragon | adult | WINGS_MID | 1512×628 | 529 → 794 (×1.5) | 794 | 0.53 | forte réduction : mipmaps indispensables |
| dragon | adult | WINGS_UP | 1513×862 | 520 → 780 (×1.5) | 780 | 0.52 | forte réduction : mipmaps indispensables |
| dragon | adult | NORMAL | 1244×1017 | 584 → 876 (×1.5) | 876 | 0.70 | réduction : mipmaps recommandés |
| dragon | adult | SLEEP | 1522×631 | 563 → 845 (×1.5) | 845 | 0.56 | réduction : mipmaps recommandés |
| dragon | legendary | WINGS_DOWN | 1515×974 | 432 → 648 (×1.5) | 648 | 0.43 | forte réduction : mipmaps indispensables |
| dragon | legendary | WINGS_UP | 1515×977 | 520 → 780 (×1.5) | 780 | 0.52 | forte réduction : mipmaps indispensables |
| dragon | legendary | NORMAL | 1253×1075 | 598 → 897 (×1.5) | 897 | 0.72 | réduction : mipmaps recommandés |
| dragon | legendary | SLEEP | 1522×780 | 650 → 975 (×1.5) | 975 | 0.64 | réduction : mipmaps recommandés |
| dragonne | baby | WINGS_DOWN | 1516×1005 | 405 → 607 (×1.5) | 607 | 0.40 | forte réduction : mipmaps indispensables |
| dragonne | baby | WINGS_UP | 1523×963 | 403 → 605 (×1.5) | 605 | 0.40 | forte réduction : mipmaps indispensables |
| dragonne | baby | NORMAL | 1510×978 | 473 → 710 (×1.5) | 710 | 0.47 | forte réduction : mipmaps indispensables |
| dragonne | baby | SLEEP | 1503×869 | 499 → 749 (×1.5) | 749 | 0.50 | forte réduction : mipmaps indispensables |
| dragonne | young | WINGS_DOWN | 1508×1014 | 523 → 785 (×1.5) | 785 | 0.52 | forte réduction : mipmaps indispensables |
| dragonne | young | WINGS_UP | 1513×942 | 472 → 708 (×1.5) | 708 | 0.47 | forte réduction : mipmaps indispensables |
| dragonne | young | NORMAL | 1524×1024 | 538 → 807 (×1.5) | 807 | 0.53 | forte réduction : mipmaps indispensables |
| dragonne | young | SLEEP | 1520×880 | 463 → 695 (×1.5) | 695 | 0.46 | forte réduction : mipmaps indispensables |
| dragonne | adult | WINGS_DOWN | 1510×987 | 466 → 699 (×1.5) | 699 | 0.46 | forte réduction : mipmaps indispensables |
| dragonne | adult | WINGS_UP | 1504×988 | 465 → 697 (×1.5) | 697 | 0.46 | forte réduction : mipmaps indispensables |
| dragonne | adult | NORMAL | 1524×1011 | 583 → 874 (×1.5) | 874 | 0.57 | réduction : mipmaps recommandés |
| dragonne | adult | SLEEP | 1519×873 | 592 → 888 (×1.5) | 888 | 0.58 | réduction : mipmaps recommandés |
| dragonne | legendary | WINGS_DOWN | 1522×1009 | 430 → 644 (×1.5) | 644 | 0.42 | forte réduction : mipmaps indispensables |
| dragonne | legendary | WINGS_UP | 1516×980 | 520 → 780 (×1.5) | 780 | 0.51 | forte réduction : mipmaps indispensables |
| dragonne | legendary | NORMAL | 1536×1022 | 598 → 897 (×1.5) | 897 | 0.58 | réduction : mipmaps recommandés |
| dragonne | legendary | SLEEP | 1526×912 | 613 → 920 (×1.5) | 920 | 0.60 | réduction : mipmaps recommandés |

### Android 1440×3120 (densité 3,5)

| Variante | Stade | Pose | Source (px) | Affiché avant (canvas → écran) | Affiché après | Rapport après | Diagnostic |
|---|---|---|---|---|---|---|---|
| dragon | baby | WINGS_DOWN | 1512×977 | 450 → 787 (×1.75) | 787 | 0.52 | forte réduction : mipmaps indispensables |
| dragon | baby | WINGS_UP | 1472×903 | 380 → 665 (×1.75) | 665 | 0.45 | forte réduction : mipmaps indispensables |
| dragon | baby | NORMAL | 1236×831 | 545 → 953 (×1.75) | 953 | 0.77 | réduction : mipmaps recommandés |
| dragon | baby | SLEEP | 1528×735 | 612 → 1070 (×1.75) | 1070 | 0.70 | réduction : mipmaps recommandés |
| dragon | young | WINGS_DOWN | 1500×957 | 686 → 1200 (×1.75) | 1200 | 0.80 | réduction : mipmaps recommandés |
| dragon | young | WINGS_UP | 1468×945 | 481 → 843 (×1.75) | 843 | 0.57 | réduction : mipmaps recommandés |
| dragon | young | NORMAL | 1239×931 | 618 → 1081 (×1.75) | 1081 | 0.87 | proche du 1:1 |
| dragon | young | SLEEP | 1518×750 | 683 → 1195 (×1.75) | 1195 | 0.79 | réduction : mipmaps recommandés |
| dragon | adult | WINGS_DOWN | 1515×806 | 662 → 1159 (×1.75) | 1159 | 0.77 | réduction : mipmaps recommandés |
| dragon | adult | WINGS_MID | 1512×628 | 605 → 1060 (×1.75) | 1060 | 0.70 | réduction : mipmaps recommandés |
| dragon | adult | WINGS_UP | 1513×862 | 595 → 1041 (×1.75) | 1041 | 0.69 | réduction : mipmaps recommandés |
| dragon | adult | NORMAL | 1244×1017 | 668 → 1170 (×1.75) | 1170 | 0.94 | proche du 1:1 |
| dragon | adult | SLEEP | 1522×631 | 645 → 1128 (×1.75) | 1128 | 0.74 | réduction : mipmaps recommandés |
| dragon | legendary | WINGS_DOWN | 1515×974 | 495 → 866 (×1.75) | 866 | 0.57 | réduction : mipmaps recommandés |
| dragon | legendary | WINGS_UP | 1515×977 | 595 → 1041 (×1.75) | 1041 | 0.69 | réduction : mipmaps recommandés |
| dragon | legendary | NORMAL | 1253×1075 | 684 → 1197 (×1.75) | 1197 | 0.96 | proche du 1:1 |
| dragon | legendary | SLEEP | 1522×780 | 744 → 1301 (×1.75) | 1301 | 0.85 | proche du 1:1 |
| dragonne | baby | WINGS_DOWN | 1516×1005 | 463 → 811 (×1.75) | 811 | 0.54 | forte réduction : mipmaps indispensables |
| dragonne | baby | WINGS_UP | 1523×963 | 461 → 808 (×1.75) | 808 | 0.53 | forte réduction : mipmaps indispensables |
| dragonne | baby | NORMAL | 1510×978 | 542 → 948 (×1.75) | 948 | 0.63 | réduction : mipmaps recommandés |
| dragonne | baby | SLEEP | 1503×869 | 571 → 1000 (×1.75) | 1000 | 0.67 | réduction : mipmaps recommandés |
| dragonne | young | WINGS_DOWN | 1508×1014 | 599 → 1048 (×1.75) | 1048 | 0.69 | réduction : mipmaps recommandés |
| dragonne | young | WINGS_UP | 1513×942 | 540 → 945 (×1.75) | 945 | 0.62 | réduction : mipmaps recommandés |
| dragonne | young | NORMAL | 1524×1024 | 616 → 1078 (×1.75) | 1078 | 0.71 | réduction : mipmaps recommandés |
| dragonne | young | SLEEP | 1520×880 | 530 → 928 (×1.75) | 928 | 0.61 | réduction : mipmaps recommandés |
| dragonne | adult | WINGS_DOWN | 1510×987 | 533 → 933 (×1.75) | 933 | 0.62 | réduction : mipmaps recommandés |
| dragonne | adult | WINGS_UP | 1504×988 | 532 → 931 (×1.75) | 931 | 0.62 | réduction : mipmaps recommandés |
| dragonne | adult | NORMAL | 1524×1011 | 667 → 1167 (×1.75) | 1167 | 0.77 | réduction : mipmaps recommandés |
| dragonne | adult | SLEEP | 1519×873 | 677 → 1185 (×1.75) | 1185 | 0.78 | réduction : mipmaps recommandés |
| dragonne | legendary | WINGS_DOWN | 1522×1009 | 492 → 860 (×1.75) | 860 | 0.56 | réduction : mipmaps recommandés |
| dragonne | legendary | WINGS_UP | 1516×980 | 595 → 1041 (×1.75) | 1041 | 0.69 | réduction : mipmaps recommandés |
| dragonne | legendary | NORMAL | 1536×1022 | 684 → 1197 (×1.75) | 1197 | 0.78 | réduction : mipmaps recommandés |
| dragonne | legendary | SLEEP | 1526×912 | 702 → 1228 (×1.75) | 1228 | 0.81 | réduction : mipmaps recommandés |

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
