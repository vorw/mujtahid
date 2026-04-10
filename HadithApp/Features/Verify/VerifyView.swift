import HadithCore
import SwiftUI

struct VerifyView: View {
    @EnvironmentObject private var model: AppModel
    @State private var snippet = ""

    private var results: [VerificationResult] {
        model.verify(text: snippet)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                FeatureCard(
                    title: "Verify a hadith",
                    subtitle: "Paste Arabic or English text to find the closest canonical match."
                ) {
                    TextEditor(text: $snippet)
                        .frame(minHeight: 150)
                        .padding(8)
                        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    HStack {
                        Button("Use daily hadith") {
                            snippet = model.dailyHadith?.arabicText ?? ""
                        }
                        .buttonStyle(.bordered)

                        Spacer()

                        Text("Matches update as you type")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                FeatureCard(
                    title: "Matches",
                    subtitle: results.isEmpty ? "No confident match yet" : "\(results.count) results"
                ) {
                    if results.isEmpty {
                        Text("Paste a longer phrase to improve confidence.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(results.prefix(6)) { result in
                            NavigationLink(value: AppRoute.hadith(result.hadith.id)) {
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack {
                                        Text(result.hadith.displayTitle)
                                            .font(.headline)
                                        Spacer()
                                        StatusBadge(text: "\(Int(result.score * 100))%", tint: .green)
                                    }
                                    Text(result.hadith.englishText)
                                        .lineLimit(3)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(.vertical, 6)
                            }
                            if result.id != results.prefix(6).last?.id {
                                Divider()
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Verify")
    }
}
