const STORAGE_KEYS = {
  bookmarks: "mujtahid.bookmarks",
  notifications: "mujtahid.notifications",
  searchCollection: "mujtahid.search-collection"
};

const COLLECTIONS = [
  { id: "all", label: "All" },
  { id: "bukhari", label: "Bukhari" },
  { id: "muslim", label: "Muslim" }
];

const REMINDER_OPTIONS = [
  { id: "daily", label: "Daily", intervalMs: 24 * 60 * 60 * 1000 },
  { id: "threeDays", label: "Every 3 days", intervalMs: 3 * 24 * 60 * 60 * 1000 },
  { id: "weekly", label: "Weekly", intervalMs: 7 * 24 * 60 * 60 * 1000 }
];

const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: false,
  frequency: "daily",
  lastSentAt: ""
};

const state = {
  loading: true,
  error: "",
  records: [],
  manifest: null,
  tab: "home",
  sheet: null,
  searchQuery: "",
  searchCollection: loadValue(STORAGE_KEYS.searchCollection, "all"),
  verifyText: "",
  bookmarks: loadJSON(STORAGE_KEYS.bookmarks, []),
  notifications: { ...DEFAULT_NOTIFICATION_SETTINGS, ...loadJSON(STORAGE_KEYS.notifications, DEFAULT_NOTIFICATION_SETTINGS) },
  notificationPermission: notificationPermissionState(),
  toast: "",
  now: new Date(),
  standalone: isStandalone(),
  launchHadithId: new URLSearchParams(window.location.search).get("hadith") || ""
};

const root = document.getElementById("app");
let toastTimer = null;
let notificationTimer = null;

applyStandaloneClass();
attachEventHandlers();
initialize();

async function initialize() {
  registerServiceWorker();
  try {
    const [recordsResponse, manifestResponse] = await Promise.all([
      fetch("../HadithCore/Resources/SeedHadith.json"),
      fetch("../HadithCore/Resources/ContentManifest.json")
    ]);

    if (!recordsResponse.ok || !manifestResponse.ok) {
      throw new Error("The hadith bundle could not be loaded.");
    }

    state.records = await recordsResponse.json();
    state.manifest = await manifestResponse.json();
    consumeLaunchHadith();
    await maybeSendDueReminder();
  } catch (error) {
    state.error = error.message || "The prototype failed to load.";
  } finally {
    state.loading = false;
    render();
  }
}

function attachEventHandlers() {
  root.addEventListener("click", async (event) => {
    const actionTarget = event.target.closest("[data-action]");

    if (!actionTarget) {
      if (event.target.classList.contains("sheet-backdrop")) {
        closeSheet();
        render();
      }
      return;
    }

    const { action, value, id } = actionTarget.dataset;

    switch (action) {
      case "switch-tab":
        state.tab = value;
        closeSheet();
        render();
        return;
      case "open-sheet":
        state.sheet = { type: value, id: id || "" };
        render();
        return;
      case "close-sheet":
        closeSheet();
        render();
        return;
      case "open-hadith":
        state.sheet = { type: "hadith", id };
        render();
        return;
      case "toggle-bookmark":
        toggleBookmark(id);
        render();
        return;
      case "jump-collection":
        state.searchCollection = value;
        state.tab = "search";
        persistAppState();
        render();
        return;
      case "set-collection":
        state.searchCollection = value;
        persistAppState();
        render();
        return;
      case "clear-search":
        state.searchQuery = "";
        render();
        return;
      case "apply-search":
        render();
        return;
      case "fill-daily-hadith":
        state.verifyText = featuredHadith(state.records, state.now)?.arabicText || "";
        render();
        return;
      case "apply-verify":
        render();
        return;
      case "open-notifications":
        state.sheet = { type: "notifications", id: "" };
        render();
        return;
      case "request-notifications":
        await requestNotificationPermission();
        render();
        return;
      case "toggle-reminders":
        await toggleReminders();
        render();
        return;
      case "set-frequency":
        state.notifications.frequency = value;
        persistAppState();
        showToast(`Reminder rate: ${reminderOption(value).label}`);
        render();
        return;
      case "send-test-notification":
        await sendReminderNotification({ test: true, force: true });
        render();
        return;
      default:
        return;
    }
  });

  root.addEventListener("input", (event) => {
    if (event.target.id === "search-field") {
      state.searchQuery = event.target.value;
    }

    if (event.target.id === "verify-field") {
      state.verifyText = event.target.value;
    }
  });

  root.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.id === "search-field") {
      event.preventDefault();
      render();
    }
  });

  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) {
      state.now = new Date();
      await maybeSendDueReminder();
      render();
    }
  });

  window.addEventListener("focus", async () => {
    state.now = new Date();
    await maybeSendDueReminder();
    render();
  });

  window.matchMedia("(display-mode: standalone)").addEventListener?.("change", () => {
    state.standalone = isStandalone();
    applyStandaloneClass();
    render();
  });

  notificationTimer = window.setInterval(async () => {
    state.now = new Date();
    await maybeSendDueReminder();
  }, 60000);
}

