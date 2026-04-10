import CoreLocation
import Foundation

public struct PrayerMethodParameters: Hashable {
    public let fajrAngle: Double
    public let ishaAngle: Double?
    public let ishaIntervalMinutes: Int?
    public let highLatitudeRule: HighLatitudeRule

    public init(
        fajrAngle: Double,
        ishaAngle: Double? = nil,
        ishaIntervalMinutes: Int? = nil,
        highLatitudeRule: HighLatitudeRule = .middleOfTheNight
    ) {
        self.fajrAngle = fajrAngle
        self.ishaAngle = ishaAngle
        self.ishaIntervalMinutes = ishaIntervalMinutes
        self.highLatitudeRule = highLatitudeRule
    }
}

public enum PrayerMethodPolicy {
    public static func defaultMethod(for countryCode: String?) -> PrayerMethod {
        switch countryCode?.uppercased() {
        case "SA":
            return .ummAlQura
        case "AE", "BH", "KW", "OM", "QA":
            return .gulfRegion
        case "EG":
            return .egyptian
        case "PK", "IN", "BD", "AF":
            return .karachi
        case "US", "CA":
            return .northAmerica
        case "TR":
            return .turkey
        case "MA":
            return .morocco
        case "SG", "BN":
            return .singapore
        default:
            return .muslimWorldLeague
        }
    }
}

public extension PrayerMethod {
    func parameters(on date: Date, timeZone: TimeZone) -> PrayerMethodParameters {
        switch self {
        case .ummAlQura:
            let hijriCalendar = Calendar(identifier: .islamicUmmAlQura)
            let month = hijriCalendar.component(.month, from: date)
            let isRamadan = month == 9
            return PrayerMethodParameters(
                fajrAngle: 18.5,
                ishaIntervalMinutes: isRamadan ? 120 : 90
            )
        case .muslimWorldLeague:
            return PrayerMethodParameters(fajrAngle: 18, ishaAngle: 17)
        case .egyptian:
            return PrayerMethodParameters(fajrAngle: 19.5, ishaAngle: 17.5)
        case .karachi:
            return PrayerMethodParameters(fajrAngle: 18, ishaAngle: 18)
        case .northAmerica:
            return PrayerMethodParameters(fajrAngle: 15, ishaAngle: 15)
        case .gulfRegion:
            return PrayerMethodParameters(fajrAngle: 19.5, ishaIntervalMinutes: 90)
        case .singapore:
            return PrayerMethodParameters(fajrAngle: 20, ishaAngle: 18)
        case .turkey:
            return PrayerMethodParameters(fajrAngle: 18, ishaAngle: 17)
        case .morocco:
            return PrayerMethodParameters(fajrAngle: 18, ishaAngle: 17)
        }
    }
}

public struct PrayerCalculationContext: Hashable {
    public let date: Date
    public let coordinate: CLLocationCoordinate2D
    public let timeZone: TimeZone
    public let locationName: String
    public let method: PrayerMethod
    public let juristicMethod: JuristicMethod
    public let locationTrustState: LocationTrustState
    public let offsets: [PrayerEvent: Int]

    public init(
        date: Date,
        coordinate: CLLocationCoordinate2D,
        timeZone: TimeZone,
        locationName: String,
        method: PrayerMethod,
        juristicMethod: JuristicMethod,
        locationTrustState: LocationTrustState,
        offsets: [PrayerEvent: Int]
    ) {
        self.date = date
        self.coordinate = coordinate
        self.timeZone = timeZone
        self.locationName = locationName
        self.method = method
        self.juristicMethod = juristicMethod
        self.locationTrustState = locationTrustState
        self.offsets = offsets
    }
}

public struct PrayerCalculator {
    public static let calculationVersion = "astronomical-v1"

    public init() {}

