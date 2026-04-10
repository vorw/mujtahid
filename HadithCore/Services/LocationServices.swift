import Combine
import CoreLocation
import Foundation

public struct QiblaCalculator {
    public static let kaabaCoordinate = CLLocationCoordinate2D(latitude: 21.422487, longitude: 39.826206)

    public init() {}

    public func bearing(from source: CLLocationCoordinate2D, to target: CLLocationCoordinate2D = QiblaCalculator.kaabaCoordinate) -> Double {
        let sourceLatitude = source.latitude.radians
        let sourceLongitude = source.longitude.radians
        let targetLatitude = target.latitude.radians
        let targetLongitude = target.longitude.radians
        let deltaLongitude = targetLongitude - sourceLongitude

        let y = sin(deltaLongitude) * cos(targetLatitude)
        let x = cos(sourceLatitude) * sin(targetLatitude) - sin(sourceLatitude) * cos(targetLatitude) * cos(deltaLongitude)
        let bearing = atan2(y, x).degrees

        return fmod(bearing + 360, 360)
    }

    public func state(
        location: CLLocation?,
        heading: CLHeading?,
        locationName: String,
        trust: LocationTrustState,
        timestamp: Date = .now
    ) -> QiblaState {
        let coordinate = location?.coordinate
        let bearing = coordinate.map { bearing(from: $0) }
        let headingValue: Double? = {
            guard let heading else { return nil }
            if heading.trueHeading >= 0 {
                return heading.trueHeading
            }
            return heading.magneticHeading >= 0 ? heading.magneticHeading : nil
        }()

        let confidence: QiblaConfidenceState
        if trust == .precise, let accuracy = heading?.headingAccuracy, accuracy >= 0, accuracy <= 15 {
            confidence = .high
        } else if headingValue != nil, trust != .unavailable {
            confidence = .limited
        } else {
            confidence = .needsCalibration
        }

        return QiblaState(
            userCoordinate: coordinate.map(CoordinatePayload.init),
            kaabaCoordinate: CoordinatePayload(QiblaCalculator.kaabaCoordinate),
            targetBearing: bearing,
            currentHeading: headingValue,
            headingAccuracy: heading?.headingAccuracy,
            confidenceState: confidence,
            timestamp: timestamp,
            locationName: locationName,
            locationTrustState: trust
        )
    }
}

public final class LocationController: NSObject, ObservableObject {
    @Published public private(set) var location: CLLocation?
    @Published public private(set) var heading: CLHeading?
    @Published public private(set) var locationName: String = "Location unavailable"
    @Published public private(set) var countryCode: String?
    @Published public private(set) var trustState: LocationTrustState = .unavailable
    @Published public private(set) var authorizationStatus: CLAuthorizationStatus

    private let locationManager: CLLocationManager
    private let geocoder = CLGeocoder()

    public override init() {
        let manager = CLLocationManager()
        self.locationManager = manager
        self.authorizationStatus = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.headingFilter = 1
    }

    public func requestAccessIfNeeded() {
        switch authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            start()
        default:
            trustState = .unavailable
        }
    }

    public func start() {
        guard CLLocationManager.locationServicesEnabled() else {
            trustState = .unavailable
            return
        }
        locationManager.startUpdatingLocation()
        if CLLocationManager.headingAvailable() {
            locationManager.startUpdatingHeading()
        }
    }

    public func stop() {
        locationManager.stopUpdatingLocation()
        locationManager.stopUpdatingHeading()
    }

    private func refreshLocationName(for location: CLLocation) {
        geocoder.cancelGeocode()
        geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, _ in
            guard let self else { return }
            let placemark = placemarks?.first
            self.countryCode = placemark?.isoCountryCode
            let city = placemark?.locality ?? placemark?.subAdministrativeArea ?? placemark?.administrativeArea
            let country = placemark?.country
            self.locationName = [city, country].compactMap { $0 }.joined(separator: ", ").nonEmpty ?? "Current location"
        }
    }

    private func updateTrustState(with location: CLLocation?) {
        guard let location else {
            trustState = .unavailable
            return
        }

        let accuracyAuthorization = locationManager.accuracyAuthorization
        let age = abs(location.timestamp.timeIntervalSinceNow)

        if age > 900 {
            trustState = .stale
        } else if accuracyAuthorization == .reducedAccuracy || location.horizontalAccuracy > 1000 {
            trustState = .reduced
        } else {
            trustState = .precise
        }
    }
}

extension LocationController: CLLocationManagerDelegate {
    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            start()
        default:
            trustState = .unavailable
        }
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let newest = locations.last else { return }
        location = newest
        updateTrustState(with: newest)
        refreshLocationName(for: newest)
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        heading = newHeading
    }

    public func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool {
        true
    }
}

private extension Double {
    var radians: Double { self * .pi / 180 }
    var degrees: Double { self * 180 / .pi }
}

private extension String {
    var nonEmpty: String? {
        isEmpty ? nil : self
    }
}
