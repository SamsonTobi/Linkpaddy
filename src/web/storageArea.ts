// A `chrome.storage.local` look-alike over localStorage, so the extension's
// data layer and UI run unchanged in a browser tab. Values are JSON, each key
// stored under a prefix so clear() never touches unrelated site data.

export type StorageChanges = Record<string, { oldValue?: unknown; newValue?: unknown }>;
export type StorageChangeListener = (changes: StorageChanges, areaName: string) => void;

export interface Backing {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type Callback<T> = (result: T) => void;

export function createStorageArea(
  backing: Backing,
  areaName: string,
  emit: StorageChangeListener,
  prefix = "lp:",
) {
  const read = (key: string): unknown => {
    const raw = backing.getItem(prefix + key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  };

  const keys = (): string[] => {
    const found: string[] = [];
    for (let i = 0; i < backing.length; i++) {
      const name = backing.key(i);
      if (name?.startsWith(prefix)) found.push(name.slice(prefix.length));
    }
    return found;
  };

  /** Chrome's API takes an optional callback and otherwise returns a promise. */
  const respond = <T>(work: () => T, callback?: Callback<T>): Promise<T> | undefined => {
    if (callback) {
      let result: T;
      try {
        result = work();
      } catch (error) {
        console.error("Storage error:", error);
        result = undefined as T;
      }
      Promise.resolve().then(() => callback(result));
      return undefined;
    }
    return new Promise<T>((resolve, reject) => {
      try {
        resolve(work());
      } catch (error) {
        reject(error);
      }
    });
  };

  const notify = (changes: StorageChanges) => {
    if (Object.keys(changes).length > 0) Promise.resolve().then(() => emit(changes, areaName));
  };

  return {
    get(request?: string | string[] | Record<string, unknown> | null, callback?: Callback<Record<string, unknown>>) {
      return respond(() => {
        const wanted =
          request == null
            ? keys()
            : typeof request === "string"
              ? [request]
              : Array.isArray(request)
                ? request
                : Object.keys(request);
        const defaults = request && typeof request === "object" && !Array.isArray(request) ? request : {};
        const result: Record<string, unknown> = {};
        for (const key of wanted) {
          const value = read(key);
          if (value !== undefined) result[key] = value;
          else if (key in defaults) result[key] = (defaults as Record<string, unknown>)[key];
        }
        return result;
      }, callback);
    },

    set(items: Record<string, unknown>, callback?: () => void) {
      return respond(() => {
        const changes: StorageChanges = {};
        for (const [key, value] of Object.entries(items)) {
          if (value === undefined) continue;
          const oldValue = read(key);
          backing.setItem(prefix + key, JSON.stringify(value));
          changes[key] = { oldValue, newValue: value };
        }
        notify(changes);
      }, callback);
    },

    remove(request: string | string[], callback?: () => void) {
      return respond(() => {
        const changes: StorageChanges = {};
        for (const key of Array.isArray(request) ? request : [request]) {
          const oldValue = read(key);
          if (oldValue === undefined) continue;
          backing.removeItem(prefix + key);
          changes[key] = { oldValue };
        }
        notify(changes);
      }, callback);
    },

    clear(callback?: () => void) {
      return respond(() => {
        const changes: StorageChanges = {};
        for (const key of keys()) {
          changes[key] = { oldValue: read(key) };
          backing.removeItem(prefix + key);
        }
        notify(changes);
      }, callback);
    },

    /** Feeds a `storage` event from another tab through the same listeners. */
    applyExternalChange(key: string | null, oldRaw: string | null, newRaw: string | null) {
      if (!key?.startsWith(prefix)) return;
      const parse = (raw: string | null) => {
        if (raw === null) return undefined;
        try {
          return JSON.parse(raw);
        } catch {
          return undefined;
        }
      };
      emit({ [key.slice(prefix.length)]: { oldValue: parse(oldRaw), newValue: parse(newRaw) } }, areaName);
    },
  };
}
