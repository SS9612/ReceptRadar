import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, ErrorState, Loader } from '../components';
import { ROUTES } from '../constants/routes';
import * as favoritesService from '../services/favoritesService';
import * as generatedRecipesService from '../services/generatedRecipesService';
import * as pantryService from '../services/pantryService';

export type ReceptdetaljParams = {
  id?: string;
  source?: 'web' | 'generated';
  title?: string;
  sourceUrl?: string;
  image?: string;
};

type ReceptdetaljRouteProp = RouteProp<
  { [ROUTES.Receptdetalj]: ReceptdetaljParams },
  typeof ROUTES.Receptdetalj
>;

export function ReceptdetaljScreen() {
  const route = useRoute<ReceptdetaljRouteProp>();
  const params = route.params ?? {};
  const { id, source, title: paramTitle, sourceUrl: paramSourceUrl, image: paramImage } = params;

  const navigation = useNavigation();
  const isWeb = source === 'web';
  const isGenerated = source === 'generated';
  const isExternal = source != null && source !== 'generated';

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedRecipe, setGeneratedRecipe] = useState<generatedRecipesService.GeneratedRecipe | null>(null);
  const [pantryItems, setPantryItems] = useState<pantryService.PantryItem[]>([]);
  const [isFav, setIsFav] = useState(false);

  const loadRecipe = useCallback(async () => {
    setErrorMessage(null);
    if (isExternal) {
      const provider = source ?? 'web';
      const fav = id ? await favoritesService.getByRecipe(provider, id) : null;
      setIsFav(!!fav);
      setLoading(false);
      return;
    }
    if (isGenerated && id) {
      setLoading(true);
      try {
        const numericId = parseInt(id, 10);
        if (Number.isNaN(numericId)) {
          setGeneratedRecipe(null);
          setLoading(false);
          return;
        }
        const [gen, items, fav] = await Promise.all([
          generatedRecipesService.getById(numericId),
          pantryService.getAll(),
          favoritesService.getByRecipe('generated', id),
        ]);
        setGeneratedRecipe(gen ?? null);
        setPantryItems(items);
        setIsFav(!!fav);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Kunde inte ladda receptet.');
        setGeneratedRecipe(null);
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(false);
  }, [isExternal, isGenerated, source, id]);

  useFocusEffect(
    useCallback(() => {
      loadRecipe();
    }, [loadRecipe])
  );

  const handleFavoriteToggle = useCallback(async () => {
    const provider = isGenerated ? 'generated' : (source ?? 'web');
    const rid = id;
    if (!rid) return;
    if (isFav) {
      await favoritesService.deleteByRecipe(provider, rid);
      setIsFav(false);
    } else {
      const title = isGenerated ? generatedRecipe?.title : paramTitle;
      const image = isGenerated ? (generatedRecipe?.image_path ?? undefined) : paramImage;
      const sourceUrl = paramSourceUrl;
      await favoritesService.create({
        provider,
        recipe_id: rid,
        recipe_data: JSON.stringify({ title, image, sourceUrl }),
      });
      setIsFav(true);
    }
  }, [isExternal, isGenerated, id, generatedRecipe, isFav, paramTitle, paramImage, paramSourceUrl]);

  if (!isExternal && !isGenerated && !id) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Receptdetalj</Text>
        <Text style={styles.subtitle}>Recept kunde inte laddas. Ogiltigt recept-ID.</Text>
      </View>
    );
  }

  if (isExternal && !id) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Receptdetalj</Text>
        <Text style={styles.subtitle}>Recept kunde inte laddas.</Text>
      </View>
    );
  }

  if (isGenerated && !loading && !generatedRecipe && id) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Receptdetalj</Text>
        <Text style={styles.subtitle}>Recept hittades inte.</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <ErrorState
        message={errorMessage}
        onRetry={() => {
          setErrorMessage(null);
          loadRecipe();
        }}
      />
    );
  }

  if (loading) {
    return <Loader visible message="Laddar recept..." />;
  }

  if (isGenerated && generatedRecipe) {
    const imageUri = generatedRecipe.image_path ? (generatedRecipe.image_path.startsWith('file://') ? generatedRecipe.image_path : `file://${generatedRecipe.image_path}`) : null;
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {generatedRecipe.title}
            </Text>
            <Pressable onPress={handleFavoriteToggle} style={styles.favoriteButton} hitSlop={8}>
              <Text style={[styles.favoriteIcon, isFav && styles.favoriteIconFilled]}>
                {isFav ? '♥' : '♡'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.metaRow}>
            {generatedRecipe.ready_in_minutes != null ? (
              <Text style={styles.meta}>Ca {generatedRecipe.ready_in_minutes} min</Text>
            ) : null}
            {generatedRecipe.servings != null ? (
              <Text style={styles.meta}>
                {generatedRecipe.ready_in_minutes != null ? ' · ' : ''}
                {generatedRecipe.servings} portioner
              </Text>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Ingredienser</Text>
          <View style={styles.ingredientList}>
            {generatedRecipe.ingredients.map((ing, index) => (
              <Text key={index} style={styles.ingredientItem}>
                • {ing.amount != null && ing.unit ? `${ing.amount} ${ing.unit} ${ing.name}` : ing.name}
              </Text>
            ))}
          </View>

          {generatedRecipe.steps.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Instruktioner</Text>
              <View style={styles.instructionsList}>
                {generatedRecipe.steps.map((step, index) => (
                  <Text key={index} style={styles.instructionStep}>
                    {step.step_number != null ? step.step_number : index + 1}. {step.instruction}
                  </Text>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  if (isExternal) {
    const externalTitle = paramTitle ?? 'Recept';
    const externalSourceUrl = paramSourceUrl ?? null;
    const openSource = () => {
      if (!externalSourceUrl) return;
      if (isWeb) {
        (navigation as any).navigate(ROUTES.WebSearch, {
          initialUrl: externalSourceUrl,
          ingredientQuery: undefined,
        });
      } else {
        Linking.openURL(externalSourceUrl);
      }
    };
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {paramImage ? (
          <Image
            source={{ uri: paramImage }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.recipeTitle} numberOfLines={2}>
              {externalTitle}
            </Text>
            <Pressable onPress={handleFavoriteToggle} style={styles.favoriteButton} hitSlop={8}>
              <Text style={[styles.favoriteIcon, isFav && styles.favoriteIconFilled]}>
                {isFav ? '♥' : '♡'}
              </Text>
            </Pressable>
          </View>
          {externalSourceUrl ? (
            <Button
              title="Öppna originalkälla"
              onPress={openSource}
              variant="secondary"
              style={styles.sourceButton}
            />
          ) : null}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Receptdetalj</Text>
      <Text style={styles.subtitle}>Recept kunde inte laddas.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#eee',
  },
  body: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  recipeTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
  },
  favoriteButton: {
    padding: 4,
  },
  favoriteIcon: {
    fontSize: 26,
    color: '#999',
  },
  favoriteIconFilled: {
    color: '#c00',
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  disclaimer: {
    fontSize: 12,
    color: '#888',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  meta: {
    fontSize: 15,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  ingredientList: {
    marginBottom: 24,
  },
  ingredientItem: {
    fontSize: 15,
    color: '#333',
    marginBottom: 6,
  },
  missingList: {
    marginBottom: 24,
  },
  missingItem: {
    fontSize: 14,
    color: '#c00',
    marginBottom: 6,
  },
  instructionsList: {
    marginBottom: 24,
  },
  instructionStep: {
    fontSize: 15,
    color: '#333',
    marginBottom: 12,
    lineHeight: 22,
  },
  sourceButton: {
    marginTop: 8,
  },
});
