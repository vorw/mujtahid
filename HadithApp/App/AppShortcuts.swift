import AppIntents
import HadithCore

struct OpenDailyHadithIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Daily Hadith"
    static var description = IntentDescription("Open today’s featured hadith.")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        let repository = HadithRepository()
        let routeStore = PendingRouteStore()
        if let record = repository.featuredHadith(for: .now) {
            routeStore.setPendingURL(AppDeepLink.hadith(id: record.id).absoluteString)
        }
        return .result()
    }
}

struct OpenQiblaIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Qibla"
    static var description = IntentDescription("Open the qibla compass and map.")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        PendingRouteStore().setPendingURL(AppDeepLink.qibla().absoluteString)
        return .result()
    }
}

struct OpenPrayerTimesIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Today’s Prayer Times"
    static var description = IntentDescription("Open the prayer-time profile for today.")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        PendingRouteStore().setPendingURL(AppDeepLink.prayerTimes().absoluteString)
        return .result()
    }
}

struct HadithAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        [
            AppShortcut(
                intent: OpenDailyHadithIntent(),
                phrases: [
                    "Open today’s hadith in \(.applicationName)",
                    "Show daily hadith in \(.applicationName)"
                ],
                shortTitle: "Daily Hadith",
                systemImageName: "book.closed"
            ),
            AppShortcut(
                intent: OpenQiblaIntent(),
                phrases: [
                    "Open qibla in \(.applicationName)",
                    "Show qibla compass in \(.applicationName)"
                ],
                shortTitle: "Qibla",
                systemImageName: "location.north.line"
            ),
            AppShortcut(
                intent: OpenPrayerTimesIntent(),
                phrases: [
                    "Open prayer times in \(.applicationName)",
                    "Show prayer times in \(.applicationName)"
                ],
                shortTitle: "Prayer Times",
                systemImageName: "clock.badge.checkmark"
            )
        ]
    }
}
