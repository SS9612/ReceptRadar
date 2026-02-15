import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';

export function IntegritetScreen() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Integritet & App Privacy</Text>
      <Text style={styles.paragraph}>
        ReceptRadar samlar inte in några personuppgifter om dig. Vi sparar ingen e-post, ingen användarstatistik och ingen spårningsdata.
      </Text>
      <Text style={styles.section}>Vad som sparas lokalt</Text>
      <Text style={styles.paragraph}>
        All data sparas endast på din enhet: skafferiet (dina varor), favoritrecept och inställningar. Inget av detta skickas till våra servrar, eftersom vi inte har några servrar för användardata.
      </Text>
      <Text style={styles.section}>Tredjepartstjänster</Text>
      <Text style={styles.paragraph}>
        Appen använder Azure AI Foundry (för AI-genererade recept) och Open Food Facts för streckkodssökning. Dessa tjänster har sina egna integritetsregler. ReceptRadar skickar inte din identitet till dem – endast ingredienser eller streckkoder vid sökning.
      </Text>
      <Text style={styles.paragraph}>
        I version 1 (v1) finns inga spårnings-SDK:er, ingen reklam och ingen analys av användarbeteende.
      </Text>
      <Button
        title="Tillbaka till Inställningar"
        onPress={() => navigation.goBack()}
        variant="secondary"
        style={styles.backButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    lineHeight: 24,
  },
  section: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 12,
  },
  backButton: {
    marginTop: 24,
  },
});
