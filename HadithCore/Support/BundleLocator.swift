import Foundation

public final class BundleLocator {}

public extension Bundle {
    static var hadithCore: Bundle {
        Bundle(for: BundleLocator.self)
    }
}
