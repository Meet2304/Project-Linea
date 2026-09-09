# Mac failure regression coverage

Keep this checklist with the isolated Mac branch. Passing CI is necessary, but it
does not prove Spotify access works on a user's Mac.

| Reported failure | Automated check | Remaining acceptance check |
| --- | --- | --- |
| Finder cannot open unsigned app | Stable Mac release runs check-mac-distribution.mjs: deep strict signature validation, Gatekeeper assessment, stapled notarization | Download final DMG on a normal account and open it without removing quarantine |
| WhatsApp quarantine: operation not permitted / AppSandbox exec denied | Bridge tests inject EPERM and EACCES; packaged test checks executable permissions | Transfer the final DMG through WhatsApp, install the app, record quarantine attributes and verify ordinary launch |
| Helper emits ready but never responds | Native injected hang for snapshot and authorize; bridge startup/read/auth deadlines | Spotify running with consent not yet granted |
| Permission check hangs | Actual Apple Event receiver plus injected stalled send; main-loop callback regression | First consent, denial, later approval, player restart on affected macOS |
| Reconnecting forever with no cause in logs | Native stage diagnostics, watchdog exit 75, stderr forwarding, bridge exit and timeout logs; capped retry backoff and recovery | Capture LINEA_MEDIA_DEBUG=1 output if still failing |
| Missing bundled helper/script or wrong CPU | Native missing-media.js failure; bridge ENOENT; packaged files and arm64/x86_64 checks | Install on Intel and Apple Silicon |
| App works only in build directory | Launch copied packaged app from path containing spaces and non-ASCII characters | Install by dragging app from DMG to Applications |
| Mac beta tries to downgrade | Existing updatePolicy/updateFeed tests | Installed beta update check should retain newer beta when only older Mac stable exists |
| Metadata/lyrics remain stale after source failure | Existing playbackController and Electron failure-state tests | Close/reopen Spotify, sleep/resume, deny permission mid-use |

The current beta is an unsigned diagnostic artifact. The new distribution gate
intentionally rejects it; do not describe a successful CI launch as Gatekeeper or
notarization acceptance. Stable Windows publication remains separate.

Commands (from Linea):
- bun run test
- bun run typecheck
- node scripts/check-mac-permissions.mjs (Mac)
- node scripts/check-mac-app.mjs (Mac, after packaging)
- node scripts/check-mac-distribution.mjs /Applications/Linea.app (Mac, production gate)

No private logs, usernames, staging IDs, or sampled process reports are committed.
The fixtures reproduce the reported behavior without copying user data.
