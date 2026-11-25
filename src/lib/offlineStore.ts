import type { CheckinItem, CheckinItemType } from "@/types/checkin";
import type { Language } from "@/lib/i18n";

const DATABASE_NAME = "rootine-offline";
const DATABASE_VERSION = 1;
const STATE_STORE = "state";
const MUTATION_STORE = "mutations";
const SNAPSHOT_KEY = "snapshot";
// The grocery list (S4) is kept apart from the Today snapshot so either can be
// saved without the other. Item labels are pre-formatted names and amounts only.
const GROCERY_KEY = "groceries";

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

export type OfflineGroceryItem = {
  id: string;
  label: string;
  amount: string;
  section: string;
  have: boolean;
  bought: boolean;
};

export type OfflineGrocerySnapshot = {
  version: 1;
  userId: string;
  language: Language;
  savedAt: string;
  weekStart: string;
  title: string;
  items: OfflineGroceryItem[];
};

export type GroceryFlagField = "have" | "bought";

export type OfflineMutation =
  | {
      id: string;
      kind: "grocery_item_flag";
      userId: string;
      queuedAt: string;
      /** The list's week start (the sync route requires a day on every change). */
      day: string;
      itemId: string;
      field: GroceryFlagField;
      value: boolean;
    }
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

export type OfflineSyncResult = {
  ok: boolean;
  appliedIds: string[];
  discardedIds: string[];
  retryIds: string[];
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

function requestBackgroundSync() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage({ type: "REGISTER_OFFLINE_SYNC" });
    })
    .catch(() => undefined);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0)
  );
}

export function isOfflineLikeError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;

  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : String(error ?? "");

  return /failed to fetch|network(?:error| request failed)|load failed|internet connection appears to be offline|fetch failed/i.test(
    message,
  );
}

/** Clears everything saved for another account before saving for this one. */
async function clearIfOtherUser(userId: string) {
  const [today, groceries] = await Promise.all([
    getOfflineSnapshot().catch(() => null),
    getGrocerySnapshot().catch(() => null),
  ]);
  if (
    (today && today.userId !== userId) ||
    (groceries && groceries.userId !== userId)
  ) {
    await clearOfflineData();
  }
}

