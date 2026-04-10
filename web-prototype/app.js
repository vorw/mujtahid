const STORAGE_KEYS = {
  bookmarks: "hadith-prototype.bookmarks",
  cityPreset: "hadith-prototype.city-preset",
  methodOverride: "hadith-prototype.method-override",
  juristicMethod: "hadith-prototype.juristic-method",
  offsets: "hadith-prototype.offsets",
  simulatedHeading: "hadith-prototype.simulated-heading"
};

const KAABA = { latitude: 21.422487, longitude: 39.826206 };

const PRAYER_EVENTS = [
  { id: "fajr", label: "Fajr" },
  { id: "sunrise", label: "Sunrise" },
  { id: "dhuhr", label: "Dhuhr" },
  { id: "asr", label: "Asr" },
  { id: "maghrib", label: "Maghrib" },
  { id: "isha", label: "Isha" }
];

const METHOD_LABELS = {
  ummAlQura: "Umm al-Qura",
  muslimWorldLeague: "Muslim World League",
  egyptian: "Egyptian General Authority",
  karachi: "Karachi",
  northAmerica: "North America",
  gulfRegion: "Gulf Region",
  singapore: "Singapore",
  turkey: "Turkey",
  morocco: "Morocco"
};

const METHOD_SHORT = {
  ummAlQura: "Umm al-Qura",
  muslimWorldLeague: "MWL",
  egyptian: "Egypt",
  karachi: "Karachi",
  northAmerica: "NA",
  gulfRegion: "Gulf",
  singapore: "Singapore",
  turkey: "Turkey",
  morocco: "Morocco"
};

const JURISTIC_LABELS = {
  standard: "Standard",
  hanafi: "Hanafi"
};

const CITY_PRESETS = [
  { id: "riyadh", label: "Riyadh, Saudi Arabia", countryCode: "SA", timeZone: "Asia/Riyadh", latitude: 24.7136, longitude: 46.6753 },
  { id: "makkah", label: "Makkah, Saudi Arabia", countryCode: "SA", timeZone: "Asia/Riyadh", latitude: 21.3891, longitude: 39.8579 },
  { id: "madinah", label: "Madinah, Saudi Arabia", countryCode: "SA", timeZone: "Asia/Riyadh", latitude: 24.5247, longitude: 39.5692 },
  { id: "dubai", label: "Dubai, United Arab Emirates", countryCode: "AE", timeZone: "Asia/Dubai", latitude: 25.2048, longitude: 55.2708 },
  { id: "cairo", label: "Cairo, Egypt", countryCode: "EG", timeZone: "Africa/Cairo", latitude: 30.0444, longitude: 31.2357 },
  { id: "istanbul", label: "Istanbul, Turkey", countryCode: "TR", timeZone: "Europe/Istanbul", latitude: 41.0082, longitude: 28.9784 },
  { id: "casablanca", label: "Casablanca, Morocco", countryCode: "MA", timeZone: "Africa/Casablanca", latitude: 33.5731, longitude: -7.5898 },
  { id: "london", label: "London, United Kingdom", countryCode: "GB", timeZone: "Europe/London", latitude: 51.5072, longitude: -0.1276 },
  { id: "newyork", label: "New York, United States", countryCode: "US", timeZone: "America/New_York", latitude: 40.7128, longitude: -74.0060 },
  { id: "singapore", label: "Singapore", countryCode: "SG", timeZone: "Asia/Singapore", latitude: 1.3521, longitude: 103.8198 }
];

const state = {
  loading: true,
  error: "",
  records: [],
  manifest: null,
  tab: "home",
  sheet: null,
  searchQuery: "",
  selectedCollection: "all",
  verifyText: "",
  bookmarks: loadJSON(STORAGE_KEYS.bookmarks, []),
  selectedCity: loadValue(STORAGE_KEYS.cityPreset, "riyadh"),
  browserLocation: null,
  useBrowserLocation: false,
  methodOverride: loadValue(STORAGE_KEYS.methodOverride, ""),
  juristicMethod: loadValue(STORAGE_KEYS.juristicMethod, "standard"),
  offsets: loadJSON(STORAGE_KEYS.offsets, {}),
  simulatedHeading: Number(loadValue(STORAGE_KEYS.simulatedHeading, "32")),
  sensorHeading: null,
  sensorAvailable: false,
  sensorPermission: "idle",
  qiblaMode: "compass",
  now: new Date(),
  standalone: isStandalone()
};

const root = document.getElementById("app");

applyStandaloneClass();

async function initialize() {
  registerServiceWorker();
  try {
    const [recordsResponse, manifestResponse] = await Promise.all([
      fetch("../HadithCore/Resources/SeedHadith.json"),
      fetch("../HadithCore/Resources/ContentManifest.json")
    ]);

    if (!recordsResponse.ok || !manifestResponse.ok) {
      throw new Error("Prototype data could not be loaded.");
    }

    state.records = await recordsResponse.json();
    state.manifest = await manifestResponse.json();
  } catch (error) {
    state.error = error.message || "The prototype failed to load.";
  } finally {
    state.loading = false;
    render();
  }
}

root.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) {
    if (event.target.classList.contains("sheet-backdrop")) {
      closeSheet();
    }
    return;
  }

  const { action, value, id, eventId } = target.dataset;

  switch (action) {
    case "switch-tab":
      state.tab = value;
      closeSheet();
      break;
    case "open-sheet":
      state.sheet = { type: value, id };
      break;
    case "close-sheet":
      closeSheet();
      break;
    case "toggle-bookmark":
      toggleBookmark(id);
      break;
    case "set-city":
      state.selectedCity = getFieldValue("city-select") || value || state.selectedCity;
      state.useBrowserLocation = false;
      persistSettings();
      break;
    case "use-browser-location":
      await requestBrowserLocation();
      break;
    case "clear-browser-location":
      state.useBrowserLocation = false;
      break;
    case "set-qibla-mode":
      state.qiblaMode = value;
      break;
    case "set-heading-mode":
      state.sensorPermission = "simulated";
      break;
    case "enable-sensor":
      await enableOrientationSensor();
      break;
    case "search-submit":
      state.searchQuery = getFieldValue("search-field");
      state.selectedCollection = getFieldValue("collection-field");
      break;
    case "verify-submit":
      state.verifyText = getFieldValue("verify-field");
      break;
    case "use-daily-hadith":
      state.verifyText = featuredHadith(state.records, state.now)?.arabicText || "";
      break;
    case "set-method":
      state.methodOverride = getFieldValue("method-select");
      persistSettings();
      break;
    case "use-region-default":
      state.methodOverride = "";
      persistSettings();
      break;
    case "set-juristic":
      state.juristicMethod = getFieldValue("juristic-select");
      persistSettings();
      break;
    case "adjust-offset":
      adjustOffset(eventId, Number(value));
      break;
    default:
      break;
  }

  render();
});

root.addEventListener("change", (event) => {
  const target = event.target;
  if (target.id === "heading-slider") {
    state.simulatedHeading = Number(target.value);
    persistSettings();
    render();
  }
});

