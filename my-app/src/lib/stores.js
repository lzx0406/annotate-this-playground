import { writable } from "svelte/store";

/**
 * @param {string} key
 * @param {string | never[] | null} initialValue
 */
function persistentStore(key, initialValue) {
  let data = initialValue;

  if (typeof localStorage !== "undefined") {
    const storedValue = localStorage.getItem(key);
    data = storedValue ? JSON.parse(storedValue) : initialValue;
  }

  const store = writable(data);

  if (typeof localStorage !== "undefined") {
    store.subscribe((value) => {
      if (value !== null) {
        localStorage.setItem(key, JSON.stringify(value));
      } else {
        localStorage.removeItem(key);
      }
    });
  }

  return store;
}

export const selectedAnnotationType = persistentStore(
  "selectedAnnotationType",
  "news"
);
export const userId = persistentStore("userId", null);
export const userName = persistentStore("userName", null);
export const prompts = persistentStore("prompts", []);
export const waitingForAnnotation = persistentStore(
  "waitingForAnnotation",
  // @ts-ignore
  false
);
export const pendingPrompt = persistentStore("pendingPrompt", null);
export const latestProgress = persistentStore(
  "latestProgress",
  "waiting for annotation task"
);
export const numAnnotated = persistentStore("numAnnotated", null);
