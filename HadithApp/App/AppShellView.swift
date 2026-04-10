import SwiftUI
import HadithCore

struct AppShellView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        NavigationStack(path: $model.path) {
            TabView(selection: $model.selectedTab) {
                HomeView()
                    .tabItem {
                        Label("Home", systemImage: "house.fill")
                    }
                    .tag(AppTab.home)

                SearchView()
                    .tabItem {
                        Label("Search", systemImage: "magnifyingglass")
                    }
                    .tag(AppTab.search)

                VerifyView()
                    .tabItem {
                        Label("Verify", systemImage: "checkmark.seal.fill")
                    }
                    .tag(AppTab.verify)

                LibraryView()
                    .tabItem {
                        Label("Library", systemImage: "books.vertical.fill")
                    }
                    .tag(AppTab.library)
            }
            .navigationDestination(for: AppRoute.self) { route in
                switch route {
                case .hadith(let id):
                    HadithDetailView(hadithID: id)
                case .prayer:
                    PrayerTimesView()
                case .qibla:
                    QiblaView()
                case .trust:
                    HowWeVerifyView()
                case .compareMethods:
                    PrayerMethodComparisonView()
                }
            }
        }
        .task {
            model.consumePendingRouteIfNeeded()
        }
    }
}
