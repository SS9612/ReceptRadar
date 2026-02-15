import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ROUTES } from '../constants/routes';
import type { InställningarStackParamList } from '../navigation/types';
import { isLlmRecipeAvailable } from '../services/llmRecipeService';
import * as settingsService from '../services/settingsService';

export function InställningarScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<InställningarStackParamList>>();
  const [includeImage, setIncludeImage] = useState(true);

  useEffect(() => {
    settingsService.get('llm_include_image').then((v) => {
      setIncludeImage(v !== 'false');
    });
  }, []);

  const onIncludeImageChange = useCallback(async (value: boolean) => {
    setIncludeImage(value);
    await settingsService.set('llm_include_image', value ? 'true' : 'false');
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inställningar</Text>
      {isLlmRecipeAvailable() ? (
        <View style={styles.row}>
          <View style={styles.switchRow}>
            <Text style={styles.rowTitle}>Generera bild med AI</Text>
            <Switch
              value={includeImage}
              onValueChange={onIncludeImageChange}
            />
          </View>
          <Text style={styles.rowHint}>När du genererar recept kan appen skapa en bild (kostar mer API-användning)</Text>
        </View>
      ) : null}
      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate(ROUTES.Support)}
      >
        <Text style={styles.rowTitle}>Support & kontakt</Text>
        <Text style={styles.rowHint}>Frågor, e‑post, vanliga frågor</Text>
      </Pressable>
      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate(ROUTES.Integritet)}
      >
        <Text style={styles.rowTitle}>Integritet & App Privacy</Text>
        <Text style={styles.rowHint}>Vi samlar inte in några personuppgifter</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  rowHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});
