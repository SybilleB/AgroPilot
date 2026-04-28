/**
 * app/(app)/rentabilite.tsx — Simulation de rentabilité
 *
 * Responsables : Sybille & Florian
 *
 * À implémenter :
 *  1. Formulaire : culture, surface, prix de vente, rendement estimé,
 *     charges fixes/variables par hectare.
 *  2. Appel FastAPI : POST /rentabilite/simulate (voir constants/Api.ts)
 *  3. Affichage des résultats : marge brute, marge nette, seuil de rentabilité.
 *
 * Types    : SimulationRentabilite dans @/types/index.ts
 * Route API: API_ROUTES.rentabilite.simulate dans @/constants/Api.ts
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/layout';

// ─── Carte de fonctionnalité à venir ─────────────────────────────────────────

function ComingSoonCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <View style={s.comingCard}>
      <View style={s.comingIconBox}>
        <Text style={s.comingIcon}>{icon}</Text>
      </View>
      <Text style={s.comingTitle}>{title}</Text>
      <Text style={s.comingDesc}>{desc}</Text>
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function RentabiliteScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 24 }]}>
        <Text style={s.headerTitle}>Simulation de rentabilité</Text>
        <Text style={s.headerSub}>
          Calculez votre marge nette par hectare avant de semer
        </Text>

        {/* Indicateur "En développement" */}
        <View style={s.devBadge}>
          <View style={s.devDot} />
          <Text style={s.devBadgeText}>En développement</Text>
        </View>
      </View>

      {/* ─── BLOC PRINCIPAL ──────────────────────────────────────────────── */}
      <View style={s.mainBlock}>
        <View style={s.aiCard}>
          <Text style={s.aiLabel}>FONCTIONNALITÉ À VENIR</Text>
          <Text style={s.aiTitle}>Votre simulateur de marges agricoles</Text>
          <Text style={s.aiBody}>
            Entrez votre culture, la surface, le rendement estimé et vos charges — AgroPilot calculera votre seuil de rentabilité et votre marge nette par hectare en temps réel.
          </Text>
        </View>
      </View>

      {/* ─── CE QUI EST PRÉVU ────────────────────────────────────────────── */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>CE QUI SERA DISPONIBLE</Text>

        <ComingSoonCard
          icon="🌾"
          title="Simulation par culture"
          desc="Blé, maïs, colza, betterave — entrez vos données réelles ou utilisez les moyennes régionales."
        />
        <ComingSoonCard
          icon="📉"
          title="Seuil de rentabilité"
          desc="Calculez le prix minimum de vente pour couvrir vos charges et dégager une marge positive."
        />
        <ComingSoonCard
          icon="📊"
          title="Comparaison de scénarios"
          desc="Comparez jusqu'à 3 cultures côte à côte pour choisir l'assolement le plus rentable."
        />
        <ComingSoonCard
          icon="📅"
          title="Historique des simulations"
          desc="Retrouvez vos calculs passés et suivez l'évolution de vos marges d'une campagne à l'autre."
        />
      </View>

      {/* ─── NOTE DÉVELOPPEURS ───────────────────────────────────────────── */}
      <View style={s.devNote}>
        <Text style={s.devNoteLabel}>NOTE DÉVELOPPEURS</Text>
        <Text style={s.devNoteText}>
          Types : <Text style={s.devNoteCode}>SimulationRentabilite</Text> dans @/types/index.ts{'\n'}
          Route API : <Text style={s.devNoteCode}>API_ROUTES.rentabilite.simulate</Text> dans @/constants/Api.ts{'\n'}
          Responsables : Sybille & Florian
        </Text>
      </View>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: 0 },

  // Header
  header: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 22,
    paddingBottom: 36,
    borderBottomLeftRadius: Layout.headerRadius,
    borderBottomRightRadius: Layout.headerRadius,
    gap: 10,
    marginBottom: 24,
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 13, color: Colors.headerTextMuted, lineHeight: 20 },
  devBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  devDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.warning },
  devBadgeText: { fontSize: 12, color: Colors.warning, fontWeight: '600' },

  // Main block
  mainBlock: { paddingHorizontal: 22, marginBottom: 24 },

  // AI card
  aiCard: {
    backgroundColor: Colors.aiCardBg,
    borderRadius: Layout.cardRadius,
    borderLeftWidth: 4,
    borderLeftColor: Colors.aiCardBorder,
    padding: 20,
    gap: 8,
  },
  aiLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  aiTitle: { fontSize: 18, fontWeight: '800', color: Colors.primaryDark },
  aiBody: { fontSize: 14, color: Colors.textMuted, lineHeight: 21 },

  // Section
  section: { paddingHorizontal: 22, gap: 12, marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },

  // Coming soon cards
  comingCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.cardRadius,
    padding: 18,
    gap: 7,
    ...Layout.softShadow,
  },
  comingIconBox: { width: 42, height: 42, borderRadius: Layout.inputRadius, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  comingIcon: { fontSize: 20 },
  comingTitle: { fontSize: 15, fontWeight: '700', color: Colors.primaryDark },
  comingDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },

  // Dev note
  devNote: {
    marginHorizontal: 22,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Layout.cardRadius,
    padding: 16,
    gap: 8,
  },
  devNoteLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5 },
  devNoteText: { fontSize: 12, color: Colors.textMuted, lineHeight: 19 },
  devNoteCode: { fontFamily: 'monospace', color: Colors.primaryDark, fontWeight: '600' },
});
