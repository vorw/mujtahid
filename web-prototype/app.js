const STORAGE_KEYS = {
  favorites: "mujtahid.favorites",
  notifications: "mujtahid.notifications"
};

const REMINDER_OPTIONS = [
  { id: "daily", label: "يوميًا", intervalMs: 24 * 60 * 60 * 1000 },
  { id: "threeDays", label: "كل 3 أيام", intervalMs: 3 * 24 * 60 * 60 * 1000 },
  { id: "weekly", label: "أسبوعيًا", intervalMs: 7 * 24 * 60 * 60 * 1000 }
];

const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: false,
  frequency: "daily",
  lastSentAt: ""
};

const state = {
  loading: true,
  error: "",
  tab: "home",
  sheet: null,
  feed: [],
  activeFeedIndex: 0,
  favorites: loadJSON(STORAGE_KEYS.favorites, []),
  searchQuery: "",
  searching: false,
  searchError: "",
  searchResults: [],
  lastSearch: "",
  notifications: { ...DEFAULT_NOTIFICATION_SETTINGS, ...loadJSON(STORAGE_KEYS.notifications, DEFAULT_NOTIFICATION_SETTINGS) },
  notificationPermission: notificationPermissionState(),
  standalone: isStandalone(),
  toast: "",
  now: new Date(),
  launchHadithId: new URLSearchParams(window.location.search).get("hadith") || ""
};

const root = document.getElementById("app");
let toastTimer = null;
let notificationTimer = null;
let homeObserver = null;
let launchScrollPending = false;

applyStandaloneClass();
attachEventHandlers();
initialize();

async function initialize() {
  registerServiceWorker();

  try {
    const response = await fetch("./data/featured-hadiths.json");
    if (!response.ok) {
      throw new Error("تعذر تحميل بطاقات الأحاديث.");
    }

    state.feed = await response.json();

    if (!state.feed.length) {
      throw new Error("لا توجد أحاديث جاهزة للعرض.");
    }

    if (state.launchHadithId) {
      const launchIndex = state.feed.findIndex((item) => item.id === state.launchHadithId);
      if (launchIndex >= 0) {
        state.activeFeedIndex = launchIndex;
        launchScrollPending = true;
      }
      clearLaunchQuery();
    }

    await maybeSendDueReminder();
  } catch (error) {
    state.error = error.message || "تعذر تشغيل التطبيق الآن.";
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

    const { action, id, value } = actionTarget.dataset;

    switch (action) {
      case "switch-tab":
        state.tab = value;
        closeSheet();
        render();
        return;
      case "open-search":
        state.tab = "search";
        render();
        return;
      case "open-notifications":
        state.sheet = { type: "notifications" };
        render();
        return;
      case "close-sheet":
        closeSheet();
        render();
        return;
      case "toggle-favorite":
        toggleFavorite(id);
        render();
        return;
      case "open-source":
        openSource(id ? locateRecord(id)?.sourceQuery : value);
        return;
      case "share-hadith":
        await shareHadith(locateRecord(id));
        render();
        return;
      case "copy-hadith":
        await copyHadith(locateRecord(id));
        render();
        return;
      case "search-submit":
        await runSearch(state.searchQuery);
        return;
      case "clear-search":
        state.searchQuery = "";
        state.searchResults = [];
        state.searchError = "";
        state.lastSearch = "";
        render();
        return;
      case "quick-search":
        state.searchQuery = value || "";
        render();
        await runSearch(state.searchQuery);
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
        showToast(`تم ضبط التذكير: ${reminderOption(value).label}`);
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
  });

  root.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && event.target.id === "search-field") {
      event.preventDefault();
      await runSearch(state.searchQuery);
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

  notificationTimer = window.setInterval(async () => {
    state.now = new Date();
    await maybeSendDueReminder();
  }, 60000);
}
function render() {
  applyStandaloneClass();

  if (state.loading) {
    root.innerHTML = renderLoadingState();
    return;
  }

  if (state.error) {
    root.innerHTML = renderErrorState();
    return;
  }

  root.innerHTML = `
    <div class="app-shell">
      ${state.tab === "home" ? renderHomeScreen() : renderSearchScreen()}
      ${renderFloatingNav()}
      ${state.sheet ? renderSheet() : ""}
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </div>
  `;

  initializeHomeObserver();
}

