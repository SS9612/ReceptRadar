import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const TAB_NAMES = {
  Skanna: 'Skanna',
  Skafferi: 'Skafferi',
  Förslag: 'Förslag',
  Favoriter: 'Favoriter',
} as const;

type TabName = (typeof TAB_NAMES)[keyof typeof TAB_NAMES];

type IoniconName = keyof typeof Ionicons.glyphMap;

const QUICK_ACTIONS: Array<{
  tab: TabName;
  title: string;
  description: string;
  icon: IoniconName;
  accent: 'orange' | 'green' | 'blue' | 'purple';
}> = [
  {
    tab: 'Skanna',
    title: 'Skanna varor',
    description: 'Lägg till ingredienser med kameran',
    icon: 'scan-outline',
    accent: 'orange',
  },
  {
    tab: 'Skafferi',
    title: 'Mitt skafferi',
    description: 'Hantera dina varor och ingredienser',
    icon: 'basket-outline',
    accent: 'green',
  },
  {
    tab: 'Förslag',
    title: 'Receptförslag',
    description: 'Få recept baserat på dina ingredienser',
    icon: 'restaurant-outline',
    accent: 'blue',
  },
  {
    tab: 'Favoriter',
    title: 'Favoriter',
    description: 'Dina sparade recept',
    icon: 'heart-outline',
    accent: 'purple',
  },
];

const ACCENT_COLORS = {
  orange: { bg: '#fff5ee', icon: '#c45c26' },
  green: { bg: '#effaf0', icon: '#2d7d46' },
  blue: { bg: '#eff6ff', icon: '#1d6bb5' },
  purple: { bg: '#f5f0ff', icon: '#6b4ea2' },
} as const;

export function HomeScreen() {
  const navigation = useNavigation();
  const parent = navigation.getParent();

  const navigateTo = (tab: TabName) => {
    parent?.navigate(tab as never);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.logo}>ReceptRadar</Text>
        <Text style={styles.tagline}>Din mat, dina recept – hitta inspiration från det du har hemma.</Text>
      </View>

      <Text style={styles.sectionTitle}>Kom igång</Text>
      <View style={styles.actions}>
        {QUICK_ACTIONS.map((action) => {
          const colors = ACCENT_COLORS[action.accent];
          return (
            <Pressable
              key={action.tab}
              onPress={() => navigateTo(action.tab)}
              style={({ pressed }) => [
                styles.actionCard,
                pressed && styles.actionCardPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Gå till ${action.title}`}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: colors.bg }]}>
                <Ionicons name={action.icon} size={28} color={colors.icon} />
              </View>
              <View style={styles.actionBody}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#9ca3af" />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Skanna eller lägg till varor i skafferiet, sedan får du receptförslag som passar.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#f8f6f3',
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  hero: {
    marginBottom: 32,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 17,
    lineHeight: 24,
    color: '#52525b',
    maxWidth: 320,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  actions: {
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    ...(Platform.OS !== 'web'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }
      : { boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }),
  },
  actionCardPressed: {
    opacity: 0.92,
  },
  actionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
    color: '#71717a',
    lineHeight: 20,
  },
  footer: {
    marginTop: 28,
    paddingHorizontal: 4,
  },
  footerText: {
    fontSize: 14,
    color: '#a1a1aa',
    lineHeight: 21,
    textAlign: 'center',
  },
});
