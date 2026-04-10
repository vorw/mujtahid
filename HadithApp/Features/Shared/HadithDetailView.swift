import HadithCore
import SwiftUI

struct HadithDetailView: View {
    @EnvironmentObject private var model: AppModel
    let hadithID: String

    var body: some View {
        ScrollView {
            if let hadith = model.hadith(id: hadithID) {
                VStack(alignment: .leading, spacing: 18) {
                    header(for: hadith)
                    FeatureCard(title: "Arabic text") {
                        Text(hadith.arabicText)
                            .font(.system(size: 24, weight: .semibold, design: .serif))
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            .multilineTextAlignment(.trailing)
                    }
                    FeatureCard(title: "English translation") {
                        Text(hadith.englishText)
                            .font(.body)
                    }
                    metadata(for: hadith)
                    references(for: hadith)
                }
                .padding()
            } else {
                ContentUnavailableView("Hadith not found", systemImage: "books.vertical")
            }
        }
        .navigationTitle("Hadith Detail")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func header(for hadith: HadithRecord) -> some View {
        FeatureCard(title: hadith.displayTitle, subtitle: hadith.chapterTitle) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    StatusBadge(text: hadith.collection.shortLabel, tint: .indigo)
                    StatusBadge(text: hadith.grade.label, tint: .green)
                }

                HStack {
                    Text("Narrator: \(hadith.narrator)")
                        .foregroundStyle(.secondary)
                    Spacer()
                    Button {
                        model.toggleBookmark(hadith.id)
                    } label: {
                        Label(
                            model.bookmarks.contains(hadith.id) ? "Saved" : "Save",
                            systemImage: model.bookmarks.contains(hadith.id) ? "bookmark.fill" : "bookmark"
                        )
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
    }

    private func metadata(for hadith: HadithRecord) -> some View {
        FeatureCard(title: "Metadata") {
            VStack(alignment: .leading, spacing: 8) {
                LabeledContent("Book", value: "\(hadith.bookNumber) · \(hadith.bookTitle)")
                LabeledContent("Chapter", value: hadith.chapterTitle)
                LabeledContent("Hadith number", value: "\(hadith.hadithNumber)")
                if let globalNumber = hadith.globalNumber {
                    LabeledContent("Global number", value: "\(globalNumber)")
                }
                LabeledContent("Source edition", value: hadith.sourceEdition)
                LabeledContent("Translation", value: hadith.translationSource)
                LabeledContent("Verified", value: hadith.verifiedAt.formatted(date: .abbreviated, time: .omitted))
                LabeledContent("Checksum", value: hadith.checksum)
            }
            .font(.subheadline)
        }
    }

    @ViewBuilder
    private func references(for hadith: HadithRecord) -> some View {
        FeatureCard(title: "References", subtitle: "Linked trust material where available") {
            if hadith.scholarReferences.isEmpty {
                Text("This seed record has no hadith-specific reference attached yet. The app trust center still documents the source pipeline and verification approach.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(hadith.scholarReferences) { reference in
                    if let url = reference.url {
                        Link(destination: url) {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(reference.title)
                                        .font(.headline)
                                    Spacer()
                                    StatusBadge(text: reference.referenceType.displayName, tint: .orange)
                                }
                                Text(reference.summary)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                Text(reference.reviewState.label)
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 4)
                        }
                        if reference.id != hadith.scholarReferences.last?.id {
                            Divider()
                        }
                    }
                }
            }
        }
    }
}
