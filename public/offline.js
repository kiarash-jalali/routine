(() => {
  const DATABASE_NAME = "rootine-offline";
  const DATABASE_VERSION = 1;
  const STATE_STORE = "state";
  const MUTATION_STORE = "mutations";
  const SNAPSHOT_KEY = "snapshot";
  const SYNC_TAG = "rootine-offline-sync";

  const copy = {
    en: {
      title: "Today is still here.",
      body: "You can keep checking things off without a connection. Rootine will sync these changes when you’re back online.",
      staleTitle: "Your last saved day is here.",
      staleBody: "This device has not saved today’s plan yet. You can review the last saved day offline, but reconnect before changing it.",
      noConnection: "Offline",
      online: "Back online",
      pending: (count) =>
        count === 1 ? "1 change waiting to sync." : `${count} changes waiting to sync.`,
      saved: (value) => `Saved on this device · ${value}`,
      routines: "Routines",
      tasks: "Tasks",
      empty: "There isn’t a saved Today view on this device yet.",
      finish: "Finish day",
      finished: "Day finished",
      sync: "Sync now",
      syncing: "Syncing…",
      synced: "Everything is synced.",
      retry: "Some changes still need to sync. Rootine will try again.",
      signIn: "Your session needs to be refreshed before these changes can sync.",
      open: "Open Rootine",
      localOnly: "Only routine and task titles plus today’s completion state are stored for offline use. Health and medication data are not cached here.",
    },
    fa: {
      title: "امروز هنوز همین‌جاست.",
      body: "بدون اینترنت هم می‌توانی کارها و روتین‌ها را انجام‌شده علامت بزنی. وقتی دوباره آنلاین شوی، روتین تغییرها را همگام می‌کند.",
      staleTitle: "آخرین روز ذخیره‌شده اینجاست.",
      staleBody: "برنامه امروز هنوز روی این دستگاه ذخیره نشده است. می‌توانی آخرین روز ذخیره‌شده را ببینی، اما برای تغییر آن دوباره آنلاین شو.",
      noConnection: "آفلاین",
      online: "دوباره آنلاین شدی",
      pending: (count) => `${count} تغییر منتظر همگام‌سازی است.`,
      saved: (value) => `ذخیره‌شده روی این دستگاه · ${value}`,
      routines: "روتین‌ها",
      tasks: "کارها",
      empty: "هنوز نمای امروز روی این دستگاه ذخیره نشده است.",
      finish: "پایان روز",
      finished: "روز ثبت شده",
      sync: "همگام‌سازی",
      syncing: "در حال همگام‌سازی…",
      synced: "همه‌چیز همگام است.",
      retry: "بعضی تغییرها هنوز همگام نشده‌اند. روتین دوباره تلاش می‌کند.",
      signIn: "برای همگام‌سازی این تغییرها باید نشست ورودت تازه شود.",
      open: "باز کردن روتین",
      localOnly: "برای استفاده آفلاین فقط عنوان روتین‌ها و کارها و وضعیت انجام امروز روی دستگاه ذخیره می‌شود. اطلاعات سلامت و دارو اینجا کش نمی‌شوند.",
    },
  };

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function openDatabase() {
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
      request.onerror = () => reject(request.error);
    });
  }

  async function readState() {
    const database = await openDatabase();
    const transaction = database.transaction(
      [STATE_STORE, MUTATION_STORE],
      "readonly",
    );
    const snapshot = await requestResult(
      transaction.objectStore(STATE_STORE).get(SNAPSHOT_KEY),
    );
    const mutations = await requestResult(
      transaction.objectStore(MUTATION_STORE).getAll(),
    );
    database.close();
    const ownedMutations = Array.isArray(mutations) && snapshot?.userId
      ? mutations
          .filter((mutation) => mutation.userId === snapshot.userId)
          .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt))
      : [];
    return { snapshot: snapshot || null, mutations: ownedMutations };
  }

  async function writeSnapshot(snapshot) {
    const database = await openDatabase();
    const transaction = database.transaction(STATE_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(STATE_STORE).put(snapshot, SNAPSHOT_KEY);
    await done;
    database.close();
  }

  async function putMutation(mutation) {
    const database = await openDatabase();
    const transaction = database.transaction(MUTATION_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(MUTATION_STORE).put(mutation);
    await done;
    database.close();
    await registerBackgroundSync();
  }

  async function removeMutations(ids) {
    if (!ids.length) return;
    const database = await openDatabase();
    const transaction = database.transaction(MUTATION_STORE, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(MUTATION_STORE);
    for (const id of new Set(ids)) store.delete(id);
    await done;
    database.close();
  }

  async function registerBackgroundSync() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      if ("sync" in registration) {
        await registration.sync.register(SYNC_TAG);
      }
    } catch {
      // The visible page will still retry when it sees an online event.
    }
  }

  function itemKey(itemType, itemId) {
    return `item:${state.snapshot.userId}:${state.snapshot.day}:${itemType}:${itemId}`;
  }

  function locale() {
    return state.language === "fa" ? "fa-IR" : "en-AU";
  }

  function localDateKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatSavedAt(value) {
    try {
      return new Intl.DateTimeFormat(locale(), {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function formatDay(value) {
    try {
      return new Intl.DateTimeFormat(locale(), {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date(`${value}T12:00:00`));
    } catch {
      return value;
    }
  }

  function el(tag, attributes = {}, text = "") {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === "className") node.className = value;
      else if (key === "disabled") node.disabled = Boolean(value);
      else if (value !== undefined && value !== null)
        node.setAttribute(key, String(value));
    }
    if (text) node.textContent = text;
    return node;
  }

  function renderItems(container, title, itemType, items) {
    if (!items.length) return;
    const section = el("section", { className: "offline-section" });
    section.append(el("h2", {}, title));
    const list = el("div", { className: "offline-list" });

    for (const item of items) {
      const button = el("button", {
        type: "button",
        className: "offline-item",
        "aria-pressed": item.completed ? "true" : "false",
        disabled: state.staleDay,
      });
      const mark = el(
        "span",
        { className: "offline-mark", "aria-hidden": "true" },
        item.completed ? "✓" : "○",
      );
      const label = el("span", { className: "offline-item-title" }, item.title);
      button.append(mark, label);
      button.addEventListener("click", async () => {
        item.completed = !item.completed;
        state.snapshot.savedAt = new Date().toISOString();
        button.setAttribute("aria-pressed", item.completed ? "true" : "false");
        mark.textContent = item.completed ? "✓" : "○";
        await writeSnapshot(state.snapshot);
        await putMutation({
          id: itemKey(itemType, item.id),
          kind: "daily_item_completion",
          userId: state.snapshot.userId,
          queuedAt: new Date().toISOString(),
          day: state.snapshot.day,
          itemType,
          itemId: item.id,
          completed: item.completed,
        });
        await refreshPending();
      });
      list.append(button);
    }

    section.append(list);
    container.append(section);
  }

  function render() {
    const c = copy[state.language];
    document.documentElement.lang = state.language;
    document.documentElement.dir = state.language === "fa" ? "rtl" : "ltr";
    document.title = `rootine · ${c.title}`;

    const title = document.getElementById("offline-title");
    const body = document.getElementById("offline-body");
    const content = document.getElementById("offline-content");
    const meta = document.getElementById("offline-meta");
    const privacy = document.getElementById("offline-privacy");
    const open = document.getElementById("offline-open");

    title.textContent = state.staleDay ? c.staleTitle : c.title;
    body.textContent = state.staleDay ? c.staleBody : c.body;
    privacy.textContent = c.localOnly;
    open.textContent = c.open;

    content.replaceChildren();
    if (!state.snapshot) {
      content.append(el("section", { className: "offline-section" }, ""));
      content.lastElementChild.append(
        el("p", { className: "muted" }, c.empty),
      );
      meta.textContent = "";
      document.getElementById("offline-finish").hidden = true;
      return;
    }

    content.append(
      el("p", { className: "offline-day" }, formatDay(state.snapshot.day)),
    );
    renderItems(
      content,
      c.routines,
      "routine",
      Array.isArray(state.snapshot.routines) ? state.snapshot.routines : [],
    );
    renderItems(
      content,
      c.tasks,
      "task",
      Array.isArray(state.snapshot.tasks) ? state.snapshot.tasks : [],
    );

    meta.textContent = c.saved(formatSavedAt(state.snapshot.savedAt));
    const finish = document.getElementById("offline-finish");
    finish.hidden = state.staleDay;
    finish.textContent = state.snapshot.checkedInToday ? c.finished : c.finish;
    finish.disabled = state.snapshot.checkedInToday || state.staleDay;
  }

  async function refreshPending(statusOverride) {
    const { mutations } = await readState();
    state.mutations = mutations;
    const c = copy[state.language];
    const status = document.getElementById("offline-status");
    const sync = document.getElementById("offline-sync");

    if (statusOverride) {
      status.textContent = statusOverride;
    } else if (!navigator.onLine) {
      status.textContent =
        mutations.length > 0
          ? `${c.noConnection} · ${c.pending(mutations.length)}`
          : c.noConnection;
    } else if (mutations.length > 0) {
      status.textContent = `${c.online} · ${c.pending(mutations.length)}`;
    } else {
      status.textContent = c.synced;
    }

    sync.hidden = mutations.length === 0;
    sync.disabled = !navigator.onLine || state.syncing;
    sync.textContent = state.syncing ? c.syncing : c.sync;
  }

  async function finishDay() {
    if (!state.snapshot || state.snapshot.checkedInToday) return;
    const items = [
      ...(state.snapshot.routines || []).map((item) => ({
        item_type: "routine",
        item_id: item.id,
        completed: Boolean(item.completed),
      })),
      ...(state.snapshot.tasks || []).map((item) => ({
        item_type: "task",
        item_id: item.id,
        completed: Boolean(item.completed),
      })),
    ];

    state.snapshot.checkedInToday = true;
    state.snapshot.savedAt = new Date().toISOString();
    await writeSnapshot(state.snapshot);
    await putMutation({
      id: `finish:${state.snapshot.userId}:${state.snapshot.day}`,
      kind: "finish_daily_checkin",
      userId: state.snapshot.userId,
      queuedAt: new Date().toISOString(),
      day: state.snapshot.day,
      items,
    });
    render();
    await refreshPending();
  }

  async function syncNow() {
    if (!navigator.onLine || !state.snapshot || state.syncing) return;
    const { mutations } = await readState();
    if (!mutations.length) {
      await refreshPending();
      return;
    }

    state.syncing = true;
    await refreshPending();
    const c = copy[state.language];
    let finalStatus;

    try {
      const response = await fetch("/api/offline/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutations }),
      });

      if (response.status === 401) {
        finalStatus = c.signIn;
      } else {
        if (!response.ok) throw new Error("offline_sync_failed");

        const result = await response.json();
        const removable = [
          ...(Array.isArray(result.appliedIds) ? result.appliedIds : []),
          ...(Array.isArray(result.discardedIds) ? result.discardedIds : []),
        ];
        await removeMutations(removable);
        const retryCount = Array.isArray(result.retryIds)
          ? result.retryIds.length
          : 0;
        if (retryCount > 0) finalStatus = c.retry;
      }
    } catch {
      finalStatus = c.retry;
    } finally {
      state.syncing = false;
      await refreshPending(finalStatus);
    }
  }

  const state = {
    snapshot: null,
    mutations: [],
    language: "en",
    syncing: false,
    staleDay: false,
  };

  async function start() {
    try {
      const loaded = await readState();
      state.snapshot = loaded.snapshot;
      state.mutations = loaded.mutations;
      state.language = loaded.snapshot?.language === "fa" ? "fa" : "en";
      state.staleDay = Boolean(
        loaded.snapshot?.day && loaded.snapshot.day !== localDateKey(),
      );
    } catch {
      state.snapshot = null;
    }

    render();
    await refreshPending();

    document
      .getElementById("offline-finish")
      .addEventListener("click", () => void finishDay());
    document
      .getElementById("offline-sync")
      .addEventListener("click", () => void syncNow());

    window.addEventListener("online", () => {
      void refreshPending().then(() => syncNow());
    });
    window.addEventListener("offline", () => void refreshPending());

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "ROOTINE_OFFLINE_SYNCED") {
          void refreshPending();
        }
      });
    }

    if (navigator.onLine && state.mutations.length > 0) {
      void syncNow();
    }
  }

  void start();
})();
