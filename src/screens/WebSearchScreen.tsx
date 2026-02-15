import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ROUTES } from '../constants/routes';
import type { WebSearchParamList } from '../constants/routes';
import * as savedWebRecipesService from '../services/savedWebRecipesService';
import { Button } from '../components';

type Nav = NativeStackNavigationProp<{ [ROUTES.WebSearch]: WebSearchParamList }>;
type WebSearchRoute = RouteProp<{ [ROUTES.WebSearch]: WebSearchParamList }, typeof ROUTES.WebSearch>;

export function WebSearchScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<WebSearchRoute>();
  const { initialUrl, ingredientQuery } = route.params;
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);

  const handleNavigationStateChange = useCallback((state: { url?: string; title?: string }) => {
    if (state.url) setCurrentUrl(state.url);
    if (state.title) setCurrentTitle(state.title);
  }, []);

  const handleSaveRecipe = useCallback(async () => {
    const url = (currentUrl || '').trim();
    if (!url) {
      Alert.alert('Kunde inte spara', 'Ingen sida att spara.');
      return;
    }
    const title = (currentTitle || '').trim() || undefined;
    try {
      await savedWebRecipesService.save({
        title: title || null,
        source_url: url,
        image_url: null,
        ingredient_query: ingredientQuery ?? null,
      });
      Alert.alert('Sparat!', 'Receptet har lagts till i dina förslag.');
      navigation.goBack();
    } catch {
      Alert.alert('Fel', 'Kunde inte spara receptet.');
    }
  }, [currentUrl, currentTitle, ingredientQuery, navigation]);

  if (Platform.OS === 'web') {
    const openInNewTab = () => {
      if (typeof window !== 'undefined' && window.open) {
        window.open(initialUrl, '_blank', 'noopener,noreferrer');
      } else {
        Linking.openURL(initialUrl);
      }
    };
    return (
      <View style={styles.container}>
        <View style={[styles.toolbar, styles.webFallbackBody]}>
          <Text style={styles.webFallbackText}>
            WebView stöds inte i webbläsaren. Öppna sökningen i en ny flik.
          </Text>
          <Button title="Öppna sökning i ny flik" onPress={openInNewTab} style={styles.webFallbackButton} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveRecipe}>
          <Text style={styles.saveButtonText}>Spara recept</Text>
        </TouchableOpacity>
      </View>
      <WebView
        source={{ uri: initialUrl }}
        onNavigationStateChange={handleNavigationStateChange}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webFallbackBody: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webFallbackText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  webFallbackButton: {
    minWidth: 200,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
  },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  webview: { flex: 1 },
});
