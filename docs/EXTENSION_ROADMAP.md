# Hoard Browser Extension Roadmap

## Product Purpose

Save and organize web content locally, even while offline, with optional sync to
Hoard Desktop.

## Phase 1: Reliable Release Candidate

Status: completed

- Centralize popup, context menu, keyboard shortcut, and selection bubble saves
  through the background service worker.
- Persist offline captures in IndexedDB with `clientId`, vault, folder, and tag
  metadata.
- Retry individual captures without marking failed neighbors as synced.
- Record processed `clientId` values in SQLite to make desktop sync idempotent.
- Store code snippets received from the browser extension.
- Use `chrome.alarms` instead of service-worker timers.
- Reject browser-originated local API mutations unless they come from an
  installed browser extension.
- Generate Chrome Web Store icon sizes and a Chrome-only ZIP package.

## Phase 2: Store-Ready Release

Status: implementation completed; store submission pending

- Add automated browser-extension integration tests for online, offline, retry,
  and reconnect flows.
- Add request body limits and a local pairing token between Hoard Desktop and
  the browser extension.
- Add a first-run onboarding screen explaining offline mode, desktop sync, and
  permissions.
- Add `_locales/en` and `_locales/es` strings for manifest and UI copy.
- Prepare Chrome Web Store screenshots and the 440x280 promotional image.
- Publish the privacy policy and complete Chrome Web Store privacy disclosures.
- Keep a separate Firefox package as an optional follow-up. Chrome is the
  release target.

## Phase 3: Professional Workflow

Status: implemented

- Add a sync health view with retry state and actionable errors.
- Edit titles, folders, and tags from the side panel.
- Add duplicate handling preferences: skip, save copy, or merge metadata.
- Add import preview, selection, cancellation, and summary for bulk galleries.
- Add domain templates and automatic filing rules.

## Phase 4: Differentiation

- Add readable article capture.
- Add screenshot capture for selected regions.
- Evaluate Native Messaging as the long-term desktop transport.
