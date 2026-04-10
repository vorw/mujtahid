import AppIntents
import HadithCore
import SwiftUI
import WidgetKit

struct DailyHadithEntry: TimelineEntry {
    let date: Date
    let snapshot: DailyHadithSnapshot
}

struct DailyHadithProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> DailyHadithEntry {
        DailyHadithEntry(
            date: .now,
            snapshot: DailyHadithSnapshot(
                hadithID: "placeholder",
                collectionLabel: "Sahih al-Bukhari",
                arabicText: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ",
                englishText: "Actions are judged by intentions.",
                sourceLabel: "Bukhari 1"
            )
        )
    }

    func snapshot(for configuration: DailyHadithWidgetConfigurationIntent, in context: Context) async -> DailyHadithEntry {
        DailyHadithEntry(date: .now, snapshot: featuredSnapshot(for: configuration))
    }

    func timeline(for configuration: DailyHadithWidgetConfigurationIntent, in context: Context) async -> Timeline<DailyHadithEntry> {
        let entry = DailyHadithEntry(date: .now, snapshot: featuredSnapshot(for: configuration))
        let tomorrow = Calendar.current.startOfDay(for: .now).addingTimeInterval(24 * 60 * 60)
        return Timeline(entries: [entry], policy: .after(tomorrow))
    }

    private func featuredSnapshot(for configuration: DailyHadithWidgetConfigurationIntent) -> DailyHadithSnapshot {
        let repository = HadithRepository()
        let filteredRecords: [HadithRecord]
        switch configuration.collection {
        case .all:
            filteredRecords = repository.records
        case .bukhari:
            filteredRecords = repository.records.filter { $0.collection == .bukhari }
        case .muslim:
            filteredRecords = repository.records.filter { $0.collection == .muslim }
        }

        let record = filteredRecords.isEmpty ? repository.featuredHadith(for: .now) : filteredRecords[Calendar.current.ordinality(of: .day, in: .year, for: .now).map { ($0 - 1) % filteredRecords.count } ?? 0]

        return DailyHadithSnapshot(
            hadithID: record?.id ?? "placeholder",
            collectionLabel: record?.collection.displayName ?? "Hadith",
            arabicText: record?.arabicText ?? "Seed content unavailable",
            englishText: record?.englishText ?? "",
            sourceLabel: record.map { "\($0.collection.shortLabel) \($0.hadithNumber)" } ?? "Unavailable"
        )
    }
}

struct DailyHadithWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: "DailyHadithWidget",
            intent: DailyHadithWidgetConfigurationIntent.self,
            provider: DailyHadithProvider()
        ) { entry in
            DailyHadithWidgetView(entry: entry)
                .widgetURL(AppDeepLink.hadith(id: entry.snapshot.hadithID))
        }
        .configurationDisplayName("Daily Hadith")
        .description("Open a daily hadith with a visible source label.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

private struct DailyHadithWidgetView: View {
    let entry: DailyHadithEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(entry.snapshot.sourceLabel)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(entry.snapshot.arabicText)
                .font(family == .systemSmall ? .system(size: 15, weight: .semibold, design: .serif) : .system(size: 18, weight: .semibold, design: .serif))
                .lineLimit(family == .systemSmall ? 3 : 4)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .multilineTextAlignment(.trailing)
            if family == .systemMedium {
                Text(entry.snapshot.englishText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
            Spacer(minLength: 0)
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
}
