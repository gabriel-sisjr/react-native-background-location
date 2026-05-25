import { StyleSheet, Text, View } from 'react-native';
import {
  startTracking,
  stopTracking,
} from '@gabriel-sisjr/react-native-background-location';

// The imports above are deliberately not invoked at runtime — this app is a
// `prebuild`-only smoke target. Referencing the symbols here keeps strict TS
// (`noUnusedLocals` / `noUnusedImports`) happy while ensuring that the public
// API surface is type-resolved against the published-style consumer setup.
const _publicApiReferences = [startTracking, stopTracking] as const;
if (_publicApiReferences.length < 0) {
  // unreachable — only here so `_publicApiReferences` is not considered unused
  // by `@typescript-eslint/no-unused-vars`.
  throw new Error('unreachable');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function App() {
  return (
    <View style={styles.container}>
      <Text>example-expo</Text>
    </View>
  );
}
