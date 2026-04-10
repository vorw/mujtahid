# HadithApp Web Prototype

This is a browser prototype of the planned native iOS app. It is meant for testing product flow, layout, trust presentation, and core prayer/qibla logic before moving back to native Apple tooling.

## Run on Windows

From the repo root:

```powershell
.\serve-web-prototype.ps1
```

Then open:

```text
http://127.0.0.1:4173/web-prototype/
```

If your phone is on the same Wi-Fi, the PowerShell script also prints local network URLs like:

```text
http://192.168.x.x:4173/web-prototype/
```

Open that URL in Safari on iPhone, then use `Share > Add to Home Screen`.

## What it includes

- Home, Search, Verify, and Library tabs
- Daily hadith card using the shared seed JSON
- Trust center with BinBaz and Dorar positioning
- Prayer times with region-aware defaults and manual offsets
- Qibla compass with sensor or slider fallback
- Qibla map-style verification view
- Widget previews for daily hadith and prayer times

## Prototype limits

- This is not a replacement for the native iOS app
- Browser location may not know the country, so method defaults can fall back to MWL
- Browser compass support depends on device, browser, and permission state
- The world-map qibla view is a lightweight prototype visualization, not a full MapKit replacement
- Home-screen install works best over HTTPS or on localhost. On a plain LAN HTTP URL, some browser APIs can be more limited.
