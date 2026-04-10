import Foundation

public enum AppGroupConfiguration {
    public static let identifier = "group.com.example.hadithapp.shared"
    public static let widgetSnapshotKey = "widget.snapshot"
    public static let pendingRouteKey = "pending.route"

    public static var defaults: UserDefaults {
        UserDefaults(suiteName: identifier) ?? .standard
    }
}
