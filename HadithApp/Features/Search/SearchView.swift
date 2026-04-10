import HadithCore
import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var model: AppModel
    @State private var query = ""
    @State private var selectedCollection: HadithCollection?

    private var results: [HadithRecord] {
        model.search(query: query, collection: selectedCollection)
    }

    var body: some View {
        List {
            Section {
                Picker("Collection", selection: $selectedCollection) {
                    Text("All collections").tag(HadithCollection?.none)
                    ForEach(HadithCollection.allCases) { collection in
                        Text(collection.displayName).tag(Optional(collection))
                    }
                }
                .pickerStyle(.menu)
            }

            Section("Results") {
                ForEach(results) { hadith in
                    NavigationLink(value: AppRoute.hadith(hadith.id)) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(hadith.displayTitle)
                                .font(.headline)
                            Text(hadith.englishText)
                                .lineLimit(2)
                                .foregroundStyle(.secondary)
                            Text(hadith.narrator)
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
            }
        }
        .searchable(text: $query, prompt: "Search Arabic, English, narrator, chapter")
        .navigationTitle("Search")
    }
}
