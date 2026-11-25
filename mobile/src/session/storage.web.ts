// Browsers have no secure enclave; the web build is for development and demos only.
function local(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const storage = {
  get: async (key: string) => local()?.getItem(key) ?? null,
  set: async (key: string, value: string) => {
    local()?.setItem(key, value);
  },
  remove: async (key: string) => {
    local()?.removeItem(key);
  },
};
