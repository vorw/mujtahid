import AppIntents
import HadithCore
import SwiftUI
import WidgetKit

struct PrayerTimesEntry: TimelineEntry {
    let date: Date
    let snapshot: PrayerWidgetSnapshot
    let showAllTimes: Bool
}

struct PrayerTimesProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> PrayerTimesEntry {
        PrayerTimesEntry(
            date: .now,
            snapshot: PrayerWidgetSnapshot(
                city: "Riyadh",
                methodLabel: "Umm al-Qura",
                locationLabel: "Last confirmed in app",
                trustLabel: "Precise",
                nextPrayerName: "Asr",
                nextPrayerTime: .now.addingTimeInterval(1800),
                allPrayerTimes: []
            ),
            showAllTimes: false
        )
    }

    func snapshot(for configuration: PrayerWidgetConfigurationIntent, in context: Context) async -> PrayerTimesEntry {
        PrayerTimesEntry(date: .now, snapshot: currentSnapshot(), showAllTimes: configuration.showAllTimes)
    }

    func timeline(for configuration: PrayerWidgetConfigurationIntent, in context: Context) async -> Timeline<PrayerTimesEntry> {
        let snapshot = currentSnapshot()
        let refreshDate = max(snapshot.nextPrayerTime, .now.addingTimeInterval(900))
        return Timeline(
            entries: [PrayerTimesEntry(date: .now, snapshot: snapshot, showAllTimes: configuration.showAllTimes)],
            policy: .after(refreshDate)
        )
    }

    private func currentSnapshot() -> PrayerWidgetSnapshot {
        if let snapshot = WidgetSnapshotStore().load()?.prayerSummary {
            return snapshot
        }

        return PrayerWidgetSnapshot(
            city: "Open the app",
            methodLabel: "Pending",
            locationLabel: "Location needed",
            trustLabel: "Unavailable",
            nextPrayerName: "Prayer",
            nextPrayerTime: .now.addingTimeInterval(3600),
            allPrayerTimes: []
        )
    }
}

struct PrayerTimesWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: "PrayerTimesWidget",
            intent: PrayerWidgetConfigurationIntent.self,
            provider: PrayerTimesProvider()
        ) { entry in
            PrayerTimesWidgetView(entry: entry)
                .widgetURL(AppDeepLink.prayerTimes())
        }
        .configurationDisplayName("Prayer Times")
        .description("Show the next prayer and the method used for the current city.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

private struct PrayerTimesWidgetView: View {
    let entry: PrayerTimesEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(entry.snapshot.city)
                .font(.headline)
            HStack {
                Text(entry.snapshot.methodLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(entry.snapshot.trustLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Next: \(entry.snapshot.nextPrayerName)")
                    .font(.subheadline.weight(.semibold))
                Text(entry.snapshot.nextPrayerTime, style: .timer)
                    .font(.title3.weight(.bold))
                Text(entry.snapshot.nextPrayerTime.formatted(date: .omitted, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if family == .systemMedium, entry.showAllTimes, !entry.snapshot.allPrayerTimes.isEmpty {
                Divider()
                HStack {
                    ForEach(entry.snapshot.allPrayerTimes.prefix(6)) { item in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.event.displayName.prefix(1))
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.secondary)
                            Text(item.time.formatted(date: .omitted, time: .shortened))
                                .font(.caption2)
                        }
                        if item.id != entry.snapshot.allPrayerTimes.prefix(6).last?.id {
                            Spacer()
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
}
