import * as SecureStore from "expo-secure-store";

/**
 * Persistent key-value storage. On iOS and Android the token goes into the Keychain /
 * Android Keystore through expo-secure-store, never plain AsyncStorage.
 * The web build uses storage.web.ts instead (Metro picks it automatically).
 */
export const storage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
