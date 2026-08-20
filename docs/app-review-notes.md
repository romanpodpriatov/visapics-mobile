# App Review notes

Paste into App Store Connect → the version → App Review Information → Notes.

**No credentials in this file.** The repository is public. The demo account's
password lives in the backend's `.env` on the server as `APP_REVIEW_PASSWORD`;
copy it straight from there into the Sign-In Information fields, never into a
file that is committed.

---

## Notes to paste

```
No account is required. The app works fully as a guest — open it, choose a document, and use "Try it with a sample photo" on the home screen to run a real photo through the whole pipeline without photographing yourself. That path uses the same processing as the camera, not a demo mode.

To see the camera coaching, choose a document and tap "Take photo with coaching". The app explains what the camera reads before iOS asks for permission. Declining the camera is not a dead end: the same screen offers the photo library, which produces the same result.

Purchases are consumable photo credits. One credit unlocks one photo — the digital file and the printable sheet. The paywall opens only after a photo has been made and only when the balance is empty; prices come from StoreKit in the reviewer's own storefront. Restore Purchases is on the paywall, on the Account tab and on the Credits screen.

Account deletion is in the app: Account → Privacy and your data → Delete my account, with a typed confirmation. Guests, who have no account, get "Erase everything on this device" in the same place.

Photos are measured against the published specification for the chosen document. The app performs no face recognition, identification or matching, and contains no advertising, attribution or analytics SDKs.

A demo account is provided in the Sign-In Information fields, but it is not needed for anything above.
```

## Sign-In Information

- Sign-in required: **No**
- Demo account (optional, provided anyway): `appreview@visapics.org`
- Password: from `APP_REVIEW_PASSWORD` in the server's `.env` — do not commit it

## Contact

- Support email: support@visapics.org
- Support URL: https://visapics.org/help