    public func calculateDay(using context: PrayerCalculationContext) -> PrayerDay? {
        let parameters = context.method.parameters(on: context.date, timeZone: context.timeZone)
        let latitude = context.coordinate.latitude
        let longitude = context.coordinate.longitude
        let timeZoneHours = Double(context.timeZone.secondsFromGMT(for: context.date)) / 3600
        let julianDate = julianDay(for: context.date)

        let solar = sunPosition(julianDate)
        let noonMinutes = 720 - 4 * longitude - solar.equationOfTime + timeZoneHours * 60

        guard let sunriseMinutes = solarTimeMinutes(
            solarDepressionAngle: 0.833,
            latitude: latitude,
            declination: solar.declination,
            baseMinutes: noonMinutes,
            direction: .beforeNoon
        ), let sunsetMinutes = solarTimeMinutes(
            solarDepressionAngle: 0.833,
            latitude: latitude,
            declination: solar.declination,
            baseMinutes: noonMinutes,
            direction: .afterNoon
        ) else {
            return nil
        }

        let nightLength = (sunriseMinutes + 1440) - sunsetMinutes

        let fajrMinutes = solarTimeMinutes(
            solarDepressionAngle: parameters.fajrAngle,
            latitude: latitude,
            declination: solar.declination,
            baseMinutes: noonMinutes,
            direction: .beforeNoon
        ) ?? (sunriseMinutes - nightLength / 2)

        let asrAltitude = asrAltitude(latitude: latitude, declination: solar.declination, factor: context.juristicMethod.factor)
        let asrMinutes = solarAltitudeTimeMinutes(
            altitude: asrAltitude,
            latitude: latitude,
            declination: solar.declination,
            baseMinutes: noonMinutes,
            direction: .afterNoon
        ) ?? (noonMinutes + 180)

        let ishaMinutes: Double
        if let interval = parameters.ishaIntervalMinutes {
            ishaMinutes = sunsetMinutes + Double(interval)
        } else if let angle = parameters.ishaAngle {
            ishaMinutes = solarTimeMinutes(
                solarDepressionAngle: angle,
                latitude: latitude,
                declination: solar.declination,
                baseMinutes: noonMinutes,
                direction: .afterNoon
            ) ?? (sunsetMinutes + nightLength / 2)
        } else {
            ishaMinutes = sunsetMinutes + 90
        }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = context.timeZone
        let base = calendar.startOfDay(for: context.date)
        let notes = buildNotes(for: context)

        return PrayerDay(
            date: base,
            locationName: context.locationName,
            locationCoordinate: CoordinatePayload(context.coordinate),
            method: context.method,
            juristicMethod: context.juristicMethod,
            calculationVersion: Self.calculationVersion,
            locationTrustState: context.locationTrustState,
            fajr: adjustedDate(from: base, minutes: fajrMinutes, offset: context.offsets[.fajr] ?? 0),
            sunrise: adjustedDate(from: base, minutes: sunriseMinutes, offset: context.offsets[.sunrise] ?? 0),
            dhuhr: adjustedDate(from: base, minutes: noonMinutes, offset: context.offsets[.dhuhr] ?? 0),
            asr: adjustedDate(from: base, minutes: asrMinutes, offset: context.offsets[.asr] ?? 0),
            maghrib: adjustedDate(from: base, minutes: sunsetMinutes, offset: context.offsets[.maghrib] ?? 0),
            isha: adjustedDate(from: base, minutes: ishaMinutes, offset: context.offsets[.isha] ?? 0),
            notes: notes
        )
    }

    public func compare(
        for date: Date,
        coordinate: CLLocationCoordinate2D,
        timeZone: TimeZone,
        locationName: String,
        juristicMethod: JuristicMethod
    ) -> [PrayerDay] {
        PrayerMethod.allCases.compactMap { method in
            calculateDay(
                using: PrayerCalculationContext(
                    date: date,
                    coordinate: coordinate,
                    timeZone: timeZone,
                    locationName: locationName,
                    method: method,
                    juristicMethod: juristicMethod,
                    locationTrustState: .precise,
                    offsets: [:]
                )
            )
        }
    }

