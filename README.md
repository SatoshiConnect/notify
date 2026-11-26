# SatoshiCore Notify — self-hosted notification hub

Installable notification hub built alongside the NSAT Messenger service. Sign-in uses the existing chat account; bots send alerts into personal or group inboxes through the Notify API. This repository retains the Messenger modules used by the shared account and chat platform. It does not read NSAT Mainnet balances or send transactions.

## Implemented in the current prototype

- Google Sign-In verified server-side (Google ID tokens) or explicitly enabled **local-only** demo login; first-time members complete their profile and create a device-local wallet before entering chat
- JWT-authenticated realtime room text chat with Socket.IO
- Private 1:1 chats opened from user search, with server-checked membership and persistent conversation metadata
- Shared rooms, room participant list, and the last 100 messages per room persisted in a single-server local file
- Profile editing with cover photo, status message, optional birthday, website, city, work, education, relationship status, per-field visibility settings, and search by username prefix or exact Gmail without exposing email in search results
- First-login non-custodial wallet setup: the recovery key is encrypted on the user device with PBKDF2-SHA256 and AES-256-GCM; the server verifies a one-time Ed25519 signature proving control of the submitted wallet address and never receives the private key. The backup confirmation remains the user's declaration.
- Referral links and personal invite codes; both inviter and new member receive configurable in-app NSAT reward credits after the new member completes first-time profile and wallet setup. The ledger is idempotent and records reward history. Credits are planned at 1:1 with NSAT, but Mainnet redemption and transfers are not connected.
- Sent feedback, persisted read receipts, rate-limited realtime typing indicators, and a bounded per-tab text outbox with retry/idempotency protection when a connection drops
- Search recent message and poll text across accessible rooms and private chats
- Authenticated AI chat powered by Google Gemini; messages are sent only after the user confirms the sharing notice and are not persisted as messenger history
- In-chat image sharing, short recorded voice messages, small allow-listed document/audio/video attachments, lightweight polls, message reactions, text editing, and quoted replies
- 1:1 WebRTC signaling with incoming/outgoing call state, timeouts, bounded ICE restart attempts, selectable data-saver/balanced/clear profiles, in-call camera, microphone, and speaker selection, camera switching, draggable PiP and full-screen call overlays. Ultra saver is the default (90p/6 fps with a 65 kbps video cap and 12 kbps audio cap); Balanced and Clear automatically step down under sustained congestion and recover after stable network samples when the browser exposes usable connection stats. The local appearance filter renders only at the selected call frame rate to avoid unnecessary CPU work. The Calls view keeps the latest 40 call records on the current device for quick call-backs.
- Browser echo cancellation, automatic gain control, and noise suppression are requested for call audio. Outgoing video has lightweight whole-frame softening and Natural, Soft Glow, Warm, Cool, and Mono looks; it does not use a face-detection model. Active calls can share the screen.
- Responsive web UI, installable PWA shell with offline static assets, health endpoint, and opt-in notifications while the app remains connected in a background tab
- No paid auth platform dependency

## Local quick start

```sh
cp .env.example .env
# Edit .env: set JWT_SECRET to a random value of at least 32 characters.
# Optional: set SATOSHICORE_AI_API_KEY to enable AI chat.
# Optional: set REFERRAL_REWARD_CREDITS (defaults to 100 credits per member).
# For localhost-only demo set DEV_GUEST_LOGIN=true
npm install
npm test
npm start
# Open http://localhost:3000 in TWO separate browser sessions.
```

For real Google sign-in, configure an OAuth Web Client in Google Cloud, set `GOOGLE_CLIENT_ID` and add `http://localhost:3000` as an authorized JavaScript origin during local development. **Use HTTPS in production**. Google account scope is basic identity; no Gmail API access is requested.

## Public announcements

Administrators can schedule news, image, and video announcements for the reserved Lobby and Contacts placements at `/admin.html`. Add the comma-separated Google account emails to `ADMIN_EMAILS` in the server environment. Only those signed-in accounts can create, edit, publish, or remove items. A placement shows at most one item at a time; overlapping published schedules for the same placement are rejected. Items are labeled “ประชาสัมพันธ์”, videos require the user to press play, and there are no popups or ad push notifications. Admins can upload JPEG/PNG/WebP images (up to 5 MB) and MP4/WebM videos (up to 25 MB), or reference HTTPS hosted media. Uploaded files are stored under the server data directory and served only as image/video types.

