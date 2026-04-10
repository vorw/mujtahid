import CoreLocation
import HadithCore
import XCTest

final class PrayerAndQiblaTests: XCTestCase {
    func testRiyadhQiblaBearingIsReasonable() {
        let calculator = QiblaCalculator()
        let bearing = calculator.bearing(from: CLLocationCoordinate2D(latitude: 24.7136, longitude: 46.6753))
        XCTAssertEqual(bearing, 243.72, accuracy: 1.5)
    }

    func testLondonQiblaBearingIsReasonable() {
        let calculator = QiblaCalculator()
        let bearing = calculator.bearing(from: CLLocationCoordinate2D(latitude: 51.5072, longitude: -0.1276))
        XCTAssertEqual(bearing, 118.99, accuracy: 1.5)
    }

    func testSaudiDefaultsToUmmAlQura() {
        XCTAssertEqual(PrayerMethodPolicy.defaultMethod(for: "SA"), .ummAlQura)
    }

    func testNorthAmericaDefaultsToNorthAmericaMethod() {
        XCTAssertEqual(PrayerMethodPolicy.defaultMethod(for: "US"), .northAmerica)
    }

    func testUmmAlQuraUsesRamadanIshaInterval() {
        let calculator = PrayerCalculator()
        let context = PrayerCalculationContext(
            date: Date(timeIntervalSince1970: 1772064000),
            coordinate: CLLocationCoordinate2D(latitude: 21.3891, longitude: 39.8579),
            timeZone: TimeZone(secondsFromGMT: 10800)!,
            locationName: "Makkah",
            method: .ummAlQura,
            juristicMethod: .standard,
            locationTrustState: .precise,
            offsets: [:]
        )

        let prayerDay = try XCTUnwrap(calculator.calculateDay(using: context))
        let intervalMinutes = Int(prayerDay.isha.timeIntervalSince(prayerDay.maghrib) / 60)
        XCTAssertTrue(abs(intervalMinutes - 120) <= 2)
    }

    func testPrayerDayMaintainsChronologicalOrder() {
        let calculator = PrayerCalculator()
        let context = PrayerCalculationContext(
            date: Date(timeIntervalSince1970: 1776124800),
            coordinate: CLLocationCoordinate2D(latitude: 24.7136, longitude: 46.6753),
            timeZone: TimeZone(secondsFromGMT: 10800)!,
            locationName: "Riyadh",
            method: .ummAlQura,
            juristicMethod: .standard,
            locationTrustState: .precise,
            offsets: [:]
        )

        let prayerDay = try XCTUnwrap(calculator.calculateDay(using: context))
        XCTAssertTrue(prayerDay.fajr < prayerDay.sunrise)
        XCTAssertTrue(prayerDay.sunrise < prayerDay.dhuhr)
        XCTAssertTrue(prayerDay.dhuhr < prayerDay.asr)
        XCTAssertTrue(prayerDay.asr < prayerDay.maghrib)
        XCTAssertTrue(prayerDay.maghrib < prayerDay.isha)
    }
}
