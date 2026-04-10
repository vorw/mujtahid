import SwiftUI
import WidgetKit

@main
struct HadithWidgetsBundle: WidgetBundle {
    var body: some Widget {
        DailyHadithWidget()
        PrayerTimesWidget()
    }
}
