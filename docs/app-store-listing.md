# App Store listing copy

Paste into App Store Connect → App Information and → the version's Prepare for Submission.

Two rules govern everything below, and both have rejected apps in this category:

- **No acceptance guarantee.** Never "100% accepted", "guaranteed to pass" or
  "approved by". What the product actually promises is free reprocessing when an
  agency rejects a photo, and that is what the copy says.
- **No government affiliation, expressed or implied** (Guideline 5.2). No seals,
  no flags used as endorsement, no agency names in the keywords, no phrasing that
  suggests an official channel.

Counts are deliberately absent. The app reads its coverage from
`GET /api/v1/config` at runtime; a number typed here would be a second source of
truth that goes stale silently.

---

## App Information

- **Name:** VisaPics
- **Subtitle** (30 characters): `Passport photos that pass`
- **Category:** Utilities · secondary Travel
- **Age rating:** answer fresh; with no user-generated content sharing it lands at 4+
- **Support URL:** https://visapics.org/help
- **Marketing URL:** https://visapics.org
- **Privacy Policy URL:** https://visapics.org/privacy

## Keywords (100 characters, comma separated, no spaces)

```
passport photo,visa photo,id photo,biometric,document photo,photo booth,print,head size,compliance
```

No agency names. No competitor names.

## Promotional text (170 characters)

```
Line up your photo with live coaching, see the measurements before you pay, and get the digital file plus a print sheet. Rejected? We reprocess it free.
```

## Description

```
VisaPics turns a photo of your face into a document photo that meets the rules — measured, not guessed.

LIVE COACHING
The camera checks centring, head size, lighting and background while you line up, and the shutter stays locked until all four pass. No more finding out at the counter.

MEASURED AGAINST THE DOCUMENT
Every country and document type carries its own rules: photo size, head height, eye line, background colour, resolution. VisaPics measures your photo against the specification for the document you picked, and shows you each measurement beside the tolerance it has to meet.

SEE IT BEFORE YOU PAY
The watermarked preview and the full compliance report are free. You pay only when you are happy with the result — and only for a photo that passes.

WHAT YOU GET
· The digital file at the exact size and resolution the document requires
· A print sheet of four photos with cut lines, for any photo lab
· Free reprocessing if an agency rejects the photo

PRIVACY
Photos are measured, never recognised: no face identification, no matching, no profiling. Nothing is sold or shared, there are no advertising SDKs and no third-party analytics. Photos are deleted from the server automatically, and you can erase everything on your device at any time — with or without an account.

No account is needed to make a photo.

VisaPics is an independent service. It is not affiliated with, endorsed by, or acting on behalf of any government agency.
```

## What's New (first release)

```
First release.

· Live coaching that locks the shutter until centring, head size, lighting and background all pass
· A free watermarked preview with the full compliance report before you pay
· The digital file plus a print sheet with cut lines
· Works without an account
```

## Screenshots — 6.7-inch, five of them

Taken from the running app on a device, never from the design mock: a reviewer
comparing a mock against the build is a rejection.

1. Home, with a document chosen
2. Live capture with the coaching overlay at 4/4
3. The result screen with the compliance report
4. The paywall, showing the store's own prices
5. The requirements screen for a document

Captions may not carry any claim the app does not make, and no statistic that
`GET /api/v1/config` does not serve.

## App Privacy questionnaire

Must match what the app's own privacy screen and consent sheet say — a reviewer
can read both. These answers also match `ios.privacyManifests` in `app.json`.

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Photos | Yes | No | No | App functionality |
| Email address | Yes | Yes | No | App functionality |
| User ID | Yes | Yes | No | App functionality |
| Purchase history | Yes | Yes | No | App functionality |
| Identifiers for advertising | No | — | — | — |
| Usage data | No | — | — | — |
| Diagnostics | No | — | — | — |

Tracking: **No**. That keeps App Tracking Transparency out of the app entirely —
no prompt, no permission to refuse, one less thing to get wrong. It stays true
only while there is no analytics, attribution or crash SDK in the binary.

## EU Digital Services Act

Trader status and details are mandatory for distribution in the EU. Missing ones
block the release rather than the review, which is a surprise if it is found at
the end.
