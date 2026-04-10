# Mujtahid Web Prototype

This is the current browser prototype for the hadith-only product direction. It focuses on an Arabic-first swipe feed, direct trusted-source opening, and reminder behavior for home-screen testing on iPhone.

## Run on Windows

From the repo root:

```powershell
.\serve-web-prototype.ps1
```

Then open:

```text
http://127.0.0.1:4173/web-prototype/
```

If your phone is on the same Wi-Fi, the script also prints a local network URL so you can open it in Safari and use `Share > Add to Home Screen`.

## What it includes

- Vertical hadith feed designed to feel closer to a native iPhone reading experience
- Arabic UI with bilingual hadith cards
- Direct external opening to trusted search/source pages on Dorar
- Live search backed by Dorar’s public hadith API response
- Home-screen install metadata and reminder preferences for prototype testing

## Prototype limits

- This is still a web prototype, not the final native iOS build
- Background reminder behavior in a web app is more limited than true native iOS local notifications
- The current local featured feed is intentionally small; broader live lookup is handled through Dorar search