## Notify

**Notify** is the app's notification bot service. Trusted systems such as an internet monitor or face scanner can send one-to-one or multi-recipient notifications. The app stores each notification in the recipients' inboxes and delivers it over Socket.IO immediately when a recipient is connected. Optional Web Push wakes a subscribed browser when it is closed. Saved recipient groups let a bot reuse the same audience. The API accepts an optional JPEG, PNG, or WebP image up to 2 MB and an ISO 8601 event time.

1. Sign in to the app and add the intended recipients as friends.
2. Open **Notify → My bots**, create a bot, and copy its key immediately. Store it as a secret on the trusted scanner/monitor server. Never embed it in a public webpage or device that users can inspect.
3. Use each recipient's public profile ID from `GET /api/friends` or `POST /api/users/search` (with the normal sign-in token). You can send directly to one ID or up to 100 IDs, or create a saved recipient group in **Notify → กลุ่มผู้รับ**. Every recipient must be a friend of the integration key owner.
4. Send `POST /api/integrations/notifications` with `Authorization: Bearer nsat_…` and a JSON body such as:

```json
{
  "recipientIds": ["profile-id-1", "profile-id-2"],
  "title": "Office internet",
  "body": "Connection restored",
  "source": "Network monitor",
  "occurredAt": "2026-11-25T10:15:00+07:00"
}
```

For a scan image, add `"image": "data:image/jpeg;base64,…"`. The user's app shows the event, source, timestamp, and image in **Notify → กล่องแจ้งเตือน**. Use `recipientId` for one user, `recipientIds` for a one-time list, or `groupId` for a saved group.

### MikroTik RouterOS WAN alerts

The example in [`examples/mikrotik/notify-wan.rsc`](examples/mikrotik/notify-wan.rsc) uses Netwatch to check reachability of `1.1.1.1` every 30 seconds and sends an alert to a saved Notify group when the probe changes between up and down. It measures internet reachability through the active route, not the physical link state of a specific WAN port.

1. In Notify, create a Bot and a recipient group. Use a one-person group for a direct alert.
2. Replace `nsat_REPLACE_WITH_BOT_KEY` and `REPLACE_WITH_NOTIFY_GROUP_ID` in both scripts in the `.rsc` file. Keep the Bot key private.
3. Import the file on the router with `/import file-name=notify-wan.rsc`.
4. Check the RouterOS log for `Notify sent`; failed HTTPS requests are logged as errors. `check-certificate=yes` requires the router to trust the HTTPS certificate chain.

Netwatch state-change scripts and HTTP POST use RouterOS' built-in scripting and Fetch tools; see [MikroTik Netwatch](https://help.mikrotik.com/docs/spaces/ROS/pages/8323208/Netwatch) and [MikroTik Fetch](https://help.mikrotik.com/docs/spaces/ROS/pages/8978514/Fetch). If the router or upstream filters ICMP, replace `1.1.1.1` with a stable probe host reachable from that WAN.

Bot keys are created with `POST /api/integrations/keys` using the user's normal sign-in token, listed with `GET /api/integrations/keys`, and revoked with `DELETE /api/integrations/keys/:id`. Recipient groups use `GET/POST /api/notify/groups` and `PUT/DELETE /api/notify/groups/:id`. Notifications can be fetched with `GET /api/notifications?limit=50`; mark one read with `PATCH /api/notifications/:id/read` or all read with `PATCH /api/notifications/read-all`.

To enable push while the app is closed, generate VAPID keys with `npx web-push generate-vapid-keys`, set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in the server environment, restart the service, then let each recipient enable notifications on their device. Notification records and uploaded images are stored in the local data directory; configure access controls, backups, and a suitable retention policy before sending sensitive face-scan data.

## Production domain target

This GitHub repository is the development source. The production runtime is **https://notify.satoshicore.org**, served from the iMac. Its root (`/`) is the installable Notify PWA for signing in with the same Google backed chat account, creating notification bots and recipient groups, and viewing incoming alerts. The portal adapts to phones, tablets, and desktop browsers; its install button uses the browser install prompt where available and gives Add to Home Screen steps on iOS. The Notify service runs separately from chat and the iMac deployment adds a dedicated Caddy route without replacing the chat proxy.

