import HadithCore
import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                introSection
                dailyHadithSection
                utilitySection
                trustSection
            }
            .padding()
        }
        .navigationTitle("Hadith")
    }

    private var introSection: some View {
        FeatureCard(
            title: "Trust-first daily study",
            subtitle: "Bukhari and Muslim, with visible verification references and no ad clutter."
        ) {
            HStack {
                StatusBadge(text: "No ads", tint: .green)
                StatusBadge(text: "Free", tint: .blue)
                StatusBadge(text: "Source-first", tint: .orange)
            }
        }
    }

    private var dailyHadithSection: some View {
        FeatureCard(
            title: "Daily hadith",
            subtitle: model.dailyHadith?.displayTitle
        ) {
            if let hadith = model.dailyHadith {
                VStack(alignment: .leading, spacing: 12) {
                    Text(hadith.arabicText)
                        .font(.system(size: 24, weight: .semibold, design: .serif))
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .multilineTextAlignment(.trailing)
                    Text(hadith.englishText)
                        .font(.body)
                        .foregroundStyle(.secondary)
                    NavigationLink(value: AppRoute.hadith(hadith.id)) {
                        Label("Open hadith", systemImage: "arrow.right.circle.fill")
                            .font(.subheadline.weight(.semibold))
                    }
                    .padding(.top, 4)
                }
            } else {
                Text("Seed content has not loaded yet.")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var utilitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Utilities")
                .font(.title3.weight(.semibold))

            ViewThatFits {
                HStack(spacing: 12) {
                    prayerButton
                    qiblaButton
                }

                VStack(spacing: 12) {
                    prayerButton
                    qiblaButton
                }
            }
        }
    }

    private var prayerButton: some View {
        UtilityShortcutButton(
            title: "Prayer Times",
            subtitle: "Transparent method selection with local adjustments.",
            systemImage: "clock.badge.checkmark",
            tint: .indigo
        ) {
            model.open(.prayer)
        }
    }

    private var qiblaButton: some View {
        UtilityShortcutButton(
            title: "Qibla",
            subtitle: "Compass and map views with confidence labels.",
            systemImage: "location.north.line.fill",
            tint: .teal
        ) {
            model.open(.qibla)
        }
    }

    private var trustSection: some View {
        FeatureCard(
            title: "How we verify",
            subtitle: "Canonical collections, trust references, and content versioning."
        ) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Source collections: \(model.manifest.canonicalCollections.joined(separator: ", "))")
                    .foregroundStyle(.secondary)
                Text("Verification sources: \(model.manifest.verificationSources.joined(separator: ", "))")
                    .foregroundStyle(.secondary)
                NavigationLink(value: AppRoute.trust) {
                    Label("Review methodology", systemImage: "doc.text.magnifyingglass")
                }
            }
        }
    }
}
