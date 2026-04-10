import HadithCore
import SwiftUI

struct HowWeVerifyView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                FeatureCard(
                    title: "Verification policy",
                    subtitle: "What is canonical text, what is editorial metadata, and how trust signals are displayed."
                ) {
                    Text("Canonical text comes from Sahih al-Bukhari and Sahih Muslim. BinBaz is treated as a trust reference and Dorar as the operational lookup and methodology layer. No AI-generated religious interpretation is shipped in v1.")
                        .foregroundStyle(.secondary)
                }

                FeatureCard(title: "Collections") {
                    ForEach(model.manifest.canonicalCollections, id: \.self) { collection in
                        Label(collection, systemImage: "book.closed")
                            .padding(.vertical, 2)
                    }
                }

                FeatureCard(title: "Verification sources") {
                    ForEach(model.manifest.verificationSources, id: \.self) { source in
                        Label(source, systemImage: "checkmark.shield")
                            .padding(.vertical, 2)
                    }
                }

                FeatureCard(title: "Content version") {
                    VStack(alignment: .leading, spacing: 8) {
                        LabeledContent("Version", value: model.manifest.version)
                        LabeledContent("Updated", value: model.manifest.updatedAt.formatted(date: .abbreviated, time: .shortened))
                        ForEach(model.manifest.notes, id: \.self) { note in
                            Text("• \(note)")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle("How We Verify")
    }
}