1. Confirm `notify.satoshicore.org` resolves to the iMac running the production service.
2. Put the Node app behind an HTTPS reverse proxy and set `NODE_ENV=production`, `TRUST_PROXY=true`, a fresh `JWT_SECRET`, and the Google OAuth client ID. Keep `DEV_GUEST_LOGIN=false`.
3. Add `https://notify.satoshicore.org` as an authorized JavaScript origin for the Google OAuth Web Client. This app uses Google's Identity Services credential callback; it does not use a separate OAuth redirect URI.
4. Configure TURN for reliable calls across networks, then verify the service from two devices on different networks.

DNS and the running service are managed on the production iMac; changes in this development repository do not publish or restart the app. Google OAuth has been created in a separate Google Cloud project and is in **Testing** status with the owner account as its only test user. Public Google sign-in requires the OAuth app verification/publishing steps.

For the iMac/Caddy host, create `.env.production` with the Google client ID, a fresh `JWT_SECRET`, and VAPID keys. Keep that file private; Git ignores it. Run `bash deploy/install-on-imac.sh` from Terminal. The installer creates a separate `com.satoshicore.notify` launch agent on loopback port 3002, stores Notify data in `.data/`, adds `Caddyfile.notify`, validates Caddy, and reloads the Caddy services. It leaves the existing chat proxy on port 3001 untouched. macOS requests the administrator password because the shared Caddy config is root-owned; enter it in Terminal, not in chat.

### Network ingress for the iMac

The production Caddy service terminates HTTPS on TCP 443 and redirects HTTP on TCP 80. Keep the Node service bound to loopback on port 3002; do not expose it directly. If the router or ISP does not allow inbound port forwarding to the iMac, use a VPS or a tunnel service that can serve the custom domain.

## Status and limits — IMPORTANT

This is a **prototype, NOT a production-ready LINE replacement**. Video calls are 1:1 only. Current shared chat features include compressed photos, short voice messages, small allow-listed files, polls, reactions, text editing, and quoted replies. Private direct chats and friend requests are available. Call records are stored only in the current browser and are not synced across devices. Persistent Web Push (VAPID) is not configured; opt-in notifications only work while the app maintains a live connection. Group video calls/SFU, E2EE, backups, a TURN service, a production database, and horizontal scaling are not implemented. The current production ICE configuration uses STUN only; direct calls can fail on carrier NATs or restrictive Wi-Fi until a TURN relay and reachable relay ports are configured. Rooms are discoverable/public for authenticated users; do not use for confidential conversations. Ordinary login sessions are held in browser sessionStorage; the default trusted-device choice uses localStorage for 30 days. These are not hardened HttpOnly cookie sessions. Guests are **unverified identities**, only useful for localhost demo; NEVER enable guest login on a public server. Chat history, photos, and voice clips are stored unencrypted on the server. Wallet recovery keys are encrypted in browser local storage and require a separate wallet password; clearing browser data can remove that encrypted copy, so users must keep the recovery key they confirmed backing up. Browser encryption does not protect keys on a compromised device or against malicious same-origin code. This prototype does not read NSAT Mainnet balances or send transactions. Node process should be run behind HTTPS reverse proxy and protected with firewall and observability before public use. Google STUN is not sufficient for reliable calls across restrictive NAT: self-host Coturn and configure `ICE_URLS` / TURN credentials for production. For group calls use a properly secured SFU such as LiveKit.

## Ownership and licensing

The application-specific original source files in this prototype are newly authored for the NSAT project. Their final copyright status depends on applicable law and human creative contribution; **no guarantee of 100% exclusive copyright in AI-generated material**. Dependency copyrights remain with their authors; check `npm` package licenses before deployment. Socket.IO (MIT), Express (MIT), google-auth-library (Apache-2.0), JWT tooling and other packages have their own terms. This project does not copy WorkAdventure, LINE or Telegram code or assets. See `THIRD_PARTY.md`.

## Security checklist before production

1. Revoke previously exposed GitHub PAT. Never put API keys, JWT secrets or credentials in repository.
2. Replace demo login with real Google login; validate issuer/audience and enforce HTTPS.
3. Implement durable auth sessions/refresh and CSRF/abuse defense; limit users per room.
4. Extend access controls to managed groups, then add block/report/moderation and broader abuse controls.
5. Use a real transactional database for accounts/room ACLs/history, enforce retention and backups.
6. Configure TURN credentials with short-lived tokens, monitor traffic and quota.
7. Security review, browser/device testing, privacy policy, vulnerability scans and load testing.
