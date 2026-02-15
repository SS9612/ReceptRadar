import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Card, RecipeCardSkeleton } from '../components';
import { ROUTES } from '../constants/routes';
import type { Favorite, FavoriteRecipeData } from '../services/favoritesService';
import * as favoritesService from '../services/favoritesService';

type FavoriterStackParamList = {
  [ROUTES.FavoriterList]: undefined;
  [ROUTES.Receptdetalj]: {
    id?: string;
    source?: 'web' | 'generated';
    title?: string;
    sourceUrl?: string;
    image?: string;
  };
};

function parseRecipeData(recipe_data: string | null): FavoriteRecipeData | null {
  if (!recipe_data) return null;
  try {
    return JSON.parse(recipe_data) as FavoriteRecipeData;
  } catch {
    return null;
  }
}

export function FavoriterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FavoriterStackParamList>>();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const list = await favoritesService.getAll();
      setFavorites(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  const openRecipe = (favorite: Favorite) => {
    const data = parseRecipeData(favorite.recipe_data);
    if (favorite.provider === 'generated') {
      navigation.navigate(ROUTES.Receptdetalj, { id: favorite.recipe_id, source: 'generated' });
    } else {
      navigation.navigate(ROUTES.Receptdetalj, {
        id: favorite.recipe_id,
        source: 'web',
        title: data?.title,
        sourceUrl: data?.sourceUrl ?? undefined,
        image: data?.image ?? undefined,
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Favoriter</Text>
      {loading ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {[1, 2, 3, 4].map((i) => (
            <RecipeCardSkeleton key={i} />
          ))}
        </ScrollView>
      ) : favorites.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Inga favoriter sparade.</Text>
          <Text style={styles.emptyHint}>
            Lägg till recept som favoriter från Receptförslag eller receptsidan.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {favorites.map((fav) => {
            const data = parseRecipeData(fav.recipe_data);
            const title = data?.title ?? fav.recipe_id;
            const image = data?.image ?? null;
            return (
              <Card
                key={`${fav.provider}-${fav.recipe_id}`}
                style={styles.card}
                onPress={() => openRecipe(fav)}
              >
                {image ? (
                  <Image
                    source={{ uri: image }}
                    style={styles.cardImage}
                    resizeMode="cover"
                  />
                ) : null}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {title}
                  </Text>
                </View>
              </Card>
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    marginBottom: 16,
    overflow: 'hidden',
    padding: 0,
  },
  cardImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#eee',
  },
  cardBody: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
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
