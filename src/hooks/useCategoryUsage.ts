import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

type CategoryUsage = Record<string, number>;

const EMPTY_USAGE: CategoryUsage = {};

// Serialize storage operations so rapid selections don't overwrite each other.
let storageQueue: Promise<void> = Promise.resolve();

function enqueue(operation: () => Promise<void>) {
  storageQueue = storageQueue
    .then(operation)
    .catch((error) => console.warn("Category usage storage failed", error));
}

async function readUsage(key: string): Promise<CategoryUsage> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return {};

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  return Object.fromEntries(
    Object.entries(parsed).filter(
      ([, count]) =>
        typeof count === "number" &&
        Number.isSafeInteger(count) &&
        count >= 0,
    ),
  );
}

export function useCategoryUsage(storageKey?: string) {
  const [snapshot, setSnapshot] = useState<{
    key: string;
    counts: CategoryUsage;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!storageKey) return;

      let active = true;

      enqueue(async () => {
        const counts = await readUsage(storageKey);
        if (active) setSnapshot({ key: storageKey, counts });
      });

      return () => {
        active = false;
      };
    }, [storageKey]),
  );

  const recordCategorySelection = useCallback(
    (categoryId: string) => {
      if (!storageKey) return;

      enqueue(async () => {
        const counts = await readUsage(storageKey);
        const updated = {
          ...counts,
          [categoryId]: (counts[categoryId] ?? 0) + 1,
        };

        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      });
    },
    [storageKey],
  );

const categoryUsage: CategoryUsage = snapshot !== null && snapshot.key === storageKey ? snapshot.counts : EMPTY_USAGE;

  return { categoryUsage, recordCategorySelection };
}