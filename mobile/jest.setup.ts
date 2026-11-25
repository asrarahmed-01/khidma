// Native modules that don't exist in the Jest environment.

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

// Tests run in English unless a test switches language explicitly.
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 24.69, longitude: 46.68 } })),
  reverseGeocodeAsync: jest.fn(async () => []),
  Accuracy: { Balanced: 3 },
}));

// Icon fonts load asynchronously from bundled assets, which don't exist under Jest,
// so icons render as empty Text with a testID instead.
function mockIcon() {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = (props: { name: string }) => React.createElement(Text, { testID: `icon-${props.name}` }, "");
  return { __esModule: true, default: Icon };
}
jest.mock("@expo/vector-icons/Ionicons", () => mockIcon());
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => mockIcon());

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(async () => ({ type: "success", url: "khidma://booking/bk_1?payment=paid" })),
  maybeCompleteAuthSession: jest.fn(),
}));
