import { Colors } from '@/constants/Colors';

export const Layout = {
    pageBackground: Colors.background,
    pageHorizontalPadding: 22,
    headerHorizontalPadding: 22,
    headerBottomPadding: 34,
    headerRadius: 24,
    sectionGap: 14,
    cardRadius: 16,
    cardPadding: 18,
    cardShadow: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
    softShadow: {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    buttonRadius: 14,
    inputRadius: 12,
} as const;