function renderLoadingState() {
  return `
    <section class="search-screen">
      <div class="search-stack">
        <article class="search-card">
          <div class="notification-head">
            <div class="header-logo">${renderMark()}</div>
            <div>
              <p class="search-kicker">مجتهد</p>
              <h1 class="search-title">جارٍ تجهيز الواجهة</h1>
              <p class="search-copy">نرتب بطاقات الأحاديث لتظهر كتجربة قريبة من التطبيق الحقيقي.</p>
            </div>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderErrorState() {
  return `
    <section class="search-screen">
      <div class="search-stack">
        <article class="search-card">
          <div class="notification-head">
            <div class="header-logo">${renderMark()}</div>
            <div>
              <p class="search-kicker">تعذر التشغيل</p>
              <h1 class="search-title">هناك مشكلة في التحميل</h1>
              <p class="search-copy">${escapeHtml(state.error)}</p>
            </div>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderHomeScreen() {
  return `
    <section class="home-screen">
      <header class="overlay-header">
        <button class="header-button" data-action="open-notifications" aria-label="إعدادات التذكير">${renderIcon("bell")}</button>
        <div class="header-logo" aria-hidden="true">${renderMark()}</div>
        <button class="header-button" data-action="open-search" aria-label="فتح البحث">${renderIcon("search")}</button>
      </header>

      <div class="feed-progress" aria-hidden="true">
        ${state.feed.map((_, index) => `<span class="feed-dot ${state.activeFeedIndex === index ? "active" : ""}"></span>`).join("")}
      </div>

      <div class="feed-shell" id="feed-shell">
        ${state.feed.map((record, index) => renderFeedSlide(record, index)).join("")}
      </div>

      <div class="feed-hint" aria-hidden="true">${renderIcon("swipe")}<span>اسحب للأعلى</span></div>
    </section>
  `;
}

function renderFeedSlide(record, index) {
  const favorite = state.favorites.includes(record.id);
  return `
    <article class="feed-slide ${state.activeFeedIndex === index ? "is-active" : ""}" data-feed-index="${index}" data-theme="${index % 5}" id="feed-${escapeAttribute(record.id)}">
      <div class="feed-theme"></div>
      <div class="feed-stage">
        <div class="feed-card">
          <div class="feed-topline">
            <span class="collection-pill">${escapeHtml(record.collectionLabel)}</span>
            <span class="source-pill">حديث ${escapeHtml(record.hadithNumber)}</span>
          </div>
          <p class="feed-meta">عن ${escapeHtml(record.narratorArabic)}</p>
          <p class="feed-arabic">${escapeHtml(record.arabicText)}</p>
          <p class="feed-english">${escapeHtml(record.englishText)}</p>
          <div class="feed-bottom">
            <span class="narrator-pill">المصدر الخارجي: الدرر السنية</span>
            <button class="source-button" data-action="open-source" data-id="${record.id}">
              ${renderIcon("source")}
              <span>افتح المصدر</span>
            </button>
          </div>
        </div>

        <aside class="feed-actions" aria-label="أوامر الحديث">
          <button class="feed-action" data-action="toggle-favorite" data-id="${record.id}" aria-label="إضافة للمفضلة">
            ${favorite ? renderIcon("heartFilled") : renderIcon("heart")}
            <span>${favorite ? "محفوظ" : "فضّل"}</span>
          </button>
          <button class="feed-action" data-action="share-hadith" data-id="${record.id}" aria-label="مشاركة الحديث">
            ${renderIcon("share")}
            <span>شارك</span>
          </button>
          <button class="feed-action" data-action="copy-hadith" data-id="${record.id}" aria-label="نسخ الحديث">
            ${renderIcon("copy")}
            <span>انسخ</span>
          </button>
          <button class="feed-action" data-action="open-source" data-id="${record.id}" aria-label="فتح المصدر الموثوق">
            ${renderIcon("compass")}
            <span>المصدر</span>
          </button>
        </aside>
      </div>
    </article>
  `;
}

function renderSearchScreen() {
  return `
    <section class="search-screen">
      <div class="search-stack">
        <article class="search-card">
          <div class="notification-head">
            <div class="header-logo" aria-hidden="true">${renderMark()}</div>
            <div>
              <p class="search-kicker">بحث مباشر</p>
              <h1 class="search-title">ابحث في الحديث</h1>
              <p class="search-copy">هذه الصفحة تستدعي نتائج مباشرة من الموسوعة الحديثية في الدرر السنية، ثم تفتح المصدر الخارجي فور اختيار الحديث.</p>
            </div>
          </div>

          <label class="search-field" aria-label="البحث في الحديث">
            <span aria-hidden="true">${renderIcon("search")}</span>
            <input id="search-field" type="text" placeholder="اكتب لفظة، أو جزءًا من الحديث" value="${escapeAttribute(state.searchQuery)}">
            ${state.searchQuery ? `<button class="close-button" data-action="clear-search" aria-label="مسح البحث">${renderIcon("close")}</button>` : ""}
          </label>

          <div class="search-actions">
            <button class="search-submit" data-action="search-submit">
              ${renderIcon("spark")}
              <span>${state.searching ? "جارٍ البحث..." : "ابدأ البحث"}</span>
            </button>
            <button class="inline-chip" data-action="quick-search" data-value="الأعمال بالنيات">الأعمال بالنيات</button>
            <button class="inline-chip" data-action="quick-search" data-value="بني الإسلام على خمس">بني الإسلام على خمس</button>
          </div>
        </article>

        ${renderSearchBody()}
      </div>
    </section>
  `;
}

function renderSearchBody() {
  if (state.searching) {
    return `
      <article class="empty-panel">
        <p class="search-kicker">بحث حي</p>
        <h2 class="search-title">نبحث الآن</h2>
        <p class="empty-copy">جارٍ جلب النتائج من الدرر السنية...</p>
      </article>
    `;
  }

  if (state.searchError) {
    return `
      <article class="empty-panel">
        <p class="search-kicker">تعذر البحث</p>
        <h2 class="search-title">النتائج لم تصل</h2>
        <p class="empty-copy">${escapeHtml(state.searchError)}</p>
      </article>
    `;
  }

  if (!state.lastSearch) {
    return `
      <article class="empty-panel">
        <p class="search-kicker">جاهز</p>
        <h2 class="search-title">ابدأ من كلمة واحدة</h2>
        <p class="empty-copy">اكتب جزءًا من الحديث، وستظهر لك نتائج حيّة من مصدر موثوق بدل بطاقات تجريبية ثابتة.</p>
      </article>
    `;
  }

  if (!state.searchResults.length) {
    return `
      <article class="empty-panel">
        <p class="search-kicker">لا توجد مطابقة واضحة</p>
        <h2 class="search-title">جرّب صياغة أخرى</h2>
        <p class="empty-copy">لم يظهر شيء واضح لعبارة «${escapeHtml(state.lastSearch)}». جرّب جزءًا أقصر أو افتح البحث الخارجي مباشرة.</p>
        <div class="search-actions">
          <button class="search-submit" data-action="open-source" data-value="${escapeAttribute(state.lastSearch)}">${renderIcon("source")}<span>افتح الدرر السنية</span></button>
        </div>
      </article>
    `;
  }

  return `<div class="search-results">${state.searchResults.map(renderSearchResult).join("")}</div>`;
}

function renderSearchResult(result) {
  return `
    <article class="search-result">
      <div class="result-meta">
        <div>
          <p class="result-title">${escapeHtml(result.source || "الموسوعة الحديثية")}</p>
          <p class="result-label">${escapeHtml(result.narrator || "راوٍ غير محدد")}</p>
        </div>
        ${result.grade ? `<span class="source-pill">${escapeHtml(result.grade)}</span>` : ""}
      </div>
      <p class="result-arabic">${escapeHtml(result.text)}</p>
      <div class="result-footer">
        <div>
          ${result.scholar ? `<p class="result-info">المحدّث: ${escapeHtml(result.scholar)}</p>` : ""}
          ${result.page ? `<p class="result-info">الموضع: ${escapeHtml(result.page)}</p>` : ""}
        </div>
        <button class="result-link" data-action="open-source" data-value="${escapeAttribute(result.url)}">${renderIcon("source")}<span>افتح المصدر</span></button>
      </div>
    </article>
  `;
}
function renderFloatingNav() {
  return `
    <nav class="floating-nav" aria-label="التنقل الرئيسي">
      <button class="nav-button ${state.tab === "home" ? "active" : ""}" data-action="switch-tab" data-value="home">
        ${renderIcon("home")}
        <span>الرئيسية</span>
      </button>
      <button class="nav-button ${state.tab === "search" ? "active" : ""}" data-action="switch-tab" data-value="search">
        ${renderIcon("search")}
        <span>البحث</span>
      </button>
    </nav>
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
  return state.sheet?.type === "notifications" ? renderNotificationsSheet() : "";
}

function renderNotificationsSheet() {
  const permission = state.notificationPermission;

  return `
    <header class="sheet-header">
      <div>
        <h2 class="sheet-title">تنبيهات الأحاديث</h2>
        <p class="sheet-copy">اختر الوتيرة التي تناسبك الآن. في نسخة الويب سيظهر التذكير عند السماح به وعند بقاء التطبيق نشطًا أو عند فتحه مجددًا.</p>
      </div>
      <button class="close-button" data-action="close-sheet" aria-label="إغلاق">${renderIcon("close")}</button>
    </header>

    <section class="notification-stack">
      <article class="notification-card">
        <div class="notification-row">
          <div class="notification-head">
            <div class="notification-icon">${renderIcon("bell")}</div>
            <div>
              <h3 class="notification-title">تفعيل التذكير</h3>
              <p class="notification-copy">زر واحد لتشغيل أو إيقاف تنبيهات الحديث.</p>
            </div>
          </div>
          <button class="switch ${state.notifications.enabled ? "on" : ""}" data-action="toggle-reminders" aria-label="تفعيل التذكير"></button>
        </div>
      </article>

      <article class="notification-card">
        <div class="notification-row">
          <div>
            <h3 class="notification-title">حالة الإذن</h3>
            <p class="notification-copy">اسمح بالإشعارات أولًا ليتمكن التطبيق من إرسال التنبيه.</p>
          </div>
          <span class="permission-pill ${permission}">${escapeHtml(permissionLabel(permission))}</span>
        </div>
        <div class="search-actions">
          <button class="segment-chip" data-action="request-notifications">السماح بالإشعارات</button>
          <button class="segment-chip" data-action="send-test-notification" ${permission === "granted" ? "" : "disabled"}>إرسال تجربة</button>
        </div>
      </article>

      <article class="notification-card">
        <h3 class="notification-title">معدل الإرسال</h3>
        <p class="notification-copy">كلما كان المعدل أهدأ، بدت التجربة أقرب لتطبيق مصقول لا يزعج المستخدم.</p>
        <div class="segment-row" style="margin-top: 12px;">
          ${REMINDER_OPTIONS.map((option) => renderFrequencyChip(option)).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderFrequencyChip(option) {
  return `<button class="segment-chip ${state.notifications.frequency === option.id ? "active" : ""}" data-action="set-frequency" data-value="${option.id}">${escapeHtml(option.label)}</button>`;
}

async function runSearch(query) {
  const trimmed = String(query || "").trim();
  state.searchQuery = trimmed;
  state.lastSearch = trimmed;
  state.searchError = "";
  state.searchResults = [];

  if (!trimmed) {
    render();
    return;
  }

  state.searching = true;
  render();

  try {
    state.searchResults = await searchDorar(trimmed);
  } catch (error) {
    state.searchError = error.message || "تعذر الوصول إلى الدرر السنية الآن.";
  } finally {
    state.searching = false;
    render();
  }
}

function searchDorar(query) {
  return new Promise((resolve, reject) => {
    const callbackName = `__mujtahidDorar${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("انتهت مهلة البحث قبل وصول النتائج."));
    }, 12000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      resolve(parseDorarPayload(payload, query));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("تعذر الاتصال بالمصدر الخارجي."));
    };

    script.src = `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(query)}&callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

function parseDorarPayload(payload, query) {
  const html = payload?.ahadith?.result || "";
  if (!html) {
    return [];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const hadithNodes = [...doc.querySelectorAll(".hadith")];
  const infoNodes = [...doc.querySelectorAll(".hadith-info")];
  const parsed = hadithNodes
    .map((node, index) => {
      const text = cleanSearchText(node.textContent || "");
      const info = parseHadithInfo(infoNodes[index]?.textContent || "");
      return {
        id: `${query}-${index}`,
        text,
        narrator: info.narrator,
        scholar: info.scholar,
        source: info.source,
        page: info.page,
        grade: info.grade,
        url: buildSourceUrl(text || query)
      };
    })
    .filter((item) => item.text);

  const preferred = parsed.filter((item) => /صحيح البخاري|صحيح مسلم|صحيح الجامع|إسناده صحيح|\[صحيح\]|صحيح|حسن/i.test(`${item.source} ${item.grade}`));
  return (preferred.length ? preferred : parsed).slice(0, 12);
}

function parseHadithInfo(raw) {
  const text = normalizeSpace(raw);
  return {
    narrator: extractField(text, "الراوي:", "المحدث:"),
    scholar: extractField(text, "المحدث:", "المصدر:"),
    source: extractField(text, "المصدر:", "الصفحة أو الرقم:"),
    page: extractField(text, "الصفحة أو الرقم:", "خلاصة حكم المحدث:"),
    grade: extractField(text, "خلاصة حكم المحدث:", "")
  };
}

function extractField(text, startLabel, endLabel) {
  const startIndex = text.indexOf(startLabel);
  if (startIndex < 0) {
    return "";
  }

  const start = startIndex + startLabel.length;
  const end = endLabel ? text.indexOf(endLabel, start) : -1;
  return normalizeSpace(text.slice(start, end > -1 ? end : undefined));
}

function cleanSearchText(text) {
  return normalizeSpace(text)
    .replace(/^\d+\s*-\s*/, "")
    .replace(/\s*\.\s*$/, "")
    .replace(/\[يعني حديث:[^\]]+\]/g, "")
    .trim();
}

function initializeHomeObserver() {
  if (homeObserver) {
    homeObserver.disconnect();
    homeObserver = null;
  }

  if (state.tab !== "home") {
    return;
  }

  const feedShell = root.querySelector("#feed-shell");
  const slides = [...root.querySelectorAll(".feed-slide")];
  if (!feedShell || !slides.length) {
    return;
  }

  homeObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (!visible) {
      return;
    }

    const nextIndex = Number(visible.target.dataset.feedIndex || 0);
    if (nextIndex !== state.activeFeedIndex) {
      state.activeFeedIndex = nextIndex;
      updateFeedActiveState();
    }
  }, { root: feedShell, threshold: 0.62 });

  slides.forEach((slide) => homeObserver.observe(slide));
  updateFeedActiveState();

  if (launchScrollPending) {
    launchScrollPending = false;
    window.requestAnimationFrame(() => {
      slides[state.activeFeedIndex]?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  }
}

function updateFeedActiveState() {
  root.querySelectorAll(".feed-slide").forEach((slide) => {
    slide.classList.toggle("is-active", Number(slide.dataset.feedIndex || 0) === state.activeFeedIndex);
  });

  root.querySelectorAll(".feed-dot").forEach((dot, index) => {
    dot.classList.toggle("active", index === state.activeFeedIndex);
  });
}
function locateRecord(id) {
  return state.feed.find((record) => record.id === id) || null;
}

function openSource(value) {
  const url = /^https?:\/\//.test(String(value || "")) ? String(value) : buildSourceUrl(String(value || ""));
  if (url) {
    window.open(url, "_blank", "noopener");
  }
}

async function shareHadith(record) {
  if (!record) {
    return;
  }

  const url = buildSourceUrl(record.sourceQuery || record.arabicText);
  const text = buildShareText(record, url);

  try {
    if (navigator.share) {
      await navigator.share({ title: "مجتهد", text, url });
      showToast("تم فتح المشاركة");
      return;
    }
  } catch {
    return;
  }

  await copyText(text);
  showToast("تم نسخ الحديث بدل المشاركة");
}

async function copyHadith(record) {
  if (!record) {
    return;
  }

  await copyText(buildShareText(record, buildSourceUrl(record.sourceQuery || record.arabicText)));
  showToast("تم نسخ الحديث");
}

function buildShareText(record, url) {
  return [
    record.arabicText,
    record.englishText,
    `${record.collectionLabel} · حديث ${record.hadithNumber}`,
    url
  ].filter(Boolean).join("\n\n");
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const field = document.createElement("textarea");
  field.value = text;
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

function toggleFavorite(id) {
  const set = new Set(state.favorites);
  if (set.has(id)) {
    set.delete(id);
    showToast("تمت إزالة الحديث من المفضلة");
  } else {
    set.add(id);
    showToast("تم حفظ الحديث في المفضلة");
  }
  state.favorites = Array.from(set);
  persistAppState();
}

function buildSourceUrl(query) {
  const trimmed = String(query || "").trim();
  return trimmed ? `https://dorar.net/hadith/search?st=w&q=${encodeURIComponent(trimmed)}` : "https://dorar.net/hadith/search";
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
      return "مسموح";
    case "denied":
      return "محظور";
    case "unsupported":
      return "غير متاح";
    default:
      return "بانتظار السماح";
  }
}

async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    showToast("هذا المتصفح لا يدعم الإشعارات");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    state.notificationPermission = permission;
    if (permission === "granted") {
      state.notifications.enabled = true;
      persistAppState();
      showToast("تم تفعيل الإشعارات");
    } else if (permission === "denied") {
      state.notifications.enabled = false;
      persistAppState();
      showToast("تم رفض الإشعارات");
    }
  } catch {
    showToast("تعذر طلب الإذن الآن");
  }
}

async function toggleReminders() {
  if (state.notifications.enabled) {
    state.notifications.enabled = false;
    persistAppState();
    showToast("تم إيقاف التذكير");
    return;
  }

  if (state.notificationPermission !== "granted") {
    await requestNotificationPermission();
    return;
  }

  state.notifications.enabled = true;
  persistAppState();
  showToast("تم تشغيل التذكير");
}

function reminderOption(id) {
  return REMINDER_OPTIONS.find((option) => option.id === id) || REMINDER_OPTIONS[0];
}

async function maybeSendDueReminder() {
  if (!state.feed.length || !state.notifications.enabled || state.notificationPermission !== "granted") {
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
  if (!state.feed.length || !isNotificationSupported() || state.notificationPermission !== "granted") {
    if (!quiet) {
      showToast("اسمح بالإشعارات أولًا");
    }
    return false;
  }

  const record = force ? state.feed[state.activeFeedIndex] || state.feed[0] : state.feed[0];
  const title = test ? "مجتهد · تنبيه تجريبي" : "مجتهد · حديث جديد";
  const options = {
    body: trimText(record.arabicText, 86),
    dir: "auto",
    lang: "ar",
    tag: test ? "mujtahid-test" : `hadith-${record.id}`,
    icon: "./assets/icon-192.png",
    badge: "./assets/icon-192.png",
    data: { hadithId: record.id, url: `./?hadith=${record.id}` }
  };

  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null;
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }

    state.notifications.lastSentAt = new Date().toISOString();
    persistAppState();
    if (!quiet) {
      showToast(test ? "تم إرسال تنبيه تجريبي" : "تم إرسال التذكير");
    }
    return true;
  } catch {
    if (!quiet) {
      showToast("تعذر إرسال التذكير");
    }
    return false;
  }
}

function persistAppState() {
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(state.favorites));
  localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(state.notifications));
}

function clearLaunchQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete("hadith");
  history.replaceState({}, "", url);
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

function normalizeSpace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function trimText(text, maxLength) {
  const value = String(text || "");
  return value.length <= maxLength ? value : `${value.slice(0, maxLength).trim()}...`;
}

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
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
function renderMark() {
  return `
    <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="4" width="88" height="88" rx="26" fill="url(#mark-bg)" stroke="url(#mark-stroke)" stroke-width="2.4"/>
      <path d="M24 60.5 48 49l24 11.5" stroke="url(#mark-gold)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M31 60V39.5L48 47.5 65 39.5V60" stroke="url(#mark-gold)" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M48 25c4.4 0 7.8 4 7.8 9 0 7-7.8 13.8-7.8 13.8S40.2 41 40.2 34c0-5 3.4-9 7.8-9Z" fill="url(#mark-gold)"/>
      <path d="M48 28.5c1.9 2.3 2.8 4.1 2.8 5.7 0 2.2-1.2 3.8-2.8 5.1-1.6-1.3-2.8-2.9-2.8-5.1 0-1.6.9-3.4 2.8-5.7Z" fill="#0c3548"/>
      <defs>
        <linearGradient id="mark-bg" x1="12" y1="10" x2="84" y2="88" gradientUnits="userSpaceOnUse">
          <stop stop-color="#15506A"/>
          <stop offset="1" stop-color="#082331"/>
        </linearGradient>
        <linearGradient id="mark-gold" x1="26" y1="26" x2="70" y2="72" gradientUnits="userSpaceOnUse">
          <stop stop-color="#F4DEB0"/>
          <stop offset="1" stop-color="#C99D55"/>
        </linearGradient>
        <linearGradient id="mark-stroke" x1="12" y1="8" x2="82" y2="90" gradientUnits="userSpaceOnUse">
          <stop stop-color="#F2D8A4"/>
          <stop offset="1" stop-color="#8E6B32"/>
        </linearGradient>
      </defs>
    </svg>
  `;
}