function render() {
  applyStandaloneClass();

  if (state.loading) {
    root.innerHTML = `
      <div class="screen-shell">
        <section class="screen">
          <header class="top-header">
            <div>
              <p class="kicker">Loading</p>
              <h1 class="large-title">مجتهد</h1>
              <p class="support-copy">Preparing the hadith reader.</p>
            </div>
          </header>
          <article class="reading-card">
            <p class="card-label">Loading hadith bundle</p>
            <h2 class="card-title">Opening the prototype...</h2>
            <p class="card-copy">Fetching the seed bundle, trust references, and reminder settings.</p>
          </article>
        </section>
      </div>
    `;
    return;
  }

  if (state.error) {
    root.innerHTML = `
      <div class="screen-shell">
        <section class="screen">
          <header class="top-header">
            <div>
              <p class="kicker">Error</p>
              <h1 class="large-title">مجتهد</h1>
              <p class="support-copy">The prototype could not start.</p>
            </div>
          </header>
          <article class="reading-card">
            <p class="card-label">Data</p>
            <h2 class="card-title">The hadith bundle did not load.</h2>
            <p class="card-copy">${escapeHtml(state.error)}</p>
          </article>
        </section>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="screen-shell">
      ${renderScreen()}
    </div>
    <nav class="tabbar" aria-label="Primary tabs">
      ${renderTabButton("home", "Home", renderIcon("home"))}
      ${renderTabButton("search", "Search", renderIcon("search"))}
      ${renderTabButton("verify", "Verify", renderIcon("verify"))}
      ${renderTabButton("library", "Library", renderIcon("library"))}
    </nav>
    ${state.sheet ? renderSheet() : ""}
    ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
  `;
}

function renderScreen() {
  switch (state.tab) {
    case "home":
      return renderHomeScreen();
    case "search":
      return renderSearchScreen();
    case "verify":
      return renderVerifyScreen();
    case "library":
      return renderLibraryScreen();
    default:
      return "";
  }
}

function renderHomeScreen() {
  const daily = featuredHadith(state.records, state.now);
  const bookmarked = bookmarkedRecords().slice(0, 2);

  return `
    <section class="screen">
      <header class="top-header">
        <div>
          <p class="kicker">Hadith reader</p>
          <h1 class="large-title">مجتهد</h1>
          <p class="support-copy">A hadith-first reading experience built around Sahih al-Bukhari and Sahih Muslim.</p>
        </div>
        <button class="circle-action" data-action="open-sheet" data-value="notifications" aria-label="Open hadith reminders">${renderIcon("bell")}</button>
      </header>

      <article class="reading-card">
        <div class="reading-head">
          <div>
            <p class="card-label">Daily hadith</p>
            <h2 class="card-title">${escapeHtml(daily.displayTitle)}</h2>
            <p class="card-copy">${escapeHtml(daily.chapterTitle)}</p>
          </div>
          <button class="trailing-action" data-action="toggle-bookmark" data-id="${daily.id}" aria-label="Save daily hadith">
            ${state.bookmarks.includes(daily.id) ? renderIcon("saved") : renderIcon("save")}
          </button>
        </div>
        <div class="badge-row">
          <span class="badge accent">${escapeHtml(daily.collectionDisplay)}</span>
          <span class="badge success">Sahih</span>
          <span class="badge gold">Verified references</span>
        </div>
        <p class="hadith-arabic">${escapeHtml(daily.arabicText)}</p>
        <p class="hadith-english">${escapeHtml(daily.englishText)}</p>
        <div class="action-row">
          <button class="primary-button" data-action="open-hadith" data-id="${daily.id}">Open hadith</button>
          <button class="secondary-button" data-action="open-sheet" data-value="trust">How we verify</button>
        </div>
      </article>

      <section class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">Collections</h2>
            <p class="section-note">Keep the product focused on trusted hadith sources, not extra utilities.</p>
          </div>
        </div>
        <div class="mini-collections">
          ${renderCollectionCard("bukhari")}
          ${renderCollectionCard("muslim")}
        </div>
      </section>

      <section class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">Preferences</h2>
            <p class="section-note">Trust center, reminders, and saved reading in one place.</p>
          </div>
        </div>
        <div class="group-card">
          ${renderGroupRow("Reminders", reminderSummary(), "Choose how often the app should surface a hadith.", "open-sheet", "notifications", renderIcon("bell-small"))}
          ${renderGroupRow("How we verify", "Sources and boundaries", "Canonical text, editorial metadata, and trusted references.", "open-sheet", "trust", renderIcon("shield"))}
        </div>
      </section>

      <section class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">Continue reading</h2>
            <p class="section-note">Saved hadith stay local on this device.</p>
          </div>
        </div>
        ${bookmarked.length ? `<div class="library-stack">${bookmarked.map((record) => renderSavedCard(record)).join("")}</div>` : `<div class="empty-state">Save hadith as you browse and they will appear here for fast return reading.</div>`}
      </section>
    </section>
  `;
}

function renderSearchScreen() {
  const results = searchRecords(state.records, state.searchQuery, state.searchCollection);

  return `
    <section class="screen">
      <header class="top-header">
        <div>
          <p class="kicker">Search</p>
          <h1 class="large-title">Find a hadith</h1>
          <p class="support-copy">Search Arabic, English, narrator, chapter, or collection without leaving the reading flow.</p>
        </div>
      </header>

      <section class="search-shell">
        <label class="search-bar" aria-label="Search hadith">
          <span class="search-icon">${renderIcon("search")}</span>
          <input id="search-field" type="text" placeholder="Search Arabic, English, narrator, chapter" value="${escapeAttribute(state.searchQuery)}">
          ${state.searchQuery ? `<button class="search-clear" data-action="clear-search" aria-label="Clear search">${renderIcon("close")}</button>` : ""}
        </label>
        <div class="filter-strip">
          ${COLLECTIONS.map((collection) => renderFilterChip(collection.id, collection.label)).join("")}
        </div>
        <button class="inline-button" data-action="apply-search">Search hadith</button>
      </section>

      <section class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">Results</h2>
            <p class="section-note">${results.length} matches</p>
          </div>
        </div>
        ${results.length ? `<div class="result-stack">${results.map((record) => renderResultCard(record)).join("")}</div>` : `<div class="empty-state">Start with a word, narrator name, or collection title. The prototype searches both Arabic and English fields.</div>`}
      </section>
    </section>
  `;
}

function renderVerifyScreen() {
  const matches = verifyRecords(state.records, state.verifyText);

  return `
    <section class="screen">
      <header class="top-header">
        <div>
          <p class="kicker">Verify</p>
          <h1 class="large-title">Check a snippet</h1>
          <p class="support-copy">Paste Arabic or English text to test the verification flow and source presentation.</p>
        </div>
      </header>

      <section class="verify-box">
        <textarea id="verify-field" placeholder="Paste a hadith phrase to compare it against the trusted bundle...">${escapeHtml(state.verifyText)}</textarea>
        <div class="verify-meta">
          <span>Longer phrases produce cleaner matches.</span>
          <button class="inline-button" data-action="fill-daily-hadith">Use daily hadith</button>
        </div>
        <div class="action-row">
          <button class="primary-button" data-action="apply-verify">Find matches</button>
          <button class="secondary-button" data-action="open-sheet" data-value="trust">See trust rules</button>
        </div>
      </section>

      <section class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">Matches</h2>
            <p class="section-note">${matches.length ? `${matches.length} likely matches` : "No strong match yet"}</p>
          </div>
        </div>
        ${matches.length ? `<div class="result-stack">${matches.map((item) => renderVerificationCard(item)).join("")}</div>` : `<div class="empty-state">Paste a hadith phrase, then compare the source details and references before treating a match as trusted.</div>`}
      </section>
    </section>
  `;
}

function renderLibraryScreen() {
  const saved = bookmarkedRecords();

  return `
    <section class="screen">
      <header class="top-header">
        <div>
          <p class="kicker">Library</p>
          <h1 class="large-title">Saved reading</h1>
          <p class="support-copy">Bookmarks, reminder preferences, and the trust center live here without cluttering the main experience.</p>
        </div>
      </header>

      <section class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">Saved hadith</h2>
            <p class="section-note">${saved.length} in your local library</p>
          </div>
        </div>
        ${saved.length ? `<div class="library-stack">${saved.map((record) => renderSavedCard(record)).join("")}</div>` : `<div class="empty-state">When you save a hadith, it stays on this device and shows up here for later study.</div>`}
      </section>

      <section class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">Preferences</h2>
            <p class="section-note">Keep the app hadith-only while still giving users useful control.</p>
          </div>
        </div>
        <div class="group-card">
          ${renderGroupRow("Hadith reminders", reminderSummary(), "Permission, frequency, and a test reminder.", "open-sheet", "notifications", renderIcon("bell-small"))}
          ${renderGroupRow("How we verify", `v${escapeHtml(state.manifest.version)}`, "Canonical collections and editorial boundaries.", "open-sheet", "trust", renderIcon("shield"))}
        </div>
      </section>
    </section>
  `;
}

function renderSheet() {
  return `
    <div class="sheet-backdrop"></div>
    <section class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-grabber"></div>
      <div class="sheet-body">${renderSheetBody()}</div>
    </section>
  `;
}

function renderSheetBody() {
  switch (state.sheet?.type) {
    case "hadith":
      return renderHadithSheet(state.sheet.id);
    case "trust":
      return renderTrustSheet();
    case "notifications":
      return renderNotificationsSheet();
    default:
      return "";
  }
}

function renderHadithSheet(id) {
  const match = state.records.find((item) => item.id === id);
  const record = match ? enrichRecord(match) : featuredHadith(state.records, state.now);
  const references = record.scholarReferences || [];

  return `
    <header class="sheet-header">
      <div>
        <h2 class="sheet-title">${escapeHtml(record.collectionDisplay)}</h2>
        <p class="sheet-subtitle">Hadith ${record.hadithNumber} · ${escapeHtml(record.chapterTitle)}</p>
      </div>
      <button class="close-button" data-action="close-sheet" aria-label="Close sheet">${renderIcon("close")}</button>
    </header>

    <section class="detail-card">
      <div class="reading-head">
        <div>
          <p class="card-label">Narrated by ${escapeHtml(record.narrator)}</p>
          <h3 class="card-title">${escapeHtml(record.bookTitle)}</h3>
        </div>
        <button class="trailing-action" data-action="toggle-bookmark" data-id="${record.id}" aria-label="Save hadith">
          ${state.bookmarks.includes(record.id) ? renderIcon("saved") : renderIcon("save")}
        </button>
      </div>
      <div class="badge-row">
        <span class="badge accent">${escapeHtml(record.collectionDisplay)}</span>
        <span class="badge success">${escapeHtml(record.grade)}</span>
        <span class="badge neutral">#${record.globalNumber}</span>
      </div>
      <p class="hadith-arabic">${escapeHtml(record.arabicText)}</p>
      <p class="hadith-english">${escapeHtml(record.englishText)}</p>
    </section>

    <section class="info-card">
      <div class="info-list">
        ${renderInfoRow("Source edition", record.sourceEdition)}
        ${renderInfoRow("Translation", record.translationSource)}
        ${renderInfoRow("Verified at", formatDate(record.verifiedAt))}
        ${renderInfoRow("Checksum", record.checksum)}
      </div>
    </section>

    <section class="section-block">
      <div class="section-header">
        <div>
          <h3 class="section-title">References</h3>
          <p class="section-note">BinBaz is treated as a trust reference and Dorar as a methodology layer.</p>
        </div>
      </div>
      ${references.length ? `<div class="reference-list">${references.map(renderReferenceCard).join("")}</div>` : `<div class="empty-state">This seed record does not have a linked external reference yet. The trust center still explains the verification boundaries for the bundle.</div>`}
    </section>
  `;
}

function renderTrustSheet() {
  return `
    <header class="sheet-header">
      <div>
        <h2 class="sheet-title">How we verify</h2>
        <p class="sheet-subtitle">Clear boundaries matter more than decorative claims.</p>
      </div>
      <button class="close-button" data-action="close-sheet" aria-label="Close sheet">${renderIcon("close")}</button>
    </header>

    <section class="info-card">
      <div class="info-list">
        ${renderInfoRow("Canonical text", state.manifest.canonicalCollections.join(", "))}
        ${renderInfoRow("Reference layer", state.manifest.verificationSources.join(", "))}
        ${renderInfoRow("Content version", state.manifest.version)}
        ${renderInfoRow("Updated", formatDate(state.manifest.updatedAt))}
      </div>
    </section>

    <section class="detail-card">
      <p class="card-label">Editorial boundary</p>
      <h3 class="card-title">No AI interpretations in this prototype</h3>
      <p class="card-copy">The bundle only presents canonical hadith text, editorial metadata, and clearly labeled external references. It does not generate new religious explanations.</p>
    </section>

    <section class="section-block">
      <div class="section-header">
        <div>
          <h3 class="section-title">Notes</h3>
          <p class="section-note">These notes come from the bundled content manifest.</p>
        </div>
      </div>
      <div class="group-card">
        ${state.manifest.notes.map((note) => `<div class="group-row"><div class="row-copy"><p class="row-title">${escapeHtml(note)}</p></div></div>`).join("")}
      </div>
    </section>

    <section class="section-block">
      <div class="section-header">
        <div>
          <h3 class="section-title">What is authoritative</h3>
        </div>
      </div>
      <div class="group-card">
        <div class="group-row">
          <span class="row-icon">ق</span>
          <div class="row-copy">
            <p class="row-title">Canonical hadith text</p>
            <p class="row-subtitle">Bukhari and Muslim are the reading core in this version.</p>
          </div>
        </div>
        <div class="group-row">
          <span class="row-icon">ب</span>
          <div class="row-copy">
            <p class="row-title">BinBaz</p>
            <p class="row-subtitle">Used as a visible trust reference when presenting authenticity context.</p>
          </div>
        </div>
        <div class="group-row">
          <span class="row-icon">د</span>
          <div class="row-copy">
            <p class="row-title">Dorar</p>
            <p class="row-subtitle">Used as an operational methodology and lookup layer where references are attached.</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderNotificationsSheet() {
  const permission = state.notificationPermission;
  const notificationSupported = isNotificationSupported();

  return `
    <header class="sheet-header">
      <div>
        <h2 class="sheet-title">Hadith reminders</h2>
        <p class="sheet-subtitle">Let the reader surface hadith at a rate the user actually wants.</p>
      </div>
      <button class="close-button" data-action="close-sheet" aria-label="Close sheet">${renderIcon("close")}</button>
    </header>

    <section class="preference-panel">
      <div class="preference-card">
        <div class="switch-row">
          <div class="switch-copy">
            <strong>Enable reminders</strong>
            <span>Choose whether the app should deliver hadith reminders at your selected rate.</span>
          </div>
          <button class="switch ${state.notifications.enabled ? "on" : ""}" data-action="toggle-reminders" aria-label="Toggle hadith reminders"></button>
        </div>
      </div>

      <div class="preference-card">
        <div class="switch-row">
          <div class="switch-copy">
            <strong>Notification permission</strong>
            <span>Installed web apps on iPhone can request notification permission, but this prototype still has browser limits.</span>
          </div>
          <span class="permission-pill ${permission}">${escapeHtml(permissionLabel(permission))}</span>
        </div>
        <div class="badge-row">
          <button class="secondary-button" data-action="request-notifications" ${notificationSupported ? "" : "disabled"}>Allow notifications</button>
          <button class="secondary-button" data-action="send-test-notification" ${permission === "granted" ? "" : "disabled"}>Send test</button>
        </div>
      </div>

      <div class="preference-card">
        <div class="switch-copy">
          <strong>Reminder rate</strong>
          <span>Keep the schedule simple so it is easy to validate before moving back to native iOS.</span>
        </div>
        <div class="segment-strip" style="margin-top: 14px;">
          ${REMINDER_OPTIONS.map((option) => renderFrequencyChip(option)).join("")}
        </div>
      </div>

      <div class="preference-card">
        <p class="note">Prototype limitation: this hosted web build can request permission and fire reminder notifications while the installed app is open or reopened, but true native-style background local scheduling will come in the native iOS build.</p>
      </div>
    </section>
  `;
}

function renderCollectionCard(collectionId) {
  const records = state.records.filter((record) => record.collection === collectionId);
  const latest = records[0];

  return `
    <button class="collection-card" data-action="jump-collection" data-value="${collectionId}">
      <p class="card-label">Collection</p>
      <strong>${escapeHtml(collectionDisplay(collectionId))}</strong>
      <span>${records.length} seed hadith${records.length === 1 ? "" : "s"}</span>
      <span>${latest ? escapeHtml(latest.bookTitle) : "Ready for reading"}</span>
    </button>
  `;
}

function renderGroupRow(title, value, subtitle, action, sheetValue, iconMarkup) {
  return `
    <button class="group-row" data-action="${action}" data-value="${sheetValue}">
      <span class="row-icon">${iconMarkup}</span>
      <div class="row-copy">
        <p class="row-title">${escapeHtml(title)}</p>
        <p class="row-subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <span class="row-value">${escapeHtml(value)}</span>
      <span class="disclosure">${renderIcon("chevron")}</span>
    </button>
  `;
}

function renderResultCard(record) {
  return `
    <article class="result-card">
      <div class="result-main">
        <button class="result-symbol" data-action="open-hadith" data-id="${record.id}" aria-label="Open hadith">${record.collection === "bukhari" ? "ب" : "م"}</button>
        <button class="result-text" data-action="open-hadith" data-id="${record.id}" aria-label="Open hadith">
          <h3 class="result-title">${escapeHtml(record.chapterTitle)}</h3>
          <p class="result-meta">${escapeHtml(record.collectionDisplay)} · ${escapeHtml(record.narrator)}</p>
          <p class="result-arabic">${escapeHtml(trimText(record.arabicText, 120))}</p>
        </button>
        <button class="row-save" data-action="toggle-bookmark" data-id="${record.id}" aria-label="Save hadith">${state.bookmarks.includes(record.id) ? renderIcon("saved") : renderIcon("save")}</button>
      </div>
    </article>
  `;
}

function renderVerificationCard(item) {
  return `
    <article class="result-card">
      <div class="result-main">
        <button class="result-symbol" data-action="open-hadith" data-id="${item.record.id}" aria-label="Open hadith">${Math.round(item.score * 100)}</button>
        <button class="result-text" data-action="open-hadith" data-id="${item.record.id}" aria-label="Open hadith">
          <h3 class="result-title">${escapeHtml(item.record.collectionDisplay)} · Hadith ${item.record.hadithNumber}</h3>
          <p class="result-meta">${escapeHtml(item.record.chapterTitle)} · Score ${Math.round(item.score * 100)}%</p>
          <p class="result-arabic">${escapeHtml(trimText(item.record.arabicText, 120))}</p>
        </button>
        <button class="row-save" data-action="toggle-bookmark" data-id="${item.record.id}" aria-label="Save hadith">${state.bookmarks.includes(item.record.id) ? renderIcon("saved") : renderIcon("save")}</button>
      </div>
    </article>
  `;
}

function renderSavedCard(record) {
  return `
    <article class="saved-card">
      <div class="saved-main">
        <button class="result-symbol" data-action="open-hadith" data-id="${record.id}" aria-label="Open hadith">${record.collection === "bukhari" ? "ب" : "م"}</button>
        <button class="saved-text" data-action="open-hadith" data-id="${record.id}" aria-label="Open hadith">
          <h3 class="saved-title">${escapeHtml(record.displayTitle)}</h3>
          <p class="saved-meta">${escapeHtml(record.collectionDisplay)} · ${escapeHtml(record.narrator)}</p>
          <p class="saved-arabic">${escapeHtml(trimText(record.arabicText, 96))}</p>
        </button>
        <button class="row-save" data-action="toggle-bookmark" data-id="${record.id}" aria-label="Remove bookmark">${renderIcon("saved")}</button>
      </div>
    </article>
  `;
}

function renderReferenceCard(reference) {
  return `
    <a class="reference-card" href="${escapeAttribute(reference.urlString)}" target="_blank" rel="noreferrer">
      <strong>${escapeHtml(reference.title)}</strong>
      <span>${escapeHtml(reference.summary || reference.referenceType)}</span>
    </a>
  `;
}

function renderInfoRow(label, value) {
  return `
    <div class="info-row">
      <span class="info-label">${escapeHtml(label)}</span>
      <span class="info-value">${escapeHtml(value)}</span>
    </div>
  `;
}

function renderTabButton(id, label, iconMarkup) {
  return `
    <button class="tab-button ${state.tab === id ? "active" : ""}" data-action="switch-tab" data-value="${id}" aria-label="${label}">
      ${iconMarkup}
      <span>${label}</span>
    </button>
  `;
}

function renderFilterChip(id, label) {
  return `
    <button class="filter-chip ${state.searchCollection === id ? "active" : ""}" data-action="set-collection" data-value="${id}">${escapeHtml(label)}</button>
  `;
}

function renderFrequencyChip(option) {
  return `
    <button class="segment-chip ${state.notifications.frequency === option.id ? "active" : ""}" data-action="set-frequency" data-value="${option.id}">${escapeHtml(option.label)}</button>
  `;
}

function renderIcon(name) {
  const icons = {
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4.5 10.2 12 4l7.5 6.2v8.3a1.5 1.5 0 0 1-1.5 1.5h-3.9v-5.1a2.1 2.1 0 0 0-4.2 0V20H6a1.5 1.5 0 0 1-1.5-1.5z" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5" stroke-linecap="round"/></svg>`,
    verify: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3.5 5.5 6.3v5.5c0 4.1 2.6 7.8 6.5 8.7 3.9-.9 6.5-4.6 6.5-8.7V6.3z" stroke-linejoin="round"/><path d="m9.4 11.8 1.9 1.9 3.6-4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    library: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5.5 5.5A2.5 2.5 0 0 1 8 3h9a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5.5a2.5 2.5 0 0 1 2.5-2.5Z" stroke-linejoin="round"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6.8 16.5h10.4l-1.1-1.8V10a4.1 4.1 0 0 0-8.2 0v4.7z" stroke-linejoin="round"/><path d="M10.2 18.2a1.9 1.9 0 0 0 3.6 0" stroke-linecap="round"/></svg>`,
    "bell-small": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M7.1 15.8h9.8l-1-1.6v-4a3.9 3.9 0 1 0-7.8 0v4z" stroke-linejoin="round"/><path d="M10.5 17.4a1.6 1.6 0 0 0 3 0" stroke-linecap="round"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3.5 5.8 6v5.4c0 4 2.5 7.4 6.2 8.3 3.7-.9 6.2-4.3 6.2-8.3V6z" stroke-linejoin="round"/><path d="m9.8 12.2 1.7 1.7 3-3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v13l-7.5-4.1L4.5 19V6A1.5 1.5 0 0 1 6 4.5Z" stroke-linejoin="round"/></svg>`,
    saved: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"><path d="M6 4.5h12A1.5 1.5 0 0 1 19.5 6v13L12 14.9 4.5 19V6A1.5 1.5 0 0 1 6 4.5Z"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m7 7 10 10M17 7 7 17" stroke-linecap="round"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };

  return icons[name] || "";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function applyStandaloneClass() {
  document.body.classList.toggle("standalone", state.standalone);
}

function closeSheet() {
  state.sheet = null;
}

function toggleBookmark(id) {
  const set = new Set(state.bookmarks);
  if (set.has(id)) {
    set.delete(id);
    showToast("Removed from Library");
  } else {
    set.add(id);
    showToast("Saved to Library");
  }
  state.bookmarks = Array.from(set);
  persistAppState();
}

function bookmarkedRecords() {
  const bookmarkedSet = new Set(state.bookmarks);
  return state.records.filter((record) => bookmarkedSet.has(record.id)).map(enrichRecord);
}

function featuredHadith(records, date) {
  const enriched = records.map(enrichRecord);
  return enriched[dayOfYear(date) % enriched.length] || enriched[0];
}

function enrichRecord(record) {
  return {
    ...record,
    collectionDisplay: collectionDisplay(record.collection),
    displayTitle: `${collectionDisplay(record.collection)} · Hadith ${record.hadithNumber}`
  };
}

function collectionDisplay(collection) {
  return collection === "bukhari" ? "Sahih al-Bukhari" : "Sahih Muslim";
}

function searchRecords(records, query, collection) {
  const normalizedQuery = normalizeText(query);
  const filtered = records
    .filter((record) => collection === "all" || record.collection === collection)
    .map(enrichRecord);

  if (!normalizedQuery) {
    return filtered.slice(0, 6);
  }

  return filtered
    .map((record) => {
      const candidate = normalizeText([
        record.arabicText,
        record.englishText,
        record.narrator,
        record.chapterTitle,
        record.bookTitle,
        record.collectionDisplay
      ].join(" "));
      return { record, score: tokenScore(normalizedQuery, candidate) };
    })
    .filter((item) => item.score > 0.16)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.record)
    .slice(0, 10);
}

