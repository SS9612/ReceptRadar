import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Card, ErrorState, RecipeCardSkeleton } from '../components';
import { ROUTES } from '../constants/routes';
import * as favoritesService from '../services/favoritesService';
import * as generatedRecipesService from '../services/generatedRecipesService';
import * as pantryService from '../services/pantryService';
import * as savedWebRecipesService from '../services/savedWebRecipesService';
import { type RecipeFilters } from '../services/recipeService';
import {
  findRecipesWithFallback,
  getRecipesFromCacheOnly,
  type RecipeWithSource,
} from '../services/recipeService';
import { generateRecipe, isLlmRecipeAvailable } from '../services/llmRecipeService';
import type { ReceptdetaljParams } from './ReceptdetaljScreen';
import * as settingsService from '../services/settingsService';
import { computeRecipeMatch, type RecipeMatchResult } from '../utils/recipeMatch';
import { normalizeProductName } from '../utils/normalizeProductName';
import { translateIngredientName } from '../utils/translateIngredient';

type RecipeWithMatch = { item: RecipeWithSource; match: RecipeMatchResult };

function buildPantryNormalizedNames(
  items: pantryService.PantryItem[]
): Set<string> {
  const set = new Set<string>();
  for (const item of items) {
    const name =
      item.normalized_name ||
      normalizeProductName(item.name).normalizedName ||
      '';
    const key = name.trim().toLowerCase();
    if (key) set.add(key);
  }
  return set;
}

type FörslagStackParamList = {
  [ROUTES.FörslagList]: undefined;
  [ROUTES.Receptdetalj]: ReceptdetaljParams;
  [ROUTES.WebSearch]: { initialUrl: string; ingredientQuery?: string };
};

const MAX_MISSING_DISPLAY = 5;

