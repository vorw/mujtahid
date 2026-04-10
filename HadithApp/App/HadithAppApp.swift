import SwiftUI

@main
struct HadithAppApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            AppShellView()
                .environmentObject(model)
                .onOpenURL { url in
                    model.handleIncomingURL(url)
                }
        }
    }
}
