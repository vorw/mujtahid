import CoreLocation
import Foundation

public enum HadithCollection: String, Codable, CaseIterable, Identifiable, Hashable {
    case bukhari
    case muslim

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .bukhari:
            return "Sahih al-Bukhari"
        case .muslim:
            return "Sahih Muslim"
        }
    }

    public var shortLabel: String {
        switch self {
        case .bukhari:
            return "Bukhari"
        case .muslim:
            return "Muslim"
        }
    }
}

public enum HadithGrade: String, Codable, CaseIterable, Hashable {
    case sahih
    case hasan
    case daif

    public var label: String {
        rawValue.capitalized
    }
}

public enum ScholarReferenceType: String, Codable, CaseIterable, Hashable {
    case binBaz
    case dorar
    case editorial

    public var displayName: String {
        switch self {
        case .binBaz:
            return "BinBaz"
        case .dorar:
            return "Dorar"
        case .editorial:
            return "Editorial"
        }
    }
}

public enum ReviewState: String, Codable, CaseIterable, Hashable {
    case editoriallyReviewed
    case pendingReview

    public var label: String {
        switch self {
        case .editoriallyReviewed:
            return "Editorially reviewed"
        case .pendingReview:
            return "Pending review"
        }
    }
}

public struct ScholarReference: Identifiable, Codable, Hashable {
    public let id: String
    public let title: String
    public let urlString: String
    public let referenceType: ScholarReferenceType
    public let reviewState: ReviewState
    public let summary: String

    public var url: URL? {
        URL(string: urlString)
    }

    public init(
        id: String,
        title: String,
        urlString: String,
        referenceType: ScholarReferenceType,
        reviewState: ReviewState,
        summary: String
    ) {
        self.id = id
        self.title = title
        self.urlString = urlString
        self.referenceType = referenceType
        self.reviewState = reviewState
        self.summary = summary
    }
}

public struct HadithRecord: Identifiable, Codable, Hashable {
    public let id: String
    public let collection: HadithCollection
    public let bookNumber: Int
    public let bookTitle: String
    public let chapterTitle: String
    public let hadithNumber: Int
    public let globalNumber: Int?
    public let arabicText: String
    public let englishText: String
    public let narrator: String
    public let grade: HadithGrade
    public let sourceEdition: String
    public let translationSource: String
    public let verifiedAt: Date
    public let checksum: String
    public let scholarReferences: [ScholarReference]

    public var displayTitle: String {
        "\(collection.shortLabel) \(hadithNumber)"
    }
}

public struct HadithContentManifest: Codable, Hashable {
    public let version: String
    public let updatedAt: Date
    public let canonicalCollections: [String]
    public let verificationSources: [String]
    public let notes: [String]
}

public enum LocationTrustState: String, Codable, CaseIterable, Hashable {
    case precise
    case reduced
    case stale
    case unavailable

    public var label: String {
        switch self {
        case .precise:
            return "Precise"
        case .reduced:
            return "Reduced accuracy"
        case .stale:
            return "Stale location"
        case .unavailable:
            return "Unavailable"
        }
    }
}

public enum QiblaConfidenceState: String, Codable, CaseIterable, Hashable {
    case high
    case limited
    case needsCalibration

    public var label: String {
        switch self {
        case .high:
            return "High"
        case .limited:
            return "Limited"
        case .needsCalibration:
            return "Needs calibration"
        }
    }
}

public struct CoordinatePayload: Codable, Hashable {
    public let latitude: Double
    public let longitude: Double

    public init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }

    public init(_ coordinate: CLLocationCoordinate2D) {
        self.latitude = coordinate.latitude
        self.longitude = coordinate.longitude
    }

    public var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

public struct QiblaState: Codable, Hashable {
    public let userCoordinate: CoordinatePayload?
    public let kaabaCoordinate: CoordinatePayload
    public let targetBearing: Double?
    public let currentHeading: Double?
    public let headingAccuracy: Double?
    public let confidenceState: QiblaConfidenceState
    public let timestamp: Date
    public let locationName: String
    public let locationTrustState: LocationTrustState

