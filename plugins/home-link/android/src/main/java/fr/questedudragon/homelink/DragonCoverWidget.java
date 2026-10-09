package fr.questedudragon.homelink;

/**
 * Le même widget pour l'écran externe des Galaxy Z Flip (Flex Window) : présentation carrée, dragon en grand.
 * À activer sur le téléphone : Réglages > Écran externe > Widgets.
 */
public class DragonCoverWidget extends DragonWidget {
    @Override
    protected Kind fixedKind() { return Kind.COVER; }
}
