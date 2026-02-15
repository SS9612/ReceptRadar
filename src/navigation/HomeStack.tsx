import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../constants/routes';
import { HomeScreen } from '../screens/HomeScreen';

const Stack = createNativeStackNavigator();

const headerOptions = {
  title: 'Hem',
  headerStyle: { backgroundColor: '#f8f6f3' },
  headerShadowVisible: false,
  headerTintColor: '#1a1a1a',
  headerTitleStyle: { fontSize: 18, fontWeight: '600' as const },
};

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name={ROUTES.Home} component={HomeScreen} options={headerOptions} />
    </Stack.Navigator>
  );
}
