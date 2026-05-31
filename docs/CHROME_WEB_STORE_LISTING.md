# Save to Hoard - Chrome Web Store Listing

## Short Description

Save links, images, quotes, notes, and code snippets locally. Sync with Hoard
Desktop when it is available.

## Detailed Description

Save to Hoard is a local-first browser companion for Hoard Desktop. Capture web
content while browsing, organize it with vault, folder, and tag metadata, and
keep working when the desktop app is closed. Pending captures remain in the
browser and retry automatically when Hoard Desktop reconnects.

Key features:

- Save pages, links, images, quotes, notes, and code snippets.
- Keep captures in a local browser outbox while offline.
- Sync to Hoard Desktop through a paired local service on this computer.
- Search and review saved browser items from the side panel.
- Import browser bookmarks and page galleries when requested.
- Use English or Spanish UI copy based on browser locale.

## Permission Justifications

- `activeTab`: reads the current page title and URL after an explicit save
  action.
- `contextMenus`: adds right-click save actions for supported content.
- `storage` and `unlimitedStorage`: stores the offline outbox locally.
- `alarms`: retries pending local captures after reconnect.
- `omnibox`: searches locally saved items from the address bar.
- `scripting`: scans images only when the user starts a gallery import.
- `sidePanel`: displays the local saved-items browser panel.
- `host_permissions`: allows page capture and connection to the local Hoard
  Desktop service at `127.0.0.1`.

## Privacy Disclosure Answers

- Single purpose: save and organize explicitly selected web content locally,
  with optional sync to Hoard Desktop on the same computer.
- Personally identifiable information: not collected by the developer.
- Authentication information: a random local pairing token is stored locally
  and used only between the extension and Hoard Desktop.
- Website content: processed only when the user explicitly saves content or
  requests gallery import.
- Data sale: no.
- Data transfer to developer-operated servers: no.
- Data use for advertising, credit, or lending: no.

## Submission Assets

- `store-assets/screenshot-01-offline-1280x800.png`
- `store-assets/screenshot-02-library-1280x800.png`
- `store-assets/screenshot-03-local-sync-1280x800.png`
- `store-assets/promo-440x280.png`
- `dist/hoard-extension-chrome-v2.0.zip`

## Publication Checklist

- Host `docs/privacy-policy.html` at a public HTTPS URL.
- Replace `SUPPORT_EMAIL` and `PUBLIC_PROJECT_URL` in the privacy policy.
- Enter the hosted privacy-policy URL in the Chrome Web Store dashboard.
- Upload the Chrome ZIP and store assets.
- Complete the privacy disclosures using the answers above.
- Run a clean-profile install test before submitting for review.
