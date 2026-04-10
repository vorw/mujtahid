import HadithCore
import SwiftUI

struct PrayerTimesView: View {
    @EnvironmentObject private var model: AppModel

    private var defaultMethod: PrayerMethod {
        PrayerMethodPolicy.defaultMethod(for: model.locationController.countryCode)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                summaryCard
                prayerTimeline
                settingsCard
            }
            .padding()
        }
        .navigationTitle("Prayer Times")
        .task {
            model.requestLocationAccess()
        }
    }

    private var summaryCard: some View {
        FeatureCard(
            title: "Today’s prayer profile",
            subtitle: model.currentPrayerDay?.locationName ?? "Location required"
        ) {
            if let prayerDay = model.currentPrayerDay {
                let nextPrayer = model.upcomingPrayer()
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        StatusBadge(text: prayerDay.method.shortLabel, tint: .indigo)
                        StatusBadge(text: prayerDay.locationTrustState.label, tint: badgeTint(for: prayerDay.locationTrustState))
                    }

                    if let nextPrayer {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Next prayer: \(nextPrayer.event.displayName)")
                                .font(.headline)
                            Text(nextPrayer.time, style: .timer)
                                .font(.title2.weight(.semibold))
                            Text(nextPrayer.time.formatted(date: .omitted, time: .shortened))
                                .foregroundStyle(.secondary)
                        }
                    }

                    ForEach(prayerDay.notes, id: \.self) { note in
                        Text("• \(note)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Enable precise location to calculate prayer times using a visible method and your local time zone.")
                        .foregroundStyle(.secondary)
                    Button("Enable location") {
                        model.requestLocationAccess()
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
    }

    private var prayerTimeline: some View {
        FeatureCard(title: "Prayer timeline", subtitle: "Deterministic calculations with optional local offsets") {
            if let prayerDay = model.currentPrayerDay {
                ForEach(prayerDay.entries) { entry in
                    HStack {
                        Text(entry.event.displayName)
                            .font(.headline)
                        Spacer()
                        Text(entry.time.formatted(date: .omitted, time: .shortened))
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                    if entry.id != prayerDay.entries.last?.id {
                        Divider()
                    }
                }
            } else {
                Text("Prayer times will appear after location is available.")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var settingsCard: some View {
        FeatureCard(title: "Method and local adjustments", subtitle: "Transparent defaults with manual control") {
            VStack(alignment: .leading, spacing: 12) {
                Picker("Method", selection: Binding(
                    get: { model.prayerSettings.methodOverride ?? defaultMethod },
                    set: { model.prayerSettings.setMethodOverride($0) }
                )) {
                    ForEach(PrayerMethod.allCases) { method in
                        Text(method.displayName).tag(method)
                    }
                }
                .pickerStyle(.menu)

                if model.prayerSettings.methodOverride != nil {
                    Button("Use region default (\(defaultMethod.displayName))") {
                        model.prayerSettings.setMethodOverride(nil)
                    }
                    .buttonStyle(.bordered)
                }

                Picker("Asr juristic method", selection: Binding(
                    get: { model.prayerSettings.juristicMethod },
                    set: { model.prayerSettings.setJuristicMethod($0) }
                )) {
                    ForEach(JuristicMethod.allCases) { method in
                        Text(method.displayName).tag(method)
                    }
                }
                .pickerStyle(.menu)

                Divider()

                ForEach(PrayerEvent.allCases) { event in
                    Stepper(
                        value: Binding(
                            get: { model.prayerSettings.perPrayerOffsets[event] ?? 0 },
                            set: { model.prayerSettings.setOffset($0, for: event) }
                        ),
                        in: -30...30
                    ) {
                        HStack {
                            Text("\(event.displayName) offset")
                            Spacer()
                            Text("\(model.prayerSettings.perPrayerOffsets[event] ?? 0) min")
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                NavigationLink(value: AppRoute.compareMethods) {
                    Label("Compare recognized methods", systemImage: "chart.bar.xaxis")
                }
                .padding(.top, 4)
            }
        }
    }

    private func badgeTint(for trust: LocationTrustState) -> Color {
        switch trust {
        case .precise:
            return .green
        case .reduced, .stale:
            return .orange
        case .unavailable:
            return .red
        }
    }
}

struct PrayerMethodComparisonView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        List {
            if model.comparePrayerMethods().isEmpty {
                Text("Enable location first to compare recognized methods for your current region.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(model.comparePrayerMethods(), id: \.method) { prayerDay in
                    Section(prayerDay.method.displayName) {
                        ForEach(prayerDay.entries) { entry in
                            HStack {
                                Text(entry.event.displayName)
                                Spacer()
                                Text(entry.time.formatted(date: .omitted, time: .shortened))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Compare Methods")
    }
}