export async function saveOfflineSnapshot(snapshot: OfflineSnapshot) {
  await clearIfOtherUser(snapshot.userId);

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

export async function saveGrocerySnapshot(snapshot: OfflineGrocerySnapshot) {
  await clearIfOtherUser(snapshot.userId);
  const database = await openDatabase();
  const transaction = database.transaction(STATE_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(STATE_STORE).put(snapshot, GROCERY_KEY);
  await done;
  database.close();
}

export async function getGrocerySnapshot(): Promise<OfflineGrocerySnapshot | null> {
  const database = await openDatabase();
  const transaction = database.transaction(STATE_STORE, "readonly");
  const value = await requestResult(
    transaction.objectStore(STATE_STORE).get(GROCERY_KEY),
  );
  database.close();
  return (value as OfflineGrocerySnapshot | undefined) ?? null;
}

/** Queues a grocery tick; a later tick of the same item and field replaces it. */
export async function queueGroceryFlag(
  userId: string,
  weekStart: string,
  itemId: string,
  field: GroceryFlagField,
  value: boolean,
) {
  const mutation: OfflineMutation = {
    id: `grocery:${userId}:${itemId}:${field}`,
    kind: "grocery_item_flag",
    userId,
    queuedAt: new Date().toISOString(),
    day: weekStart,
    itemId,
    field,
    value,
  };

  const database = await openDatabase();
  const transaction = database.transaction(MUTATION_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(MUTATION_STORE).put(mutation);
  await done;
  database.close();
  await setGrocerySnapshotFlag(userId, itemId, field, value).catch(() => undefined);
  emitQueueChanged();
  requestBackgroundSync();
}

/** Keeps the offline page's copy of one item in step with what the user sees. */
export async function setGrocerySnapshotFlag(
  userId: string,
  itemId: string,
  field: GroceryFlagField,
  value: boolean,
) {
  const database = await openDatabase();
  // One transaction, so two quick ticks cannot overwrite each other.
  const transaction = database.transaction(STATE_STORE, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(STATE_STORE);
  const request = store.get(GROCERY_KEY);
  request.onsuccess = () => {
    const snapshot = request.result as OfflineGrocerySnapshot | undefined;
    const item = snapshot?.items.find((entry) => entry.id === itemId);
    if (!snapshot || snapshot.userId !== userId || !item) return;
    item[field] = value;
    snapshot.savedAt = new Date().toISOString();
    store.put(snapshot, GROCERY_KEY);
  };
  await done;
  database.close();
}

/** Grocery ticks still waiting to sync, oldest first. */
export async function pendingGroceryFlags(userId: string) {
  return (await listOfflineMutations(userId)).flatMap((mutation) =>
    mutation.kind === "grocery_item_flag" ? [mutation] : [],
  );
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
  requestBackgroundSync();
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
  requestBackgroundSync();
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

export async function removeOfflineMutations(ids: string[]) {
  if (ids.length === 0) return;
  const database = await openDatabase();
  const transaction = database.transaction(MUTATION_STORE, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(MUTATION_STORE);
  for (const id of new Set(ids)) store.delete(id);
  await done;
  database.close();
  emitQueueChanged();
}

/** Changes sent per request; the rest follow in the next one. */
const SYNC_BATCH = 100;

/**
 * Deletes synced changes, keeping any that were queued again under the same id
 * while the request was in flight (a newer tick must not be lost).
 */
async function removeSentMutations(sent: OfflineMutation[], ids: string[]) {
  const finished = new Set(ids);
  const targets = sent.filter((mutation) => finished.has(mutation.id));
  if (targets.length === 0) return;
  const database = await openDatabase();
  const transaction = database.transaction(MUTATION_STORE, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(MUTATION_STORE);
  for (const mutation of targets) {
    const request = store.get(mutation.id);
    request.onsuccess = () => {
      const stored = request.result as OfflineMutation | undefined;
      if (stored?.queuedAt === mutation.queuedAt) store.delete(mutation.id);
    };
  }
  await done;
  database.close();
  emitQueueChanged();
}

async function runOfflineSync(userId: string): Promise<OfflineSyncResult> {
  const total: OfflineSyncResult = {
    ok: true,
    appliedIds: [],
    discardedIds: [],
    retryIds: [],
  };
  const mutations = await listOfflineMutations(userId);

  for (let start = 0; start < mutations.length; start += SYNC_BATCH) {
    const batch = mutations.slice(start, start + SYNC_BATCH);
    const response = await fetch("/api/offline/sync", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutations: batch }),
    });

    if (!response.ok) {
      throw new Error(`offline_sync_failed_${response.status}`);
    }

    const payload = (await response.json()) as Partial<OfflineSyncResult>;
    if (
      typeof payload.ok !== "boolean" ||
      !isStringArray(payload.appliedIds) ||
      !isStringArray(payload.discardedIds) ||
      !isStringArray(payload.retryIds)
    ) {
      throw new Error("offline_sync_invalid_response");
    }

    await removeSentMutations(batch, [
      ...payload.appliedIds,
      ...payload.discardedIds,
    ]);
    total.ok = total.ok && payload.ok;
    total.appliedIds.push(...payload.appliedIds);
    total.discardedIds.push(...payload.discardedIds);
    total.retryIds.push(...payload.retryIds);
  }

  return total;
}

const syncsInFlight = new Map<string, Promise<OfflineSyncResult>>();

/** One sync per user at a time: callers share the request already running. */
export function syncOfflineMutations(
  userId: string,
): Promise<OfflineSyncResult> {
  const running = syncsInFlight.get(userId);
  if (running) return running;
  const sync = runOfflineSync(userId).finally(() => {
    syncsInFlight.delete(userId);
  });
  syncsInFlight.set(userId, sync);
  return sync;
}

/** Waits for a running sync (if any), so an older queued value cannot land after a newer write. */
export async function settleOfflineSync(userId: string) {
  await syncsInFlight.get(userId)?.catch(() => undefined);
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
