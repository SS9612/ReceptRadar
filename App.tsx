import type { SQLiteDatabase } from 'expo-sqlite';
import { SQLiteProvider } from 'expo-sqlite';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { setDb, migrate } from './src/db';
import { RootNavigator } from './src/navigation/RootNavigator';

async function onDbInit(db: SQLiteDatabase): Promise<void> {
  await migrate(db);
  setDb(db);
}

export default function App() {
  return (
    <SQLiteProvider databaseName="receptradar.db" onInit={onDbInit}>
      <AppErrorBoundary>
        <NavigationContainer>
          <RootNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </AppErrorBoundary>
    </SQLiteProvider>
  );
}