setInterval(() => {
  if (document.activeElement && /input|textarea|select/i.test(document.activeElement.tagName)) {
    return;
  }
  state.now = new Date();
  render();
}, 30000);

window.addEventListener("deviceorientationabsolute", handleOrientation, true);
window.addEventListener("deviceorientation", handleOrientation, true);
window.matchMedia("(display-mode: standalone)").addEventListener?.("change", () => {
  state.standalone = isStandalone();
  applyStandaloneClass();
  render();
});

initialize();

function render() {
  if (state.loading) {
    root.innerHTML = `
      <div class="screen">
        <section class="screen-page stack">
          <article class="card hero-card">
            <p class="card-eyebrow">Loading</p>
            <h2 class="card-title">Preparing the prototype...</h2>
            <p class="card-subtitle">Reading hadith content, prayer rules, and qibla logic.</p>
          </article>
        </section>
      </div>
    `;
    return;
  }

  if (state.error) {
    root.innerHTML = `
      <div class="screen">
        <section class="screen-page stack">
          <article class="card hero-card">
            <p class="card-eyebrow">Error</p>
            <h2 class="card-title">The prototype could not start.</h2>
            <p class="card-subtitle">${escapeHtml(state.error)}</p>
          </article>
        </section>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="screen">
      ${renderCurrentScreen()}
    </div>
    <nav class="bottom-nav" aria-label="Primary">
      ${renderNavButton("home", "Home")}
      ${renderNavButton("search", "Search")}
      ${renderNavButton("verify", "Verify")}
      ${renderNavButton("library", "Library")}
    </nav>
    ${state.sheet ? renderSheet() : ""}
  `;
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

function renderCurrentScreen() {
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
  const prayerDay = currentPrayerDay();
  const nextPrayer = prayerDay ? getUpcomingPrayer(prayerDay) : null;

  return `
    <section class="screen-page stack">
      <header class="page-header">
        <p class="eyebrow">HadithApp</p>
        <h1 class="page-title">Trust-first daily study.</h1>
        <p class="page-subtitle">
          A mobile prototype for validating the native iOS experience before paying for Apple tooling.
        </p>
      </header>

      <article class="card hero-card">
        <div class="card-title-row">
          <div>
            <p class="card-eyebrow">Daily hadith</p>
            <h2 class="card-title">${escapeHtml(daily.displayTitle)}</h2>
            <p class="card-subtitle">${escapeHtml(daily.chapterTitle)}</p>
          </div>
          <button class="icon-button" data-action="toggle-bookmark" data-id="${daily.id}" aria-label="Save hadith">
            ${state.bookmarks.includes(daily.id) ? "Saved" : "Save"}
          </button>
        </div>
        <div class="badge-row">
          <span class="badge badge-brand">${escapeHtml(daily.collectionDisplay)}</span>
          <span class="badge badge-success">Sahih</span>
          <span class="badge badge-gold">No ads</span>
        </div>
        <p class="hadith-arabic">${escapeHtml(daily.arabicText)}</p>
        <p class="hadith-english">${escapeHtml(daily.englishText)}</p>
        <div class="actions">
          <button class="button" data-action="open-sheet" data-value="hadith" data-id="${daily.id}">Open hadith</button>
          <button class="ghost-button" data-action="open-sheet" data-value="trust">How we verify</button>
        </div>
      </article>

      <article class="card">
        <div class="card-title-row">
          <div>
            <p class="card-eyebrow">Today</p>
            <h2 class="card-title">Prayer snapshot</h2>
            <p class="card-subtitle">${escapeHtml(activeLocation().label)}</p>
          </div>
          ${prayerDay ? badgeForTrust(prayerDay.locationTrustState) : `<span class="badge badge-warning">Prototype</span>`}
        </div>
        ${
          prayerDay && nextPrayer
            ? `
              <div class="kpi-grid">
                <div class="kpi">
                  <div class="kpi-label">Next prayer</div>
                  <div class="kpi-value">${escapeHtml(nextPrayer.label)}</div>
                </div>
                <div class="kpi">
                  <div class="kpi-label">Time</div>
                  <div class="kpi-value">${escapeHtml(formatMinutes(nextPrayer.minutes))}</div>
                </div>
                <div class="kpi">
                  <div class="kpi-label">In</div>
                  <div class="kpi-value">${escapeHtml(formatDuration(nextPrayer.remainingMinutes))}</div>
                </div>
              </div>
            `
            : `<div class="empty-state">Pick a city preset or use browser location to generate prayer times.</div>`
        }
      </article>

      <section class="stack">
        <div class="card-title-row">
          <div>
            <p class="card-eyebrow">Utilities</p>
            <h2 class="card-title">Supportive tools, not a cluttered super-app.</h2>
          </div>
        </div>
        <div class="utility-grid">
          <button class="utility-card" data-action="open-sheet" data-value="prayer">
            <div class="utility-kicker">Prayer</div>
            <h3 class="utility-title">Prayer Times</h3>
            <p class="utility-copy">Transparent method defaults, manual offsets, and method comparison.</p>
          </button>
          <button class="utility-card qibla" data-action="open-sheet" data-value="qibla">
            <div class="utility-kicker">Qibla</div>
            <h3 class="utility-title">Compass + map</h3>
            <p class="utility-copy">Confidence labels, simulated heading, and world-map verification.</p>
          </button>
        </div>
      </section>

      <section class="stack">
        <div class="card-title-row">
          <div>
            <p class="card-eyebrow">Widgets</p>
            <h2 class="card-title">Preview how the iOS widgets could feel.</h2>
          </div>
        </div>
        <div class="widget-grid">
          ${renderDailyWidgetCard(daily)}
          ${renderPrayerWidgetCard(prayerDay, nextPrayer)}
        </div>
      </section>
    </section>
  `;
}

function renderSearchScreen() {
  const results = searchRecords(state.records, state.searchQuery, state.selectedCollection);

  return `
    <section class="screen-page stack">
      <header class="page-header">
        <p class="eyebrow">Search</p>
        <h1 class="page-title">Find hadith quickly.</h1>
        <p class="page-subtitle">Search Arabic, English, narrator, chapter, or collection.</p>
      </header>

      <article class="card">
        <div class="stack">
          <input id="search-field" class="field" type="text" placeholder="Search Arabic, English, narrator, chapter" value="${escapeAttribute(state.searchQuery)}">
          <select id="collection-field" class="select">
            <option value="all" ${state.selectedCollection === "all" ? "selected" : ""}>All collections</option>
            <option value="bukhari" ${state.selectedCollection === "bukhari" ? "selected" : ""}>Sahih al-Bukhari</option>
            <option value="muslim" ${state.selectedCollection === "muslim" ? "selected" : ""}>Sahih Muslim</option>
          </select>
          <div class="actions">
            <button class="button" data-action="search-submit">Search</button>
          </div>
        </div>
      </article>

      <section class="stack">
        <div class="card-title-row">
          <div>
            <p class="card-eyebrow">Results</p>
            <h2 class="card-title">${results.length} matches</h2>
          </div>
        </div>
        ${
          results.length
            ? `<div class="list">${results.map(renderHadithListItem).join("")}</div>`
            : `<div class="empty-state">Search across the seed bundle to test browsing and discovery flows.</div>`
        }
      </section>
    </section>
  `;
}

function renderVerifyScreen() {
  const results = verifyRecords(state.records, state.verifyText);

  return `
    <section class="screen-page stack">
      <header class="page-header">
        <p class="eyebrow">Verify</p>
        <h1 class="page-title">Check a hadith snippet.</h1>
        <p class="page-subtitle">Paste Arabic or English text to test the verification experience.</p>
      </header>

      <article class="card">
        <div class="stack">
          <textarea id="verify-field" class="textarea" placeholder="Paste text to test matching and trust presentation...">${escapeHtml(state.verifyText)}</textarea>
          <div class="actions">
            <button class="button" data-action="verify-submit">Find matches</button>
            <button class="ghost-button" data-action="use-daily-hadith">Use daily hadith</button>
          </div>
        </div>
      </article>

      <section class="stack">
        <div class="card-title-row">
          <div>
            <p class="card-eyebrow">Matches</p>
            <h2 class="card-title">${results.length ? `${results.length} likely results` : "No confident result yet"}</h2>
          </div>
        </div>
        ${
          results.length
            ? `<div class="list">${results.map(renderVerificationResult).join("")}</div>`
            : `<div class="empty-state">Longer phrases work better. This seed bundle uses the same ranking idea as the native prototype.</div>`
        }
      </section>
    </section>
  `;
}

function renderLibraryScreen() {
  const bookmarked = state.records.filter((record) => state.bookmarks.includes(record.id));
  const prayerDay = currentPrayerDay();

  return `
    <section class="screen-page stack">
      <header class="page-header">
        <p class="eyebrow">Library</p>
        <h1 class="page-title">Saved study space.</h1>
        <p class="page-subtitle">Bookmarks, prayer profile, and trust references in one calm place.</p>
      </header>

      <article class="card">
        <div class="card-title-row">
          <div>
            <p class="card-eyebrow">Bookmarks</p>
            <h2 class="card-title">${bookmarked.length} saved hadith</h2>
          </div>
        </div>
        ${
          bookmarked.length
            ? `<div class="list">${bookmarked.map(renderHadithListItem).join("")}</div>`
            : `<div class="empty-state">Save hadith from Home, Search, or Verify to test the library flow.</div>`
        }
      </article>

      <article class="card">
        <div class="card-title-row">
          <div>
            <p class="card-eyebrow">Prayer profile</p>
            <h2 class="card-title">${escapeHtml(activeLocation().label)}</h2>
          </div>
          <button class="ghost-button" data-action="open-sheet" data-value="prayer">Open prayer tools</button>
        </div>
        ${
          prayerDay
            ? `
              <div class="info-grid">
                ${renderInfoRow("Method", prayerDay.methodLabel)}
                ${renderInfoRow("Juristic", JURISTIC_LABELS[prayerDay.juristicMethod])}
                ${renderInfoRow("Trust", labelForLocationTrust(prayerDay.locationTrustState))}
                ${renderInfoRow("Calculation", prayerDay.calculationVersion)}
              </div>
            `
            : `<div class="empty-state">Choose a test city preset to see the prayer profile area populate.</div>`
        }
      </article>

      <article class="card">
        <div class="card-title-row">
          <div>
            <p class="card-eyebrow">Trust center</p>
            <h2 class="card-title">Visible editorial boundaries.</h2>
            <p class="card-subtitle">Show users what is canonical and what is operational metadata.</p>
          </div>
        </div>
        <div class="actions">
          <button class="button secondary" data-action="open-sheet" data-value="trust">Open trust center</button>
        </div>
      </article>
    </section>
  `;
}

function renderSheet() {
  return `
    <div class="sheet-backdrop"></div>
    <section class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-grabber"></div>
      <div class="sheet-body">
        ${renderSheetBody()}
      </div>
    </section>
  `;
}

function renderSheetBody() {
  switch (state.sheet?.type) {
    case "hadith":
      return renderHadithSheet(state.sheet.id);
    case "trust":
      return renderTrustSheet();
    case "prayer":
      return renderPrayerSheet();
    case "qibla":
      return renderQiblaSheet();
    default:
      return "";
  }
}

function renderHadithSheet(id) {
  const hadith = state.records.find((item) => item.id === id);
  if (!hadith) {
    return `
      <div class="sheet-head">
        <div>
          <p class="eyebrow">Hadith</p>
          <h2 class="sheet-title">Record missing</h2>
        </div>
        <button class="icon-button" data-action="close-sheet">Close</button>
      </div>
    `;
  }

  return `
    <div class="sheet-head">
      <div>
        <p class="eyebrow">Hadith detail</p>
        <h2 class="sheet-title">${escapeHtml(collectionShort(hadith.collection))} ${hadith.hadithNumber}</h2>
        <p class="muted">${escapeHtml(hadith.chapterTitle)}</p>
      </div>
      <button class="icon-button" data-action="close-sheet">Close</button>
    </div>

    <article class="sheet-card card">
      <div class="badge-row">
        <span class="badge badge-brand">${escapeHtml(collectionDisplay(hadith.collection))}</span>
        <span class="badge badge-success">${escapeHtml(hadith.grade)}</span>
      </div>
      <p class="hadith-arabic">${escapeHtml(hadith.arabicText)}</p>
      <p class="hadith-english">${escapeHtml(hadith.englishText)}</p>
      <div class="actions">
        <button class="button secondary" data-action="toggle-bookmark" data-id="${hadith.id}">
          ${state.bookmarks.includes(hadith.id) ? "Remove bookmark" : "Save hadith"}
        </button>
      </div>
    </article>

    <article class="sheet-card card">
      <div class="card-title-row">
        <div>
          <p class="card-eyebrow">Metadata</p>
          <h3 class="card-title">Canonical reference info</h3>
        </div>
      </div>
      <div class="info-grid">
        ${renderInfoRow("Book", `${hadith.bookNumber} - ${hadith.bookTitle}`)}
        ${renderInfoRow("Chapter", hadith.chapterTitle)}
        ${renderInfoRow("Narrator", hadith.narrator)}
        ${renderInfoRow("Translation", hadith.translationSource)}
        ${renderInfoRow("Checksum", hadith.checksum)}
      </div>
    </article>

    <article class="sheet-card card">
      <div class="card-title-row">
        <div>
          <p class="card-eyebrow">References</p>
          <h3 class="card-title">Linked trust material</h3>
        </div>
      </div>
      ${
        hadith.scholarReferences.length
          ? `<div class="link-list">${hadith.scholarReferences.map(renderReferenceCard).join("")}</div>`
          : `<div class="empty-state">This seed record has no hadith-specific reference attached yet. The trust center still explains the editorial model.</div>`
      }
    </article>
  `;
}

function renderTrustSheet() {
  const manifest = state.manifest;
  return `
    <div class="sheet-head">
      <div>
        <p class="eyebrow">Trust center</p>
        <h2 class="sheet-title">How we verify</h2>
        <p class="muted">Show the user where authority ends and product design begins.</p>
      </div>
      <button class="icon-button" data-action="close-sheet">Close</button>
    </div>

    <article class="sheet-card card">
      <div class="card-title-row">
        <div>
          <p class="card-eyebrow">Canonical texts</p>
          <h3 class="card-title">Bukhari and Muslim first</h3>
        </div>
      </div>
      <p class="card-subtitle">
        This prototype treats Sahih al-Bukhari and Sahih Muslim as the canonical corpus. BinBaz is shown as a trust reference,
        and Dorar is shown as an operational verification and methodology layer.
      </p>
      <div class="badge-row">
        ${manifest.canonicalCollections.map((item) => `<span class="badge badge-brand">${escapeHtml(item)}</span>`).join("")}
      </div>
    </article>

    <article class="sheet-card card">
      <div class="card-title-row">
        <div>
          <p class="card-eyebrow">Versioning</p>
          <h3 class="card-title">Content manifest</h3>
        </div>
      </div>
      <div class="info-grid">
        ${renderInfoRow("Version", manifest.version)}
        ${renderInfoRow("Updated", new Date(manifest.updatedAt).toLocaleDateString())}
      </div>
      <div class="footer-note">${manifest.notes.map((note) => escapeHtml(note)).join(" ")}</div>
    </article>

    <article class="sheet-card card">
      <div class="card-title-row">
        <div>
          <p class="card-eyebrow">Operational references</p>
          <h3 class="card-title">External source links</h3>
        </div>
      </div>
      <div class="link-list">
        <a class="link-card" href="https://binbaz.org.sa/" target="_blank" rel="noreferrer">
          <strong>BinBaz</strong>
          <span>Trust reference used to communicate authority and credibility to Sunni users.</span>
        </a>
        <a class="link-card" href="https://dorar.net/" target="_blank" rel="noreferrer">
          <strong>Dorar</strong>
          <span>Operational verification and methodology source for hadith lookup and editorial workflow.</span>
        </a>
      </div>
    </article>
  `;
}

function renderPrayerSheet() {
  const prayerDay = currentPrayerDay();
  const compareDays = comparePrayerMethods();
  const nextPrayer = prayerDay ? getUpcomingPrayer(prayerDay) : null;
  const activeMethod = activePrayerMethod();

  return `
    <div class="sheet-head">
      <div>
        <p class="eyebrow">Prayer tools</p>
        <h2 class="sheet-title">Prayer Times</h2>
        <p class="muted">${escapeHtml(activeLocation().label)}</p>
      </div>
      <button class="icon-button" data-action="close-sheet">Close</button>
    </div>

    <article class="sheet-card card">
      <div class="card-title-row">
        <div>
          <p class="card-eyebrow">Location</p>
          <h3 class="card-title">Choose a trusted test city</h3>
        </div>
        ${badgeForTrust(activeLocation().trustState)}
      </div>
      <div class="stack">
        <select id="city-select" class="select">
          ${CITY_PRESETS.map((city) => `<option value="${city.id}" ${state.selectedCity === city.id && !state.useBrowserLocation ? "selected" : ""}>${escapeHtml(city.label)}</option>`).join("")}
        </select>
        <div class="actions">
          <button class="button secondary" data-action="set-city">Use selected city</button>
          <button class="ghost-button" data-action="use-browser-location">Use browser location</button>
          ${state.useBrowserLocation ? `<button class="ghost-button" data-action="clear-browser-location">Back to preset</button>` : ""}
        </div>
      </div>
      <div class="footer-note">
        Browser location keeps the prototype free, but city presets are more reliable for testing method defaults.
      </div>
    </article>

    <article class="sheet-card card">
      <div class="card-title-row">
        <div>
          <p class="card-eyebrow">Today</p>
          <h3 class="card-title">${prayerDay ? escapeHtml(prayerDay.methodLabel) : "No prayer data yet"}</h3>
          <p class="card-subtitle">${nextPrayer ? `Next prayer: ${nextPrayer.label} at ${formatMinutes(nextPrayer.minutes)} in ${formatDuration(nextPrayer.remainingMinutes)}.` : "Pick a city or location first."}</p>
        </div>
      </div>
      ${
        prayerDay
          ? `
            <div class="info-grid">
              ${prayerDay.entries.map((entry) => renderInfoRow(entry.label, formatMinutes(entry.minutes))).join("")}
            </div>
            <div class="footer-note">${prayerDay.notes.map((note) => escapeHtml(note)).join(" ")}</div>
          `
          : `<div class="empty-state">No prayer profile is available until a test city or browser location is active.</div>`
      }
    </article>

    <article class="sheet-card card">
      <div class="card-title-row">
        <div>
          <p class="card-eyebrow">Method</p>
          <h3 class="card-title">Transparent defaults with manual control</h3>
        </div>
      </div>
      <div class="settings-grid">
        <div class="setting-row">
          <label for="method-select">Prayer method</label>
          <select id="method-select" class="select" style="max-width: 220px">
            <option value="" ${state.methodOverride === "" ? "selected" : ""}>Region default (${escapeHtml(METHOD_LABELS[defaultPrayerMethod(activeLocation().countryCode)])})</option>
            ${Object.keys(METHOD_LABELS).map((method) => `<option value="${method}" ${state.methodOverride === method ? "selected" : ""}>${escapeHtml(METHOD_LABELS[method])}</option>`).join("")}
          </select>
        </div>
        <div class="actions">
          <button class="button secondary" data-action="set-method">Apply method</button>
          ${state.methodOverride ? `<button class="ghost-button" data-action="use-region-default">Use region default</button>` : ""}
        </div>
        <div class="setting-row">
          <label for="juristic-select">Asr juristic method</label>
          <select id="juristic-select" class="select" style="max-width: 220px">
            <option value="standard" ${state.juristicMethod === "standard" ? "selected" : ""}>Standard</option>
            <option value="hanafi" ${state.juristicMethod === "hanafi" ? "selected" : ""}>Hanafi</option>
          </select>
        </div>
        <div class="actions">
          <button class="button secondary" data-action="set-juristic">Apply juristic method</button>
        </div>
      </div>
      <div class="footer-note">Active method right now: ${escapeHtml(METHOD_LABELS[activeMethod])}.</div>
    </article>

    <article class="sheet-card card">
      <div class="card-title-row">
        <div>
          <p class="card-eyebrow">Manual offsets</p>
          <h3 class="card-title">Local masjid adjustments</h3>
        </div>
      </div>
      <div class="offset-grid">
        ${PRAYER_EVENTS.map((item) => {
          const currentValue = Number(state.offsets[item.id] || 0);
          return `
            <div class="offset-row">
              <strong>${escapeHtml(item.label)}</strong>
              <button class="ghost-button" data-action="adjust-offset" data-event-id="${item.id}" data-value="-1">-</button>
              <div class="offset-value">${currentValue > 0 ? `+${currentValue}` : currentValue} min</div>
              <button class="ghost-button" data-action="adjust-offset" data-event-id="${item.id}" data-value="1">+</button>
            </div>
          `;
        }).join("")}
      </div>
    </article>

    <article class="sheet-card card">
      <div class="card-title-row">
        <div>
          <p class="card-eyebrow">Compare methods</p>
          <h3 class="card-title">Show the difference openly</h3>
        </div>
      </div>
      <div class="list">
        ${compareDays.map((day) => `
          <div class="list-item">
            <h4 class="list-title">${escapeHtml(day.methodLabel)}</h4>
            <p class="list-foot">${day.entries.map((entry) => `${entry.label} ${formatMinutes(entry.minutes)}`).join(" · ")}</p>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderQiblaSheet() {
  const qibla = currentQiblaState();
  const location = activeLocation();

  return `
    <div class="sheet-head">
      <div>
        <p class="eyebrow">Qibla tools</p>
        <h2 class="sheet-title">Qibla</h2>
        <p class="muted">${escapeHtml(location.label)}</p>
      </div>
      <button class="icon-button" data-action="close-sheet">Close</button>
    </div>

    <article class="sheet-card card">
      <div class="card-title-row">
        <div>
          <p class="card-eyebrow">Mode</p>
          <h3 class="card-title">Compass and map</h3>
          <p class="card-subtitle">If sensor confidence is weak, switch to map mode.</p>
        </div>
        ${badgeForQiblaConfidence(qibla.confidence)}
      </div>
      <div class="segmented">
        <button class="segment-button ${state.qiblaMode === "compass" ? "active" : ""}" data-action="set-qibla-mode" data-value="compass">Compass</button>
        <button class="segment-button ${state.qiblaMode === "map" ? "active" : ""}" data-action="set-qibla-mode" data-value="map">Map</button>
      </div>
      <div class="kpi-grid" style="margin-top: 14px;">
        <div class="kpi">
          <div class="kpi-label">Bearing</div>
          <div class="kpi-value">${Math.round(qibla.targetBearing)} deg</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Heading</div>
          <div class="kpi-value">${qibla.currentHeading == null ? "n/a" : `${Math.round(qibla.currentHeading)} deg`}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Offset</div>
          <div class="kpi-value">${qibla.offset == null ? "n/a" : `${Math.round(qibla.offset)} deg`}</div>
        </div>
      </div>
    </article>

    ${
      state.qiblaMode === "compass"
        ? `
          <article class="sheet-card card">
            <div class="card-title-row">
              <div>
                <p class="card-eyebrow">Compass</p>
                <h3 class="card-title">Simulate the native dial</h3>
              </div>
            </div>
            <div class="dial-wrap">
              <div class="dial">
                <div class="dial-ring"></div>
                <div class="dial-north">North</div>
                <div class="dial-arrow" style="--arrow-rotation:${qibla.offset || 0}deg"></div>
              </div>
            </div>
            <div class="settings-grid" style="margin-top: 16px;">
              <div class="actions">
                <button class="button secondary" data-action="enable-sensor">Use device sensor</button>
                <button class="ghost-button" data-action="set-heading-mode">Use slider instead</button>
              </div>
              <label class="muted" for="heading-slider">Simulated heading: ${Math.round(state.simulatedHeading)} deg</label>
              <input id="heading-slider" class="field" type="range" min="0" max="359" value="${Math.round(state.simulatedHeading)}">
              <div class="footer-note">Sensor status: ${escapeHtml(sensorStatusText())}. If you test on iPhone Safari, browser compass permission may work on localhost.</div>
            </div>
          </article>
        `
        : `
          <article class="sheet-card card">
            <div class="card-title-row">
              <div>
                <p class="card-eyebrow">Map</p>
                <h3 class="card-title">World verification view</h3>
                <p class="card-subtitle">This is a lightweight browser stand-in for the native map mode.</p>
              </div>
            </div>
            <div class="map-card">${renderMapSvg(location)}</div>
          </article>
        `
    }

    <article class="sheet-card card">
      <div class="card-title-row">
        <div>
          <p class="card-eyebrow">Reliability</p>
          <h3 class="card-title">${escapeHtml(qiblaExplanation(qibla))}</h3>
        </div>
      </div>
      <div class="info-grid">
        ${renderInfoRow("Location trust", labelForLocationTrust(location.trustState))}
        ${renderInfoRow("Heading source", qibla.headingSource)}
        ${renderInfoRow("Coordinates", `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`)}
      </div>
    </article>
  `;
}

function renderHadithListItem(hadith) {
  return `
    <button class="list-item" data-action="open-sheet" data-value="hadith" data-id="${hadith.id}">
      <div class="card-title-row">
        <div>
          <h3 class="list-title">${escapeHtml(collectionShort(hadith.collection))} ${hadith.hadithNumber}</h3>
          <p class="list-copy">${escapeHtml(hadith.englishText)}</p>
        </div>
        <span class="badge badge-brand">${escapeHtml(hadith.narrator)}</span>
      </div>
      <div class="list-foot">${escapeHtml(hadith.chapterTitle)}</div>
    </button>
  `;
}

function renderVerificationResult(result) {
  return `
    <button class="list-item" data-action="open-sheet" data-value="hadith" data-id="${result.record.id}">
      <div class="card-title-row">
        <div>
          <h3 class="list-title">${escapeHtml(collectionShort(result.record.collection))} ${result.record.hadithNumber}</h3>
          <p class="list-copy">${escapeHtml(result.record.englishText)}</p>
        </div>
        <span class="badge badge-success">${Math.round(result.score * 100)}%</span>
      </div>
      <div class="list-foot">${escapeHtml(result.record.narrator)} - ${escapeHtml(result.record.chapterTitle)}</div>
    </button>
  `;
}

function renderReferenceCard(reference) {
  return `
    <a class="link-card" href="${escapeAttribute(reference.urlString)}" target="_blank" rel="noreferrer">
      <strong>${escapeHtml(reference.title)}</strong>
      <span>${escapeHtml(reference.summary)}</span>
      <span class="list-foot">${escapeHtml(reference.referenceType)} - ${escapeHtml(reference.reviewState)}</span>
    </a>
  `;
}

function renderDailyWidgetCard(hadith) {
  return `
    <article class="widget-card">
      <div class="widget-mini-label">Widget preview</div>
      <h3 class="widget-title">Daily Hadith</h3>
      <div class="widget-body">${escapeHtml(collectionShort(hadith.collection))} ${hadith.hadithNumber}</div>
      <div class="widget-arabic">${escapeHtml(trimText(hadith.arabicText, 92))}</div>
    </article>
  `;
}

function renderPrayerWidgetCard(prayerDay, nextPrayer) {
  return `
    <article class="widget-card prayer">
      <div class="widget-mini-label">Widget preview</div>
      <h3 class="widget-title">Prayer Times</h3>
      ${
        prayerDay && nextPrayer
          ? `
            <div class="widget-body">
              <strong>${escapeHtml(nextPrayer.label)}</strong> at ${escapeHtml(formatMinutes(nextPrayer.minutes))}
              <br>
              ${escapeHtml(prayerDay.locationName)} - ${escapeHtml(prayerDay.methodShort)}
            </div>
          `
          : `<div class="widget-body">Choose a city to preview the prayer widget.</div>`
      }
    </article>
  `;
}

function renderNavButton(id, label) {
  return `
    <button class="nav-button ${state.tab === id ? "active" : ""}" data-action="switch-tab" data-value="${id}">
      <div>
        <div class="nav-dot"></div>
        <strong>${escapeHtml(label)}</strong>
      </div>
    </button>
  `;
}

function renderInfoRow(label, value) {
  return `
    <div class="info-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function activeLocation() {
  if (state.useBrowserLocation && state.browserLocation) {
    return {
      label: state.browserLocation.label,
      countryCode: null,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      latitude: state.browserLocation.latitude,
      longitude: state.browserLocation.longitude,
      trustState: locationTrustFromBrowser(state.browserLocation),
      notes: ["Browser mode uses your local browser time zone and may not know the country automatically."]
    };
  }

  const preset = CITY_PRESETS.find((item) => item.id === state.selectedCity) || CITY_PRESETS[0];
  return {
    ...preset,
    trustState: "precise",
    notes: []
  };
}

function currentPrayerDay() {
  const location = activeLocation();
  return calculatePrayerDay({
    date: state.now,
    locationName: location.label,
    latitude: location.latitude,
    longitude: location.longitude,
    countryCode: location.countryCode,
    timeZone: location.timeZone,
    trustState: location.trustState,
    method: activePrayerMethod(),
    juristicMethod: state.juristicMethod,
    offsets: state.offsets,
    extraNotes: location.notes
  });
}

function comparePrayerMethods() {
  const location = activeLocation();
  return Object.keys(METHOD_LABELS)
    .map((method) =>
      calculatePrayerDay({
        date: state.now,
        locationName: location.label,
        latitude: location.latitude,
        longitude: location.longitude,
        countryCode: location.countryCode,
        timeZone: location.timeZone,
        trustState: location.trustState,
        method,
        juristicMethod: state.juristicMethod,
        offsets: {},
        extraNotes: []
      })
    )
    .filter(Boolean);
}

function currentQiblaState() {
  const location = activeLocation();
  const heading = state.sensorPermission === "granted" && typeof state.sensorHeading === "number"
    ? state.sensorHeading
    : state.simulatedHeading;
  const targetBearing = qiblaBearing(location.latitude, location.longitude);
  const offset = normalize180(targetBearing - heading);
  const confidence = (() => {
    if (state.sensorPermission === "granted" && location.trustState === "precise") {
      return "high";
    }
    if (heading != null && location.trustState !== "unavailable") {
      return "limited";
    }
    return "needsCalibration";
  })();

  return {
    targetBearing,
    currentHeading: heading,
    offset,
    confidence,
    headingSource: state.sensorPermission === "granted" ? "Device sensor" : "Simulated slider"
  };
}

function featuredHadith(records, date) {
  const sorted = [...records].sort((left, right) => {
    const collectionOrder = collectionShort(left.collection).localeCompare(collectionShort(right.collection));
    return collectionOrder || left.hadithNumber - right.hadithNumber;
  });
  const index = (dayOfYear(date) - 1) % sorted.length;
  const record = sorted[index] || sorted[0];
  return {
    ...record,
    displayTitle: `${collectionShort(record.collection)} ${record.hadithNumber}`,
    collectionDisplay: collectionDisplay(record.collection)
  };
}

function searchRecords(records, query, collection) {
  const normalizedQuery = normalizeText(query);
  return records.filter((record) => {
    if (collection !== "all" && record.collection !== collection) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const haystack = normalizeText([
      record.arabicText,
      record.englishText,
      record.narrator,
      record.chapterTitle,
      record.bookTitle,
      collectionDisplay(record.collection)
    ].join(" "));
    return haystack.includes(normalizedQuery);
  });
}

function verifyRecords(records, text) {
  const query = normalizeText(text);
  if (!query) {
    return [];
  }

  return records
    .map((record) => {
      const score = Math.max(
        tokenScore(query, normalizeText(record.arabicText)),
        tokenScore(query, normalizeText(record.englishText))
      );
      return { record, score };
    })
    .filter((item) => item.score > 0.18)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);
}

function calculatePrayerDay(context) {
  const parameters = prayerMethodParameters(context.method, context.date, context.timeZone);
  const dateParts = zonedDateParts(context.date, context.timeZone);
  const julianDate = julianDay(dateParts.year, dateParts.month, dateParts.day);
  const timeZoneHours = offsetHoursForTimeZone(context.timeZone, context.date);
  const solar = sunPosition(julianDate);
  const noonMinutes = 720 - 4 * context.longitude - solar.equationOfTime + timeZoneHours * 60;

  const sunriseMinutes = solarTimeMinutes(0.833, context.latitude, solar.declination, noonMinutes, "before");
  const sunsetMinutes = solarTimeMinutes(0.833, context.latitude, solar.declination, noonMinutes, "after");

  if (sunriseMinutes == null || sunsetMinutes == null) {
    return null;
  }

  const nightLength = sunriseMinutes + 1440 - sunsetMinutes;
  const fajrMinutes =
    solarTimeMinutes(parameters.fajrAngle, context.latitude, solar.declination, noonMinutes, "before") ??
    sunriseMinutes - nightLength / 2;

  const asrMinutes =
    solarAltitudeTimeMinutes(
      asrAngle(context.latitude, solar.declination, context.juristicMethod === "hanafi" ? 2 : 1),
      context.latitude,
      solar.declination,
      noonMinutes,
      "after"
    ) ??
    noonMinutes + 180;

  let ishaMinutes = sunsetMinutes + 90;
  if (typeof parameters.ishaIntervalMinutes === "number") {
    ishaMinutes = sunsetMinutes + parameters.ishaIntervalMinutes;
  } else if (typeof parameters.ishaAngle === "number") {
    ishaMinutes =
      solarTimeMinutes(parameters.ishaAngle, context.latitude, solar.declination, noonMinutes, "after") ??
      sunsetMinutes + nightLength / 2;
  }

  const entries = PRAYER_EVENTS.map((event) => {
    const baseMinutes = {
      fajr: fajrMinutes,
      sunrise: sunriseMinutes,
      dhuhr: noonMinutes,
      asr: asrMinutes,
      maghrib: sunsetMinutes,
      isha: ishaMinutes
    }[event.id];

    return {
      id: event.id,
      label: event.label,
      minutes: normalizeMinutes(baseMinutes + Number(context.offsets[event.id] || 0))
    };
  });

  const notes = [`Method: ${METHOD_LABELS[context.method]}`];
  if (context.trustState === "reduced") {
    notes.push("Location accuracy is reduced. Check against your local masjid if timings differ.");
  } else if (context.trustState === "stale") {
    notes.push("Location is stale. Refresh before relying on these timings.");
  } else if (context.trustState === "unavailable") {
    notes.push("Location unavailable. Results may be based on stale or preset data.");
  }
  if (context.extraNotes.length) {
    notes.push(...context.extraNotes);
  }
  if (Object.values(context.offsets).some((value) => Number(value))) {
    notes.push("Manual offsets are applied.");
  }

  return {
    locationName: context.locationName,
    method: context.method,
    methodLabel: METHOD_LABELS[context.method],
    methodShort: METHOD_SHORT[context.method],
    juristicMethod: context.juristicMethod,
    calculationVersion: "astronomical-v1",
    locationTrustState: context.trustState,
    entries,
    notes
  };
}

function getUpcomingPrayer(prayerDay) {
  const location = activeLocation();
  const zonedNow = zonedDateParts(state.now, location.timeZone);
  const nowMinutes = zonedNow.hour * 60 + zonedNow.minute;
  const nextToday = prayerDay.entries.find((item) => item.minutes > nowMinutes);

  if (nextToday) {
    return {
      ...nextToday,
      remainingMinutes: Math.max(1, Math.round(nextToday.minutes - nowMinutes))
    };
  }

  const tomorrow = addDays(state.now, 1);
  const tomorrowDay = calculatePrayerDay({
    date: tomorrow,
    locationName: location.label,
    latitude: location.latitude,
    longitude: location.longitude,
    countryCode: location.countryCode,
    timeZone: location.timeZone,
    trustState: location.trustState,
    method: activePrayerMethod(),
    juristicMethod: state.juristicMethod,
    offsets: state.offsets,
    extraNotes: location.notes
  });
  const fajrTomorrow = tomorrowDay?.entries.find((item) => item.id === "fajr");

  if (!fajrTomorrow) {
    return null;
  }

  return {
    ...fajrTomorrow,
    label: "Fajr tomorrow",
    remainingMinutes: Math.max(1, Math.round(1440 - nowMinutes + fajrTomorrow.minutes))
  };
}

function prayerMethodParameters(method, date, timeZone) {
  const isRamadan = ummAlQuraMonth(date, timeZone) === 9;

  switch (method) {
    case "ummAlQura":
      return { fajrAngle: 18.5, ishaIntervalMinutes: isRamadan ? 120 : 90 };
    case "muslimWorldLeague":
      return { fajrAngle: 18, ishaAngle: 17 };
    case "egyptian":
      return { fajrAngle: 19.5, ishaAngle: 17.5 };
    case "karachi":
      return { fajrAngle: 18, ishaAngle: 18 };
    case "northAmerica":
      return { fajrAngle: 15, ishaAngle: 15 };
    case "gulfRegion":
      return { fajrAngle: 19.5, ishaIntervalMinutes: 90 };
    case "singapore":
      return { fajrAngle: 20, ishaAngle: 18 };
    case "turkey":
      return { fajrAngle: 18, ishaAngle: 17 };
    case "morocco":
      return { fajrAngle: 18, ishaAngle: 17 };
    default:
      return { fajrAngle: 18, ishaAngle: 17 };
  }
}

function defaultPrayerMethod(countryCode) {
  switch ((countryCode || "").toUpperCase()) {
    case "SA":
      return "ummAlQura";
    case "AE":
    case "BH":
    case "KW":
    case "OM":
    case "QA":
      return "gulfRegion";
    case "EG":
      return "egyptian";
    case "PK":
    case "IN":
    case "BD":
    case "AF":
      return "karachi";
    case "US":
    case "CA":
      return "northAmerica";
    case "TR":
      return "turkey";
    case "MA":
      return "morocco";
    case "SG":
    case "BN":
      return "singapore";
    default:
      return "muslimWorldLeague";
  }
}

function activePrayerMethod() {
  return state.methodOverride || defaultPrayerMethod(activeLocation().countryCode);
}

function qiblaBearing(latitude, longitude) {
  const sourceLatitude = toRadians(latitude);
  const sourceLongitude = toRadians(longitude);
  const targetLatitude = toRadians(KAABA.latitude);
  const targetLongitude = toRadians(KAABA.longitude);
  const deltaLongitude = targetLongitude - sourceLongitude;
  const y = Math.sin(deltaLongitude) * Math.cos(targetLatitude);
  const x = Math.cos(sourceLatitude) * Math.sin(targetLatitude) -
    Math.sin(sourceLatitude) * Math.cos(targetLatitude) * Math.cos(deltaLongitude);
  return normalizeAngle(toDegrees(Math.atan2(y, x)));
}

function renderMapSvg(location) {
  const user = projectToMap(location.latitude, location.longitude);
  const kaaba = projectToMap(KAABA.latitude, KAABA.longitude);

  return `
    <svg viewBox="0 0 320 180" role="img" aria-label="Qibla verification map">
      <defs>
        <linearGradient id="mapBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#eef8f4"></stop>
          <stop offset="100%" stop-color="#f8eed5"></stop>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="320" height="180" rx="22" fill="url(#mapBg)"></rect>
      ${[-120, -60, 0, 60, 120].map((lon) => {
        const x = ((lon + 180) / 360) * 320;
        return `<line x1="${x}" y1="0" x2="${x}" y2="180" stroke="rgba(15,95,83,0.12)" stroke-width="1"></line>`;
      }).join("")}
      ${[-60, -30, 0, 30, 60].map((lat) => {
        const y = ((90 - lat) / 180) * 180;
        return `<line x1="0" y1="${y}" x2="320" y2="${y}" stroke="rgba(15,95,83,0.12)" stroke-width="1"></line>`;
      }).join("")}
      <line x1="${user.x}" y1="${user.y}" x2="${kaaba.x}" y2="${kaaba.y}" stroke="#0f5f53" stroke-width="2.2" stroke-dasharray="5 4"></line>
      <circle cx="${user.x}" cy="${user.y}" r="6" fill="#073d34"></circle>
      <circle cx="${kaaba.x}" cy="${kaaba.y}" r="7" fill="#bc8f3b"></circle>
      <text x="${Math.min(user.x + 10, 250)}" y="${Math.max(user.y - 10, 18)}" fill="#073d34" font-size="12" font-weight="700">You</text>
      <text x="${Math.min(kaaba.x + 10, 240)}" y="${Math.max(kaaba.y - 10, 18)}" fill="#8a651d" font-size="12" font-weight="700">Kaaba</text>
    </svg>
  `;
}

function projectToMap(latitude, longitude) {
  return {
    x: ((longitude + 180) / 360) * 320,
    y: ((90 - latitude) / 180) * 180
  };
}

function badgeForTrust(trustState) {
  if (trustState === "precise") {
    return `<span class="badge badge-success">Precise</span>`;
  }
  if (trustState === "reduced" || trustState === "stale") {
    return `<span class="badge badge-warning">${escapeHtml(labelForLocationTrust(trustState))}</span>`;
  }
  return `<span class="badge badge-danger">${escapeHtml(labelForLocationTrust(trustState))}</span>`;
}

function badgeForQiblaConfidence(confidence) {
  if (confidence === "high") {
    return `<span class="badge badge-success">High confidence</span>`;
  }
  if (confidence === "limited") {
    return `<span class="badge badge-warning">Limited confidence</span>`;
  }
  return `<span class="badge badge-danger">Needs calibration</span>`;
}

function qiblaExplanation(qibla) {
  switch (qibla.confidence) {
    case "high":
      return "Sensor and location are strong enough for direct use.";
    case "limited":
      return "Use the bearing carefully and compare against the map mode.";
    default:
      return "The prototype is not confident enough. Use the map view or sensor permission.";
  }
}

function labelForLocationTrust(value) {
  switch (value) {
    case "precise":
      return "Precise";
    case "reduced":
      return "Reduced accuracy";
    case "stale":
      return "Stale location";
    default:
      return "Unavailable";
  }
}

function locationTrustFromBrowser(browserLocation) {
  const ageSeconds = Math.abs(state.now.getTime() - browserLocation.timestamp) / 1000;
  if (ageSeconds > 900) {
    return "stale";
  }
  if (browserLocation.accuracy > 1000) {
    return "reduced";
  }
  return "precise";
}

function sensorStatusText() {
  switch (state.sensorPermission) {
    case "granted":
      return "device heading is active";
    case "denied":
      return "permission denied";
    case "simulated":
      return "using the heading slider";
    default:
      return "not requested yet";
  }
}

function handleOrientation(event) {
  let heading = null;
  if (typeof event.webkitCompassHeading === "number") {
    heading = event.webkitCompassHeading;
  } else if (typeof event.alpha === "number") {
    heading = normalizeAngle(360 - event.alpha);
  }

  if (heading != null) {
    state.sensorHeading = heading;
    state.sensorAvailable = true;
    if (state.sensorPermission === "granted") {
      render();
    }
  }
}

async function enableOrientationSensor() {
  try {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      const permission = await DeviceOrientationEvent.requestPermission();
      state.sensorPermission = permission === "granted" ? "granted" : "denied";
    } else if (typeof DeviceOrientationEvent !== "undefined") {
      state.sensorPermission = "granted";
    } else {
      state.sensorPermission = "denied";
    }
  } catch {
    state.sensorPermission = "denied";
  }
}

async function requestBrowserLocation() {
  if (!navigator.geolocation) {
    state.useBrowserLocation = false;
    return;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.browserLocation = {
          label: `Browser location (${position.coords.latitude.toFixed(2)}, ${position.coords.longitude.toFixed(2)})`,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
          timestamp: position.timestamp || Date.now()
        };
        state.useBrowserLocation = true;
        resolve();
      },
      () => {
        state.useBrowserLocation = false;
        resolve();
      },
      { enableHighAccuracy: true, maximumAge: 600000, timeout: 10000 }
    );
  });
}

function adjustOffset(eventId, delta) {
  const current = Number(state.offsets[eventId] || 0);
  state.offsets[eventId] = clamp(current + delta, -30, 30);
  persistSettings();
}

function toggleBookmark(id) {
  const set = new Set(state.bookmarks);
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
  state.bookmarks = Array.from(set);
  persistSettings();
}

function closeSheet() {
  state.sheet = null;
}

function persistSettings() {
  localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(state.bookmarks));
  localStorage.setItem(STORAGE_KEYS.cityPreset, state.selectedCity);
  localStorage.setItem(STORAGE_KEYS.methodOverride, state.methodOverride);
  localStorage.setItem(STORAGE_KEYS.juristicMethod, state.juristicMethod);
  localStorage.setItem(STORAGE_KEYS.offsets, JSON.stringify(state.offsets));
  localStorage.setItem(STORAGE_KEYS.simulatedHeading, String(state.simulatedHeading));
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

function tokenScore(query, candidate) {
  if (!query || !candidate) {
    return 0;
  }
  if (candidate.includes(query)) {
    return 1;
  }
  const queryTokens = new Set(query.split(" "));
  const candidateTokens = new Set(candidate.split(" "));
  let shared = 0;
  queryTokens.forEach((token) => {
    if (candidateTokens.has(token)) {
      shared += 1;
    }
  });
  return shared / queryTokens.size;
}

function collectionDisplay(collection) {
  return collection === "bukhari" ? "Sahih al-Bukhari" : "Sahih Muslim";
}

function collectionShort(collection) {
  return collection === "bukhari" ? "Bukhari" : "Muslim";
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

function zonedDateParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

function ummAlQuraMonth(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    timeZone,
    month: "numeric"
  });
  return Number(formatter.format(date));
}

function offsetHoursForTimeZone(timeZone, date) {
  const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const zonedDate = new Date(date.toLocaleString("en-US", { timeZone }));
  return (zonedDate.getTime() - utcDate.getTime()) / 3600000;
}

function julianDay(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045 - 0.5;
}

function sunPosition(julianDate) {
  const d = julianDate - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * sinDeg(g) + 0.02 * sinDeg(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const rightAscension = fixHour(atan2Deg(cosDeg(e) * sinDeg(l), cosDeg(l)) / 15);
  const declination = asinDeg(sinDeg(e) * sinDeg(l));
  const equationOfTime = (q / 15 - rightAscension) * 60;
  return { declination, equationOfTime };
}

function solarTimeMinutes(angle, latitude, declination, baseMinutes, direction) {
  return solarAltitudeTimeMinutes(-angle, latitude, declination, baseMinutes, direction);
}

function solarAltitudeTimeMinutes(altitude, latitude, declination, baseMinutes, direction) {
  const numerator = sinDeg(altitude) - sinDeg(latitude) * sinDeg(declination);
  const denominator = cosDeg(latitude) * cosDeg(declination);
  const ratio = numerator / denominator;
  if (ratio < -1 || ratio > 1) {
    return null;
  }
  const hourAngle = acosDeg(ratio);
  const delta = hourAngle * 4;
  return direction === "before" ? baseMinutes - delta : baseMinutes + delta;
}

function asrAngle(latitude, declination, factor) {
  return -atanDeg(1 / (factor + tanDeg(Math.abs(latitude - declination))));
}

function formatMinutes(minutes) {
  const normalized = Math.round(normalizeMinutes(minutes));
  let hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  if (hours <= 0) {
    return `${remainder}m`;
  }
  return `${hours}h ${remainder}m`;
}

function trimText(text, maxLength) {
  const value = String(text);
  return value.length <= maxLength ? value : `${value.slice(0, maxLength).trim()}...`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function normalizeMinutes(value) {
  const normalized = value % 1440;
  return normalized < 0 ? normalized + 1440 : normalized;
}

function normalizeAngle(value) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function normalize180(value) {
  return ((value + 540) % 360) - 180;
}

function fixAngle(value) {
  return normalizeAngle(value);
}

function fixHour(value) {
  const normalized = value % 24;
  return normalized < 0 ? normalized + 24 : normalized;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sinDeg(value) { return Math.sin(toRadians(value)); }
function cosDeg(value) { return Math.cos(toRadians(value)); }
function tanDeg(value) { return Math.tan(toRadians(value)); }
function asinDeg(value) { return toDegrees(Math.asin(value)); }
function acosDeg(value) { return toDegrees(Math.acos(value)); }
function atanDeg(value) { return toDegrees(Math.atan(value)); }
function atan2Deg(y, x) { return toDegrees(Math.atan2(y, x)); }
function toRadians(value) { return value * Math.PI / 180; }
function toDegrees(value) { return value * 180 / Math.PI; }

function getFieldValue(id) {
  const field = document.getElementById(id);
  return field ? field.value : "";
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
