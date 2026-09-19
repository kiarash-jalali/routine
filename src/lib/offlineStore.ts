import type { CheckinItem, CheckinItemType } from "@/types/checkin";
import type { Language } from "@/lib/i18n";

const DATABASE_NAME = "rootine-offline";
const DATABASE_VERSION = 1;
const STATE_STORE = "state";
const MUTATION_STORE = "mutations";
const SNAPSHOT_KEY = "snapshot";

export const OFFLINE_QUEUE_EVENT = "rootine:offline-queue";

export type OfflineSnapshotItem = {
  id: string;
  title: string;
  completed: boolean;
};

export type OfflineSnapshot = {
  version: 1;
  userId: string;
  language: Language;
  savedAt: string;
  day: string;
  checkedInToday: boolean;
  routines: OfflineSnapshotItem[];
  tasks: OfflineSnapshotItem[];
};

export type OfflineMutation =
  | {
      id: string;
      kind: "daily_item_completion";
      userId: string;
      queuedAt: string;
      day: string;
      itemType: CheckinItemType;
      itemId: string;
      completed: boolean;
    }
  | {
      id: string;
      kind: "finish_daily_checkin";
      userId: string;
      queuedAt: string;
      day: string;
      items: CheckinItem[];
    };

function offlineStorageSupported() {
  return typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  if (!offlineStorageSupported()) {
    return Promise.reject(new Error("offline_storage_unavailable"));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STATE_STORE)) {
        database.createObjectStore(STATE_STORE);
      }
      if (!database.objectStoreNames.contains(MUTATION_STORE)) {
        database.createObjectStore(MUTATION_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("offline_storage_open_failed"));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("offline_storage_request_failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("offline_storage_write_failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("offline_storage_write_aborted"));
  });
}

function emitQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
  }
}

export function isOfflineLikeError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof TypeError) return true;

  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : String(error ?? "");

  return /failed to fetch|network(?:error| request failed)|load failed/i.test(
    message,
  );
}

export async function saveOfflineSnapshot(snapshot: OfflineSnapshot) {
  const database = await openDatabase();
  const transaction = database.transaction(STATE_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(STATE_STORE).put(snapshot, SNAPSHOT_KEY);
  await done;
  database.close();
}

export async function getOfflineSnapshot(): Promise<OfflineSnapshot | null> {
  const database = await openDatabase();
  const transaction = database.transaction(STATE_STORE, "readonly");
  const value = await requestResult(
    transaction.objectStore(STATE_STORE).get(SNAPSHOT_KEY),
  );
  database.close();
  return (value as OfflineSnapshot | undefined) ?? null;
}

export async function queueDailyItemCompletion(
  userId: string,
  day: string,
  itemType: CheckinItemType,
  itemId: string,
  completed: boolean,
) {
  const mutation: OfflineMutation = {
    id: `item:${userId}:${day}:${itemType}:${itemId}`,
    kind: "daily_item_completion",
    userId,
    queuedAt: new Date().toISOString(),
    day,
    itemType,
    itemId,
    completed,
  };

  const database = await openDatabase();
  const transaction = database.transaction(MUTATION_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(MUTATION_STORE).put(mutation);
  await done;
  database.close();
  emitQueueChanged();
}

export async function queueFinishDailyCheckin(
  userId: string,
  day: string,
  items: CheckinItem[],
) {
  const mutation: OfflineMutation = {
    id: `finish:${userId}:${day}`,
    kind: "finish_daily_checkin",
    userId,
    queuedAt: new Date().toISOString(),
    day,
    items,
  };

  const database = await openDatabase();
  const transaction = database.transaction(MUTATION_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(MUTATION_STORE).put(mutation);
  await done;
  database.close();
  emitQueueChanged();
}

export async function listOfflineMutations(userId: string) {
  const database = await openDatabase();
  const transaction = database.transaction(MUTATION_STORE, "readonly");
  const values = await requestResult(
    transaction.objectStore(MUTATION_STORE).getAll(),
  );
  database.close();

  return (values as OfflineMutation[])
    .filter((mutation) => mutation.userId === userId)
    .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
}

export async function getPendingOfflineMutationCount(userId: string) {
  return (await listOfflineMutations(userId)).length;
}

export async function removeOfflineMutation(id: string) {
  const database = await openDatabase();
  const transaction = database.transaction(MUTATION_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(MUTATION_STORE).delete(id);
  await done;
  database.close();
  emitQueueChanged();
}

export async function clearOfflineData() {
  if (!offlineStorageSupported()) return;

  const database = await openDatabase();
  const transaction = database.transaction(
    [STATE_STORE, MUTATION_STORE],
    "readwrite",
  );
  const done = transactionDone(transaction);
  transaction.objectStore(STATE_STORE).clear();
  transaction.objectStore(MUTATION_STORE).clear();
  await done;
  database.close();
  emitQueueChanged();
}