    private func buildNotes(for context: PrayerCalculationContext) -> [String] {
        var notes = ["Method: \(context.method.displayName)"]
        switch context.locationTrustState {
        case .precise:
            break
        case .reduced:
            notes.append("Location accuracy is reduced. Check with your local masjid if timings differ.")
        case .stale:
            notes.append("Location is stale. Refresh the app before relying on these timings.")
        case .unavailable:
            notes.append("Location unavailable. Results may be based on the last confirmed city.")
        }

        if !context.offsets.isEmpty {
            notes.append("Manual offsets are applied to match local practice.")
        }

        return notes
    }

    private func adjustedDate(from base: Date, minutes: Double, offset: Int) -> Date {
        base.addingTimeInterval((minutes + Double(offset)) * 60)
    }

    private func julianDay(for date: Date) -> Double {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .gmt
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        let year = components.year ?? 2000
        let month = components.month ?? 1
        let day = components.day ?? 1

        let a = (14 - month) / 12
        let y = year + 4800 - a
        let m = month + 12 * a - 3

        return Double(day + ((153 * m + 2) / 5) + 365 * y + y / 4 - y / 100 + y / 400 - 32045) - 0.5
    }

    private func sunPosition(_ julianDay: Double) -> (declination: Double, equationOfTime: Double) {
        let d = julianDay - 2451545.0
        let g = fixAngle(357.529 + 0.98560028 * d)
        let q = fixAngle(280.459 + 0.98564736 * d)
        let l = fixAngle(q + 1.915 * sinDegrees(g) + 0.020 * sinDegrees(2 * g))
        let e = 23.439 - 0.00000036 * d

        let rightAscension = fixHour(atan2Degrees(cosDegrees(e) * sinDegrees(l), cosDegrees(l)) / 15)
        let declination = asinDegrees(sinDegrees(e) * sinDegrees(l))
        let equationOfTime = q / 15 - rightAscension

        return (declination, equationOfTime * 60)
    }

    private func solarTimeMinutes(
        solarDepressionAngle: Double,
        latitude: Double,
        declination: Double,
        baseMinutes: Double,
        direction: SolarDirection
    ) -> Double? {
        let altitude = -solarDepressionAngle
        return solarAltitudeTimeMinutes(
            altitude: altitude,
            latitude: latitude,
            declination: declination,
            baseMinutes: baseMinutes,
            direction: direction
        )
    }

    private func solarAltitudeTimeMinutes(
        altitude: Double,
        latitude: Double,
        declination: Double,
        baseMinutes: Double,
        direction: SolarDirection
    ) -> Double? {
        let numerator = sinDegrees(altitude) - sinDegrees(latitude) * sinDegrees(declination)
        let denominator = cosDegrees(latitude) * cosDegrees(declination)
        let ratio = numerator / denominator
        guard ratio >= -1, ratio <= 1 else { return nil }

        let hourAngle = acosDegrees(ratio)
        let delta = hourAngle * 4
        return direction == .beforeNoon ? baseMinutes - delta : baseMinutes + delta
    }

    private func asrAltitude(latitude: Double, declination: Double, factor: Double) -> Double {
        let angle = -atanDegrees(1 / (factor + tanDegrees(abs(latitude - declination))))
        return angle
    }

    private func fixAngle(_ value: Double) -> Double {
        let fixed = value.truncatingRemainder(dividingBy: 360)
        return fixed < 0 ? fixed + 360 : fixed
    }

    private func fixHour(_ value: Double) -> Double {
        let fixed = value.truncatingRemainder(dividingBy: 24)
        return fixed < 0 ? fixed + 24 : fixed
    }

    private func sinDegrees(_ value: Double) -> Double { sin(value * .pi / 180) }
    private func cosDegrees(_ value: Double) -> Double { cos(value * .pi / 180) }
    private func tanDegrees(_ value: Double) -> Double { tan(value * .pi / 180) }
    private func asinDegrees(_ value: Double) -> Double { asin(value) * 180 / .pi }
    private func acosDegrees(_ value: Double) -> Double { acos(value) * 180 / .pi }
    private func atanDegrees(_ value: Double) -> Double { atan(value) * 180 / .pi }
    private func atan2Degrees(_ y: Double, _ x: Double) -> Double { atan2(y, x) * 180 / .pi }
}

private enum SolarDirection {
    case beforeNoon
    case afterNoon
}
