import Combine
import Foundation

public final class BookmarkStore: ObservableObject {
    @Published public private(set) var bookmarkedIDs: Set<String>

    private let defaults: UserDefaults
    private let key = "bookmarked.hadith.ids"

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.bookmarkedIDs = Set(defaults.stringArray(forKey: key) ?? [])
    }

    public func contains(_ id: String) -> Bool {
        bookmarkedIDs.contains(id)
    }

    public func toggle(_ id: String) {
        if bookmarkedIDs.contains(id) {
            bookmarkedIDs.remove(id)
        } else {
            bookmarkedIDs.insert(id)
        }
        defaults.set(Array(bookmarkedIDs).sorted(), forKey: key)
    }
}

public final class PrayerSettingsStore: ObservableObject {
    @Published public var methodOverride: PrayerMethod?
    @Published public var juristicMethod: JuristicMethod
    @Published public var perPrayerOffsets: [PrayerEvent: Int]

    private let defaults: UserDefaults
    private let methodKey = "prayer.method.override"
    private let juristicKey = "prayer.juristic.method"
    private let offsetsKey = "prayer.per.prayer.offsets"

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults

        if let raw = defaults.string(forKey: methodKey) {
            self.methodOverride = PrayerMethod(rawValue: raw)
        } else {
            self.methodOverride = nil
        }

        self.juristicMethod = JuristicMethod(rawValue: defaults.string(forKey: juristicKey) ?? "") ?? .standard

        if
            let data = defaults.data(forKey: offsetsKey),
            let decoded = try? JSONDecoder().decode([PrayerEvent: Int].self, from: data)
        {
            self.perPrayerOffsets = decoded
        } else {
            self.perPrayerOffsets = [:]
        }
    }

    public func setMethodOverride(_ method: PrayerMethod?) {
        methodOverride = method
        defaults.set(method?.rawValue, forKey: methodKey)
    }

    public func setJuristicMethod(_ method: JuristicMethod) {
        juristicMethod = method
        defaults.set(method.rawValue, forKey: juristicKey)
    }

    public func setOffset(_ minutes: Int, for event: PrayerEvent) {
        perPrayerOffsets[event] = minutes
        if let data = try? JSONEncoder().encode(perPrayerOffsets) {
            defaults.set(data, forKey: offsetsKey)
        }
    }
}

public final class WidgetSnapshotStore {
    private let defaults: UserDefaults

    public init(defaults: UserDefaults = AppGroupConfiguration.defaults) {
        self.defaults = defaults
    }

    public func save(snapshot: WidgetContentSnapshot) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(snapshot) else { return }
        defaults.set(data, forKey: AppGroupConfiguration.widgetSnapshotKey)
    }

    public func load() -> WidgetContentSnapshot? {
        guard let data = defaults.data(forKey: AppGroupConfiguration.widgetSnapshotKey) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(WidgetContentSnapshot.self, from: data)
    }
}

public final class PendingRouteStore {
    private let defaults: UserDefaults

    public init(defaults: UserDefaults = AppGroupConfiguration.defaults) {
        self.defaults = defaults
    }

    public func setPendingURL(_ urlString: String) {
        defaults.set(urlString, forKey: AppGroupConfiguration.pendingRouteKey)
    }

    public func consumePendingURL() -> URL? {
        guard let value = defaults.string(forKey: AppGroupConfiguration.pendingRouteKey) else { return nil }
        defaults.removeObject(forKey: AppGroupConfiguration.pendingRouteKey)
        return URL(string: value)
    }
}
