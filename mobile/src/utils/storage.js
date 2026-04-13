import * as SecureStore from 'expo-secure-store';

export const storage = {
  async set(key, value) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await SecureStore.setItemAsync(key, stringValue);
  },
  async get(key) {
    const value = await SecureStore.getItemAsync(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  },
  async remove(key) {
    await SecureStore.deleteItemAsync(key);
  },
};