function verifyRecords(records, text) {
  const normalizedQuery = normalizeText(text);
  if (!normalizedQuery) {
    return [];
  }

  return records
    .map(enrichRecord)
    .map((record) => {
      const score = Math.max(
        tokenScore(normalizedQuery, normalizeText(record.arabicText)),
        tokenScore(normalizedQuery, normalizeText(record.englishText))
      );
      return { record, score };
    })
    .filter((item) => item.score > 0.18)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);
}

function tokenScore(query, candidate) {
  if (!query || !candidate) {
    return 0;
  }

  if (candidate.includes(query)) {
    return 1;
  }

  const queryTokens = Array.from(new Set(query.split(" "))).filter(Boolean);
  const candidateTokens = new Set(candidate.split(" "));
  let shared = 0;

  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.max(1, queryTokens.length);
}

function reminderSummary() {
  if (!state.notifications.enabled) {
    return "Off";
  }

  return reminderOption(state.notifications.frequency).label;
}

function reminderOption(id) {
  return REMINDER_OPTIONS.find((option) => option.id === id) || REMINDER_OPTIONS[0];
}

function isNotificationSupported() {
  return "Notification" in window;
}

function notificationPermissionState() {
  if (!isNotificationSupported()) {
    return "unsupported";
  }

  return Notification.permission || "default";
}

