import HadithCore
import SwiftUI

struct LibraryView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        List {
            Section("Saved hadith") {
                if model.bookmarkedHadiths.isEmpty {
                    Text("Bookmarks you save from search, home, or verification will appear here.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(model.bookmarkedHadiths) { hadith in
                        NavigationLink(value: AppRoute.hadith(hadith.id)) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(hadith.displayTitle)
                                    .font(.headline)
                                Text(hadith.englishText)
                                    .lineLimit(2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            Section("Prayer profile") {
                if let prayerDay = model.currentPrayerDay {
                    LabeledContent("Location", value: prayerDay.locationName)
                    LabeledContent("Method", value: prayerDay.method.displayName)
                    LabeledContent("Trust", value: prayerDay.locationTrustState.label)
                } else {
                    Text("Enable location to save a verified prayer profile.")
                        .foregroundStyle(.secondary)
                }
            }

            Section("Trust center") {
                NavigationLink(value: AppRoute.trust) {
                    Label("How We Verify", systemImage: "checkmark.shield")
                }
            }
        }
        .navigationTitle("Library")
    }
}
