import HadithCore
import MapKit
import SwiftUI

private enum QiblaMode: String, CaseIterable, Identifiable {
    case compass
    case map

    var id: String { rawValue }

    var title: String {
        rawValue.capitalized
    }
}

struct QiblaView: View {
    @EnvironmentObject private var model: AppModel
    @State private var mode: QiblaMode = .compass

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Picker("Mode", selection: $mode) {
                    ForEach(QiblaMode.allCases) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.segmented)

                summaryCard

                switch mode {
                case .compass:
                    compassCard
                case .map:
                    mapCard
                }
            }
            .padding()
        }
        .navigationTitle("Qibla")
        .task {
            model.requestLocationAccess()
        }
    }

    private var summaryCard: some View {
        FeatureCard(
            title: "Qibla status",
            subtitle: model.currentQiblaState?.locationName ?? "Location required"
        ) {
            if let state = model.currentQiblaState {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        StatusBadge(text: state.confidenceState.label, tint: badgeTint(for: state.confidenceState))
                        StatusBadge(text: state.locationTrustState.label, tint: .indigo)
                    }

                    if let targetBearing = state.targetBearing {
                        LabeledContent("Qibla bearing", value: "\(Int(targetBearing.rounded()))°")
                    }
                    if let headingAccuracy = state.headingAccuracy, headingAccuracy >= 0 {
                        LabeledContent("Heading accuracy", value: "±\(Int(headingAccuracy.rounded()))°")
                    }

                    Text(explanation(for: state))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            } else {
                Text("Enable location and motion sensors to compute the qibla bearing and confidence level.")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var compassCard: some View {
        FeatureCard(title: "Compass mode", subtitle: "Fast daily alignment with visible calibration state") {
            if let state = model.currentQiblaState {
                QiblaDialView(state: state)
                    .frame(height: 280)
            } else {
                Text("Compass data will appear after permissions are granted.")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var mapCard: some View {
        FeatureCard(title: "Map mode", subtitle: "Use this when sensor confidence is limited") {
            if let state = model.currentQiblaState {
                QiblaMapView(state: state)
                    .frame(height: 320)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            } else {
                Text("Map verification requires a confirmed device location.")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func explanation(for state: QiblaState) -> String {
        switch state.confidenceState {
        case .high:
            return "Compass and location quality are strong enough for direct use."
        case .limited:
            return "Use the bearing with care and compare against the map view if the device was recently moved or accuracy is reduced."
        case .needsCalibration:
            return "The app does not have reliable sensor input yet. Move the device in a figure-eight motion or switch to map mode."
        }
    }

    private func badgeTint(for confidence: QiblaConfidenceState) -> Color {
        switch confidence {
        case .high:
            return .green
        case .limited:
            return .orange
        case .needsCalibration:
            return .red
        }
    }
}

private struct QiblaDialView: View {
    let state: QiblaState

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color.teal.opacity(0.15), Color(.secondarySystemBackground)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            Circle()
                .strokeBorder(Color.teal.opacity(0.3), lineWidth: 1)

            ForEach(0..<12, id: \.self) { index in
                Capsule()
                    .fill(index % 3 == 0 ? Color.teal : Color.secondary.opacity(0.4))
                    .frame(width: 4, height: index % 3 == 0 ? 24 : 12)
                    .offset(y: -110)
                    .rotationEffect(.degrees(Double(index) * 30))
            }

            VStack(spacing: 10) {
                Text("North")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .offset(y: -96)

                ArrowShape()
                    .fill(Color.teal.gradient)
                    .frame(width: 26, height: 120)
                    .rotationEffect(.degrees(state.compassOffset ?? 0))

                Text(state.targetBearing.map { "Target \(Int($0.rounded()))°" } ?? "Awaiting bearing")
                    .font(.headline)
                Text(state.currentHeading.map { "Heading \(Int($0.rounded()))°" } ?? "Heading unavailable")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct ArrowShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let midX = rect.midX
        path.move(to: CGPoint(x: midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        path.addLine(to: CGPoint(x: midX + rect.width * 0.18, y: rect.midY))
        path.addLine(to: CGPoint(x: midX + rect.width * 0.18, y: rect.maxY))
        path.addLine(to: CGPoint(x: midX - rect.width * 0.18, y: rect.maxY))
        path.addLine(to: CGPoint(x: midX - rect.width * 0.18, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
        path.closeSubpath()
        return path
    }
}

private struct QiblaMapView: View {
    let state: QiblaState
    @State private var position: MapCameraPosition = .automatic

    var body: some View {
        Map(position: $position) {
            if let user = state.userCoordinate?.coordinate {
                Marker("You", coordinate: user)
            }
            Marker("Kaaba", coordinate: state.kaabaCoordinate.coordinate)
        }
        .onAppear(perform: updatePosition)
    }

    private func updatePosition() {
        guard let user = state.userCoordinate?.coordinate else { return }
        let center = CLLocationCoordinate2D(
            latitude: (user.latitude + state.kaabaCoordinate.latitude) / 2,
            longitude: (user.longitude + state.kaabaCoordinate.longitude) / 2
        )
        let span = MKCoordinateSpan(latitudeDelta: max(4, abs(user.latitude - state.kaabaCoordinate.latitude) * 1.3), longitudeDelta: max(4, abs(user.longitude - state.kaabaCoordinate.longitude) * 1.3))
        position = .region(MKCoordinateRegion(center: center, span: span))
    }
}
