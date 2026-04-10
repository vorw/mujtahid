# HadithApp

HadithApp is a native SwiftUI iPhone app skeleton for trusted hadith study with two supporting utilities: prayer times and qibla.

## Included

- Hadith-first app shell: `Home`, `Search`, `Verify`, `Library`
- Seed hadith repository for `Sahih al-Bukhari` and `Sahih Muslim`
- Visible trust center for BinBaz + Dorar methodology
- Deterministic prayer calculation engine with region-aware defaults
- Qibla bearing calculation using Kaaba coordinates and device heading
- WidgetKit widgets for daily hadith and prayer times
- App Intents for opening daily hadith, qibla, and prayer times
- Unit tests for qibla bearing, prayer policy, and region defaults

## Important note

This workspace is running on Windows and cannot generate or build an Xcode project directly. The repo therefore uses `XcodeGen` through `project.yml` instead of checking in a generated `.xcodeproj`.

On a Mac:

1. Install Xcode.
2. Install XcodeGen.
3. Run `xcodegen generate`.
4. Open `HadithApp.xcodeproj`.
5. Update the bundle identifiers, app group identifier, and signing team.

## Required configuration before TestFlight

- Replace `group.com.example.hadithapp.shared` with your real App Group in:
  - `HadithCore/Support/AppGroupConfiguration.swift`
  - `HadithApp/Supporting/HadithApp.entitlements`
  - `HadithWidgets/Supporting/HadithWidgets.entitlements`
- Replace placeholder bundle identifiers in `project.yml`
- Replace seed content with a larger editorially reviewed import
- Add final App Store icon assets

## Trust and content status

The seed bundle demonstrates the architecture and UI. It is not a release-ready full corpus import. Production rollout still requires broader content ingestion, licensing review for final English translations, and editorial QA.