function permissionLabel(permission) {
  switch (permission) {
    case "granted":
      return "Allowed";
    case "denied":
      return "Blocked";
    case "unsupported":
      return "Unavailable";
    default:
      return "Not allowed";
  }
}

async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    showToast("Notifications are unavailable in this browser.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    state.notificationPermission = permission;
    if (permission === "granted") {
      state.notifications.enabled = true;
      persistAppState();
      showToast("Reminders enabled");
    } else if (permission === "denied") {
      state.notifications.enabled = false;
      persistAppState();
      showToast("Notifications blocked");
    }
  } catch {
    showToast("Notification permission could not be requested");
  }
}

async function toggleReminders() {
  if (state.notifications.enabled) {
    state.notifications.enabled = false;
    persistAppState();
    showToast("Reminders paused");
    return;
  }

  if (state.notificationPermission !== "granted") {
    await requestNotificationPermission();
    return;
  }

  state.notifications.enabled = true;
  persistAppState();
  showToast("Reminders enabled");
}

async function maybeSendDueReminder() {
  if (!state.records.length || !state.notifications.enabled || state.notificationPermission !== "granted") {
    return false;
  }

  const frequency = reminderOption(state.notifications.frequency);
  const lastSentAt = state.notifications.lastSentAt ? new Date(state.notifications.lastSentAt) : null;

  if (lastSentAt && state.now.getTime() - lastSentAt.getTime() < frequency.intervalMs) {
    return false;
  }

  return sendReminderNotification({ test: false, force: true, quiet: true });
}

