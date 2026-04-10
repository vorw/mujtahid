import Combine
import CoreLocation
import Foundation
import HadithCore
import WidgetKit

enum AppTab: String, CaseIterable, Hashable {
    case home
    case search
    case verify
    case library
}

enum AppRoute: Hashable {
    case hadith(String)
    case prayer
    case qibla
    case trust
    case compareMethods
}

@MainActor
final class AppModel: ObservableObject {
    @Published var selectedTab: AppTab = .home
    @Published var path: [AppRoute] = []
    @Published private(set) var currentPrayerDay: PrayerDay?
    @Published private(set) var currentQiblaState: QiblaState?

    let repository = HadithRepository()
    let bookmarks = BookmarkStore()
    let prayerSettings = PrayerSettingsStore()
    let locationController = LocationController()

    private let prayerCalculator = PrayerCalculator()
    private let qiblaCalculator = QiblaCalculator()
    private let snapshotStore = WidgetSnapshotStore()
    private let pendingRouteStore = PendingRouteStore()
    private var cancellables = Set<AnyCancellable>()

    init() {
        locationController.objectWillChange
            .sink { [weak self] _ in
                Task { @MainActor in self?.refreshDerivedState() }
            }
            .store(in: &cancellables)

        prayerSettings.objectWillChange
            .sink { [weak self] _ in
                Task { @MainActor in self?.refreshDerivedState() }
            }
            .store(in: &cancellables)

        refreshDerivedState()
    }

    var manifest: HadithContentManifest { repository.manifest }

    var dailyHadith: HadithRecord? {
        repository.featuredHadith(for: .now)
    }

    var bookmarkedHadiths: [HadithRecord] {
        repository.records.filter { bookmarks.contains($0.id) }
    }

    func upcomingPrayer() -> PrayerTimeEntry? {
        if let next = currentPrayerDay?.nextPrayer(after: .now) {
            return next
        }

        guard let location = locationController.location else { return nil }
        let method = prayerSettings.methodOverride ?? PrayerMethodPolicy.defaultMethod(for: locationController.countryCode)

        let tomorrowContext = PrayerCalculationContext(
            date: Calendar.current.date(byAdding: .day, value: 1, to: .now) ?? .now,
            coordinate: location.coordinate,
            timeZone: .current,
            locationName: locationController.locationName,
            method: method,
            juristicMethod: prayerSettings.juristicMethod,
            locationTrustState: locationController.trustState,
            offsets: prayerSettings.perPrayerOffsets
        )

        return prayerCalculator.calculateDay(using: tomorrowContext)?.entries.first
    }

    func search(query: String, collection: HadithCollection?) -> [HadithRecord] {
        repository.search(query: query, collection: collection)
    }

    func verify(text: String) -> [VerificationResult] {
        repository.verify(snippet: text)
    }

    func hadith(id: String) -> HadithRecord? {
        repository.record(id: id)
    }

    func toggleBookmark(_ id: String) {
        bookmarks.toggle(id)
        refreshSnapshots()
    }

    func requestLocationAccess() {
        locationController.requestAccessIfNeeded()
    }

    func open(_ route: AppRoute) {
        selectedTab = route.preferredTab
        path = [route]
    }

    func push(_ route: AppRoute) {
        path.append(route)
    }

    func consumePendingRouteIfNeeded() {
        guard let url = pendingRouteStore.consumePendingURL() else { return }
        handleIncomingURL(url)
    }

    func handleIncomingURL(_ url: URL) {
        guard url.scheme == "hadithapp" else { return }

        switch url.host {
        case "qibla":
            open(.qibla)
        case "prayer":
            open(.prayer)
        case "trust":
            open(.trust)
        case "hadith":
            if let id = url.pathComponents.dropFirst().first {
                open(.hadith(id))
            }
        default:
            selectedTab = .home
        }
    }

    func comparePrayerMethods() -> [PrayerDay] {
        guard let location = locationController.location else { return [] }
        return prayerCalculator.compare(
            for: .now,
            coordinate: location.coordinate,
            timeZone: .current,
            locationName: locationController.locationName,
            juristicMethod: prayerSettings.juristicMethod
        )
    }

    private func refreshDerivedState() {
        if let location = locationController.location {
            let method = prayerSettings.methodOverride ?? PrayerMethodPolicy.defaultMethod(for: locationController.countryCode)
            currentPrayerDay = prayerCalculator.calculateDay(
                using: PrayerCalculationContext(
                    date: .now,
                    coordinate: location.coordinate,
                    timeZone: .current,
                    locationName: locationController.locationName,
                    method: method,
                    juristicMethod: prayerSettings.juristicMethod,
                    locationTrustState: locationController.trustState,
                    offsets: prayerSettings.perPrayerOffsets
                )
            )
        } else {
            currentPrayerDay = nil
        }

        currentQiblaState = qiblaCalculator.state(
            location: locationController.location,
            heading: locationController.heading,
            locationName: locationController.locationName,
            trust: locationController.trustState
        )

        refreshSnapshots()
    }

    private func refreshSnapshots() {
        guard let dailyHadith else { return }

        let snapshot = WidgetContentSnapshot(
            generatedAt: .now,
            dailyHadith: DailyHadithSnapshot(
                hadithID: dailyHadith.id,
                collectionLabel: dailyHadith.collection.displayName,
                arabicText: dailyHadith.arabicText,
                englishText: dailyHadith.englishText,
                sourceLabel: "\(dailyHadith.collection.shortLabel) \(dailyHadith.hadithNumber)"
            ),
            prayerSummary: currentPrayerDay.flatMap { day in
                guard let nextPrayer = upcomingPrayer() else { return nil }
                return PrayerWidgetSnapshot(
                    city: day.locationName,
                    methodLabel: day.method.shortLabel,
                    locationLabel: day.locationName,
                    trustLabel: day.locationTrustState.label,
                    nextPrayerName: nextPrayer.event.displayName,
                    nextPrayerTime: nextPrayer.time,
                    allPrayerTimes: day.entries
                )
            }
        )

        snapshotStore.save(snapshot: snapshot)
        WidgetCenter.shared.reloadAllTimelines()
    }
}

private extension AppRoute {
    var preferredTab: AppTab {
        switch self {
        case .hadith, .trust, .prayer, .qibla, .compareMethods:
            return .home
        }
    }
}