function renderIcon(name) {
  const icons = {
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4.5 10.2 12 4l7.5 6.2v8.3a1.5 1.5 0 0 1-1.5 1.5h-3.9v-5.1a2.1 2.1 0 0 0-4.2 0V20H6a1.5 1.5 0 0 1-1.5-1.5z" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5" stroke-linecap="round"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6.8 16.5h10.4l-1.1-1.8V10a4.1 4.1 0 0 0-8.2 0v4.7z" stroke-linejoin="round"/><path d="M10.2 18.2a1.9 1.9 0 0 0 3.6 0" stroke-linecap="round"/></svg>`,
    source: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10 14 20 4" stroke-linecap="round"/><path d="M14 4h6v6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 8 9 12l6 4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="6" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18" r="2.5"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="8" y="8" width="10" height="12" rx="2"/><path d="M6 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20.5s-7-4.4-7-10.2A4.3 4.3 0 0 1 9.3 6a4.7 4.7 0 0 1 2.7.9 4.7 4.7 0 0 1 2.7-.9A4.3 4.3 0 0 1 19 10.3c0 5.8-7 10.2-7 10.2Z" stroke-linejoin="round"/></svg>`,
    heartFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"><path d="M12 20.5s-7-4.4-7-10.2A4.3 4.3 0 0 1 9.3 6a4.7 4.7 0 0 1 2.7.9 4.7 4.7 0 0 1 2.7-.9A4.3 4.3 0 0 1 19 10.3c0 5.8-7 10.2-7 10.2Z"/></svg>`,
    compass: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="8"/><path d="m9.2 14.8 1.8-5.4 5.4-1.8-1.8 5.4z" stroke-linejoin="round"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m7 7 10 10M17 7 7 17" stroke-linecap="round"/></svg>`,
    spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3.5 14.2 9l5.3 2.2-5.3 2.2L12 19l-2.2-5.6L4.5 11.2 9.8 9z" stroke-linejoin="round"/></svg>`,
    swipe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 19V5" stroke-linecap="round"/><path d="m7.5 9.5 4.5-4.5 4.5 4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };

  return icons[name] || "";
}