export function FörslagScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FörslagStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recipesWithMatch, setRecipesWithMatch] = useState<RecipeWithMatch[]>([]);
  const [filters, setFilters] = useState<RecipeFilters>({});
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(new Set());
  const [fromCache, setFromCache] = useState(false);
  const [generatingRecipe, setGeneratingRecipe] = useState(false);
  const [deleteHoverKey, setDeleteHoverKey] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    const list = await favoritesService.getAll();
    const set = new Set(list.map((f) => `${f.provider}|${f.recipe_id}`));
    setFavoriteSet(set);
  }, []);

  const loadRecipes = useCallback(
    async (filtersOverride?: RecipeFilters): Promise<number> => {
      const f = filtersOverride ?? filters;
      setErrorMessage(null);
      setFromCache(false);
      setLoading(true);
      const timeoutId = setTimeout(() => setLoading(false), 25000);
      try {
        const items = await pantryService.getAll();
        const ingredients = pantryService.buildIngredientsFromPantry(items);
        // On web, skip NetInfo.fetch() — it pings localhost:8081 and fails in the browser, causing errors and flicker.
        const isConnected =
          Platform.OS === 'web'
            ? true
            : ((await NetInfo.fetch()).isConnected ?? false);

        let listWithSource: RecipeWithSource[];
        if (!isConnected) {
          const { list, fromCache: cached } = await getRecipesFromCacheOnly(ingredients, f);
          listWithSource = list;
          setFromCache(cached);
          if (list.length === 0) {
            setErrorMessage('Ingen anslutning. Lägg till varor i skafferiet och anslut till nätverket för att ladda recept.');
          }
        } else {
          listWithSource = await findRecipesWithFallback(ingredients, f);
        }

        const pantrySet = buildPantryNormalizedNames(items);
        const withMatch: RecipeWithMatch[] = listWithSource.map((item) => ({
          item,
          match: computeRecipeMatch(item.recipe, pantrySet),
        }));
        withMatch.sort((a, b) => {
          const scoreA =
            a.match.total > 0 ? a.match.have / a.match.total : 0;
          const scoreB =
            b.match.total > 0 ? b.match.have / b.match.total : 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          const timeA = a.item.recipe.readyInMinutes ?? Infinity;
          const timeB = b.item.recipe.readyInMinutes ?? Infinity;
          return timeA - timeB;
        });
        setRecipesWithMatch(withMatch);
        await settingsService.set('recipe_filters', JSON.stringify(f));
        return withMatch.length;
      } catch (err) {
        if (err instanceof Error) {
          setErrorMessage(err.message || 'Kunde inte ladda receptförslag.');
        } else {
          setErrorMessage('Kunde inte ladda receptförslag.');
        }
        return 0;
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    },
    [filters]
  );

  const loadRecipesRef = useRef(loadRecipes);
  loadRecipesRef.current = loadRecipes;

  const handleGetNewSuggestions = useCallback(async () => {
    const items = await pantryService.getAll();
    const ingredients = pantryService.buildIngredientsFromPantry(items);
    if (ingredients.length === 0) return;
    setGeneratingRecipe(true);
    setErrorMessage(null);
    try {
      const favorites = await favoritesService.getAll();
      const favoritedGeneratedIds = new Set(
        favorites
          .filter((f) => f.provider === 'generated')
          .map((f) => parseInt(f.recipe_id, 10))
          .filter((n) => !Number.isNaN(n))
      );
      const existingForKey = await generatedRecipesService.getAllForIngredients(ingredients);
      const keepIds = existingForKey.map((r) => r.id).filter((id) => favoritedGeneratedIds.has(id));
      await generatedRecipesService.deleteAllForIngredientsExcept(ingredients, keepIds);
      const includeImage = await settingsService.get('llm_include_image').then((v) => v !== 'false');
      await generateRecipe(ingredients, { includeImage, skipCache: true });
      await loadRecipesRef.current();
      loadFavorites();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Kunde inte generera recept.');
    } finally {
      setGeneratingRecipe(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    const items = await pantryService.getAll();
    const ingredients = pantryService.buildIngredientsFromPantry(items);
    if (isLlmRecipeAvailable() && ingredients.length > 0) {
      setGeneratingRecipe(true);
      setErrorMessage(null);
      try {
        const favorites = await favoritesService.getAll();
        const favoritedGeneratedIds = new Set(
          favorites
            .filter((f) => f.provider === 'generated')
            .map((f) => parseInt(f.recipe_id, 10))
            .filter((n) => !Number.isNaN(n))
        );
        const existingForKey = await generatedRecipesService.getAllForIngredients(ingredients);
        const keepIds = existingForKey.map((r) => r.id).filter((id) => favoritedGeneratedIds.has(id));
        await generatedRecipesService.deleteAllForIngredientsExcept(ingredients, keepIds);
        const includeImage = await settingsService.get('llm_include_image').then((v) => v !== 'false');
        await generateRecipe(ingredients, { includeImage, skipCache: true });
        await loadRecipesRef.current();
        loadFavorites();
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Kunde inte generera recept.');
      } finally {
        setGeneratingRecipe(false);
      }
    } else {
      await loadRecipesRef.current();
      loadFavorites();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const saved = await settingsService.get('recipe_filters');
        if (cancelled) return;
        let count: number;
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as RecipeFilters;
            setFilters(parsed);
            count = await loadRecipesRef.current(parsed);
          } catch {
            count = await loadRecipesRef.current();
          }
        } else {
          count = await loadRecipesRef.current();
        }
        if (!cancelled) loadFavorites();

        if (cancelled) return;
        if (count === 0 && isLlmRecipeAvailable()) {
          const items = await pantryService.getAll();
          const ingredients = pantryService.buildIngredientsFromPantry(items);
          if (ingredients.length > 0) {
            setGeneratingRecipe(true);
            setErrorMessage(null);
            try {
              const includeImage = await settingsService.get('llm_include_image').then((v) => v !== 'false');
              await generateRecipe(ingredients, { includeImage, skipCache: true });
              if (!cancelled) await loadRecipesRef.current();
              if (!cancelled) loadFavorites();
            } catch (err) {
              if (!cancelled) {
                setErrorMessage(err instanceof Error ? err.message : 'Kunde inte generera recept.');
              }
            } finally {
              if (!cancelled) setGeneratingRecipe(false);
            }
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [loadFavorites])
  );

  if (errorMessage) {
    return (
      <ErrorState
        message={errorMessage}
        onRetry={() => {
          setErrorMessage(null);
          loadRecipes();
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Receptförslag</Text>
      <Text style={styles.subtitle}>Hitta recept baserat på dina ingredienser.</Text>
      {fromCache ? (
        <View style={styles.cacheBanner}>
          <Text style={styles.cacheBannerText}>Du ser cachade recept (offline).</Text>
        </View>
      ) : null}

      {isLlmRecipeAvailable() && recipesWithMatch.length > 0 ? (
        <Pressable
          onPress={handleGetNewSuggestions}
          disabled={generatingRecipe}
          style={({ pressed }) => [
            styles.newSuggestionsButton,
            (pressed || generatingRecipe) && styles.newSuggestionsButtonDisabled,
          ]}
        >
          <Text style={styles.newSuggestionsButtonText}>
            {generatingRecipe ? 'Genererar…' : 'Få nya förslag'}
          </Text>
        </Pressable>
      ) : null}

      {(loading || generatingRecipe) && recipesWithMatch.length === 0 ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <RecipeCardSkeleton key={i} />
          ))}
        </ScrollView>
      ) : recipesWithMatch.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Inga recept hittades för dina ingredienser.</Text>
          <Text style={styles.emptyHint}>Lägg till fler varor i skafferiet och försök igen.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={generatingRecipe} onRefresh={onRefresh} />
          }
        >
          {recipesWithMatch.map(({ item, match }) => {
            const recipe = item.recipe;
            const haveY =
              match.total > 0
                ? `Du har ${match.have}/${match.total}`
                : '–';
            const missingTranslated = match.missing.map((m) =>
              translateIngredientName(m).translated
            );
            const missingPreview =
              missingTranslated.length > 0
                ? missingTranslated.length <= MAX_MISSING_DISPLAY
                  ? missingTranslated.join(', ')
                  : `${missingTranslated.slice(0, MAX_MISSING_DISPLAY).join(', ')} … och ${missingTranslated.length - MAX_MISSING_DISPLAY} fler`
                : null;
            const timeStr =
              recipe.readyInMinutes != null
                ? `Ca ${recipe.readyInMinutes} min`
                : null;
            const onPress =
              item.source === 'generated'
                ? () =>
                    navigation.navigate(ROUTES.Receptdetalj, {
                      id: String(recipe.id),
                      source: 'generated',
                    })
                : () =>
                    navigation.navigate(ROUTES.Receptdetalj, {
                      id: String(recipe.id),
                      source: 'web',
                      title: recipe.title,
                      sourceUrl: recipe.sourceUrl ?? undefined,
                      image: recipe.image ?? undefined,
                    });
            const favKey = `${item.source}|${recipe.id}`;
            const isFav = favoriteSet.has(favKey);
            const onFavoritePress = async () => {
              if (isFav) {
                await favoritesService.deleteByRecipe(item.source, String(recipe.id));
                setFavoriteSet((prev) => {
                  const next = new Set(prev);
                  next.delete(favKey);
                  return next;
                });
              } else {
                const recipeData = JSON.stringify({
                  title: recipe.title,
                  image: recipe.image ?? null,
                  sourceUrl: 'sourceUrl' in recipe && recipe.sourceUrl != null ? recipe.sourceUrl : null,
                });
                await favoritesService.create({
                  provider: item.source,
                  recipe_id: String(recipe.id),
                  recipe_data: recipeData,
                });
                setFavoriteSet((prev) => new Set(prev).add(favKey));
              }
            };
            const onDeletePress = async () => {
              const id = Number(recipe.id);
              if (item.source === 'generated') {
                await generatedRecipesService.deleteById(id);
              } else {
                await savedWebRecipesService.deleteById(id);
              }
              if (isFav) {
                await favoritesService.deleteByRecipe(item.source, String(recipe.id));
                setFavoriteSet((prev) => {
                  const next = new Set(prev);
                  next.delete(favKey);
                  return next;
                });
              }
              await loadRecipesRef.current();
            };
            return (
              <View key={`${item.source}-${recipe.id}`} style={styles.cardWrapper}>
                <Card style={styles.card} onPress={onPress}>
                  {recipe.image ? (
                    <Image
                      source={{ uri: recipe.image.startsWith('http') || recipe.image.startsWith('file://') ? recipe.image : `file://${recipe.image}` }}
                      style={styles.cardImage}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {recipe.title}
                    </Text>
                    <Text style={styles.cardMeta}>{haveY}</Text>
                    {missingPreview ? (
                      <Text
                        style={styles.cardMissing}
                        numberOfLines={2}
                      >{`Saknas: ${missingPreview}`}</Text>
                    ) : null}
                    {timeStr ? (
                      <Text style={styles.cardTime}>{timeStr}</Text>
                    ) : null}
                  </View>
                </Card>
                <Pressable
                  onPress={onFavoritePress}
                  style={styles.favoriteButton}
                  hitSlop={8}
                >
                  <Text style={[styles.favoriteIcon, isFav && styles.favoriteIconFilled]}>
                    {isFav ? '♥' : '♡'}
                  </Text>
                </Pressable>
                <View
                  style={styles.deleteButtonWrapper}
                  {...(Platform.OS === 'web'
                    ? {
                        onMouseEnter: () => setDeleteHoverKey(`${item.source}-${recipe.id}`),
                        onMouseLeave: () => setDeleteHoverKey(null),
                      }
                    : {})}
                >
                  <Pressable
                    onPress={onDeletePress}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      (pressed || deleteHoverKey === `${item.source}-${recipe.id}`) && styles.deleteButtonActive,
                    ]}
                    hitSlop={8}
                  >
                    {({ pressed }) => {
                      const isActive = pressed || deleteHoverKey === `${item.source}-${recipe.id}`;
                      return (
                        <Text style={[styles.deleteIcon, isActive && styles.deleteIconActive]}>
                          ×
                        </Text>
                      );
                    }}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  cacheBanner: {
    backgroundColor: '#fff3cd',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  cacheBannerText: {
    fontSize: 14,
    color: '#856404',
  },
  newSuggestionsButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  newSuggestionsButtonDisabled: {
    opacity: 0.7,
  },
  newSuggestionsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  cardWrapper: {
    marginBottom: 16,
    position: 'relative',
  },
  card: {
    overflow: 'hidden',
    padding: 0,
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
  },
  deleteButtonWrapper: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    zIndex: 1,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonActive: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
  },
  deleteIcon: {
    fontSize: 22,
    fontWeight: '300',
    color: '#666',
    lineHeight: 22,
  },
  deleteIconActive: {
    color: '#b91c1c',
  },
  favoriteIcon: {
    fontSize: 24,
    color: '#999',
  },
  favoriteIconFilled: {
    color: '#c00',
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#eee',
  },
  cardBody: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  cardMissing: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  cardTime: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
