import Foundation

public enum AppDeepLink {
    public static func qibla() -> URL {
        URL(string: "hadithapp://qibla")!
    }

    public static func prayerTimes() -> URL {
        URL(string: "hadithapp://prayer")!
    }

    public static func trust() -> URL {
        URL(string: "hadithapp://trust")!
    }

    public static func hadith(id: String) -> URL {
        URL(string: "hadithapp://hadith/\(id)")!
    }
}