    public var compassOffset: Double? {
        guard let targetBearing, let currentHeading else { return nil }
        let delta = targetBearing - currentHeading
        return ((delta + 540).truncatingRemainder(dividingBy: 360)) - 180
    }
}

public enum PrayerEvent: String, Codable, CaseIterable, Identifiable, Hashable {
    case fajr
    case sunrise
    case dhuhr
    case asr
    case maghrib
    case isha

    public var id: String { rawValue }

    public var displayName: String {
        rawValue.capitalized
    }
}

public enum JuristicMethod: String, Codable, CaseIterable, Identifiable, Hashable {
    case standard
    case hanafi

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .standard:
            return "Standard (Shafi, Maliki, Hanbali)"
        case .hanafi:
            return "Hanafi"
        }
    }

    public var factor: Double {
        switch self {
        case .standard:
            return 1
        case .hanafi:
            return 2
        }
    }
}

public enum HighLatitudeRule: String, Codable, CaseIterable, Hashable {
    case middleOfTheNight
}

public enum PrayerMethod: String, Codable, CaseIterable, Identifiable, Hashable {
    case ummAlQura
    case muslimWorldLeague
    case egyptian
    case karachi
    case northAmerica
    case gulfRegion
    case singapore
    case turkey
    case morocco

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .ummAlQura:
            return "Umm al-Qura"
        case .muslimWorldLeague:
            return "Muslim World League"
        case .egyptian:
            return "Egyptian General Authority"
        case .karachi:
            return "Karachi"
        case .northAmerica:
            return "North America"
        case .gulfRegion:
            return "Gulf Region"
        case .singapore:
            return "Singapore"
        case .turkey:
            return "Turkey"
        case .morocco:
            return "Morocco"
        }
    }

    public var shortLabel: String {
        switch self {
        case .ummAlQura:
            return "Umm al-Qura"
        case .muslimWorldLeague:
            return "MWL"
        case .egyptian:
            return "Egypt"
        case .karachi:
            return "Karachi"
        case .northAmerica:
            return "NA"
        case .gulfRegion:
            return "Gulf"
        case .singapore:
            return "Singapore"
        case .turkey:
            return "Turkey"
        case .morocco:
            return "Morocco"
        }
    }
}

public struct PrayerTimeEntry: Identifiable, Codable, Hashable {
    public let event: PrayerEvent
    public let time: Date

    public var id: PrayerEvent { event }
}

public struct PrayerDay: Codable, Hashable {
    public let date: Date
    public let locationName: String
    public let locationCoordinate: CoordinatePayload
    public let method: PrayerMethod
    public let juristicMethod: JuristicMethod
    public let calculationVersion: String
    public let locationTrustState: LocationTrustState
    public let fajr: Date
    public let sunrise: Date
    public let dhuhr: Date
    public let asr: Date
    public let maghrib: Date
    public let isha: Date
    public let notes: [String]

    public var entries: [PrayerTimeEntry] {
        [
            PrayerTimeEntry(event: .fajr, time: fajr),
            PrayerTimeEntry(event: .sunrise, time: sunrise),
            PrayerTimeEntry(event: .dhuhr, time: dhuhr),
            PrayerTimeEntry(event: .asr, time: asr),
            PrayerTimeEntry(event: .maghrib, time: maghrib),
            PrayerTimeEntry(event: .isha, time: isha)
        ]
    }

    public func nextPrayer(after date: Date) -> PrayerTimeEntry? {
        entries.first(where: { $0.time > date })
    }
}

public struct DailyHadithSnapshot: Codable, Hashable {
    public let hadithID: String
    public let collectionLabel: String
    public let arabicText: String
    public let englishText: String
    public let sourceLabel: String
}

public struct PrayerWidgetSnapshot: Codable, Hashable {
    public let city: String
    public let methodLabel: String
    public let locationLabel: String
    public let trustLabel: String
    public let nextPrayerName: String
    public let nextPrayerTime: Date
    public let allPrayerTimes: [PrayerTimeEntry]
}

public struct WidgetContentSnapshot: Codable, Hashable {
    public let generatedAt: Date
    public let dailyHadith: DailyHadithSnapshot
    public let prayerSummary: PrayerWidgetSnapshot?
}
