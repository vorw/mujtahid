import AppIntents

enum DailyHadithCollectionFilter: String, AppEnum {
    case all
    case bukhari
    case muslim

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Collection Filter")
    static var caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .all: "All collections",
        .bukhari: "Bukhari only",
        .muslim: "Muslim only"
    ]
}

struct DailyHadithWidgetConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Daily Hadith"
    static var description = IntentDescription("Choose which collection to prioritize in the daily hadith widget.")

    @Parameter(title: "Collection")
    var collection: DailyHadithCollectionFilter

    init() {
        collection = .all
    }
}

struct PrayerWidgetConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Prayer Times"
    static var description = IntentDescription("Choose whether the prayer widget should show only the next prayer or the full day.")

    @Parameter(title: "Show all times")
    var showAllTimes: Bool

    init() {
        showAllTimes = false
    }
}