async function sendReminderNotification({ test = false, force = false, quiet = false } = {}) {
  if (!state.records.length || !isNotificationSupported() || state.notificationPermission !== "granted") {
    if (!quiet) {
      showToast("Allow notifications first");
    }
    return false;
  }

  const record = force ? featuredHadith(state.records, state.now) : featuredHadith(state.records, new Date());
  const title = test ? "مجتهد · Test reminder" : "مجتهد · New hadith";
  const body = trimText(record.arabicText, 88);
  const options = {
    body,
    dir: "auto",
    lang: "ar",
    tag: test ? "mujtahid-test" : `hadith-${record.id}`,
    icon: "./assets/icon-192.png",
    badge: "./assets/icon-192.png",
    data: {
      hadithId: record.id,
      url: `./?hadith=${record.id}`
    }
  };

  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null;
    if (registration && registration.showNotification) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }

    state.notifications.lastSentAt = new Date().toISOString();
    persistAppState();

    if (!quiet) {
      showToast(test ? "Test reminder sent" : "Reminder delivered");
    }

    return true;
  } catch {
    if (!quiet) {
      showToast("Reminder could not be delivered");
    }
    return false;
  }
}

function consumeLaunchHadith() {
  if (!state.launchHadithId) {
    return;
  }

  const exists = state.records.some((record) => record.id === state.launchHadithId);
  if (exists) {
    state.sheet = { type: "hadith", id: state.launchHadithId };
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("hadith");
  history.replaceState({}, "", url);
  state.launchHadithId = "";
}

function persistAppState() {
  localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(state.bookmarks));
  localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(state.notifications));
  localStorage.setItem(STORAGE_KEYS.searchCollection, state.searchCollection);
}

function showToast(message) {
  state.toast = message;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 1800);
  render();
}

function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function normalizeText(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimText(text, maxLength) {
  const value = String(text || "");
  return value.length <= maxLength ? value : `${value.slice(0, maxLength).trim()}...`;
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function loadValue(key, fallback) {
  const value = localStorage.getItem(key);
  return value == null ? fallback : value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
