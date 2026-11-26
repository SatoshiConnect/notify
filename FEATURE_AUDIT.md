# LINE capability audit for NSAT Messenger

This is a product capability comparison, not a request to copy LINE's code, brand, artwork, or proprietary content. LINE changes features by region, account, and device; this audit reflects the official help pages checked on November 22, 2026.

## Current NSAT coverage

| Capability area | LINE capability examples | NSAT Messenger status |
| --- | --- | --- |
| Account and contacts | Profile, friends, friend discovery, 1:1 chats | Google Sign-In, editable profile/search, private 1:1 chats, friend requests/acceptance, block/unblock, and trusted-device/session controls are implemented |
| Rooms and communities | Group chats and community spaces | Shared rooms and participant list; direct-chat membership is server checked; group roles, invites, and room moderation are missing |
| Chat content | Text, stickers, emoji, photos, videos, files, voice messages | Text, emoji, compressed photo sharing, and short voice messages |
| Message tools | Reactions, editing, sharing, polls, silent send | Reactions, editing own text, deleting own messages for everyone, polls, sent/read states, typing, history search, and per-account pinned chats/messages; reply and forward are missing |
| Shared chat resources | Albums, notes, schedules, polls | Lightweight polls only; no persistent albums, notes, or calendar events |
| Calls | 1:1 and group voice/video calls | 1:1 WebRTC voice and video with bounded ICE restarts, network-stat-driven profile downshift/recovery, frame-rate-limited local appearance processing, browser-supported echo cancellation/noise suppression, in-call device selection, and on-device recent/missed call records; facial retouching, cross-device call-log sync, group calls, and physical-device verification remain pending |
| Call effects | Backgrounds, filters, screen sharing and other call activities | Natural, Soft Glow, Warm, Cool, Mono looks, browser-side smoothness, and source support for screen sharing; device-to-device call verification is pending |
| Notifications and safety | Notifications, block/report, group controls | Account reports persist for later review and blocks prevent or terminate 1:1 chats; moderator review, content reports, notifications, and group controls are missing |
| Wider LINE services | OpenChat and regional service tabs | Not implemented. LINE's available services and navigation vary by region; Thailand's 2026 redesign replaces VOOM with an OpenChat tab. |

## Suggested delivery order

1. Group membership and invitations; friend requests, blocking, private 1:1 chat membership checks, and per-account chat/message pins now exist.
2. Message reliability: read receipts, typing state, reply/forward/unsend, search, notification preferences.
3. Rich media: video/audio messages, file attachments with access checks, albums, notes and event scheduling.
4. Calls: sync recent calls across devices, add call notifications, then consider group calling through a secured SFU, screen share, background blur and improved face-aware beauty effects.
5. Safety and operations: block/report, room roles, moderation, rate limits, push notifications, backups, retention controls, access-controlled storage, and a durable production database.
6. Separate integration review for payments, commerce, and business accounts; these require their own providers, legal terms, account models, and security controls.

## Official references

- [Sending content in chats](https://help.line.me/line?contentId=20007005) — text, photos/videos, files, stickers, emoji, voice messages, editing and sharing.
- [Voice and video calls](https://help.line.me/line/smartphone?contentId=20000270&ctype=article&lang=en) — 1:1 and group calls and group-call participant display limits.
- [Call features](https://help.line.me/line/smartphone?contentId=20000273&lang=en) — screen sharing, stickers, and visual effects.
- [Albums](https://help.line.me/line?contentId=20000248) — shared photo/video albums.
- [Notes](https://help.line.me/line/?contentId=20000246) — shared chat message boards.
- [Polls](https://help.line.me/line/smartphone?contentId=20003458&lang=en) — text/date polls in chats.
- [Regional app redesign](https://help.line.me/line/smartphone?contentId=200001630&lang=en) — availability and layout can vary by region and account.

## LINE Developers integration boundary

The LINE Developers portal describes separate platform products; they do not provide a drop-in way to turn NSAT into a LINE client. Keep NSAT's current member accounts, conversations, and wallet data as their own system unless a specific integration is selected.

| Official product | What it provides | Fit for NSAT | Required setup |
| --- | --- | --- | --- |
| [LINE Login](https://developers.line.biz/en/docs/line-login/overview/) | OAuth 2.0 / OpenID Connect sign-in with a LINE account and consented profile data | Optional additional sign-in provider. It would require a deliberate account-linking rule so the same person does not accidentally get a second NSAT account. | A LINE Login channel, configured callback URL, channel ID/secret, and a tested account-linking flow |
| [Messaging API](https://developers.line.biz/en/docs/messaging-api/overview/) | A server-side bot that exchanges webhook events and replies through a LINE Official Account; supports message types and group interactions with that account | Useful for an NSAT service bot, such as support or alerts. It does not replace NSAT's member-to-member chat service or grant access to members' general LINE inboxes. | A LINE Official Account with a Messaging API channel, webhook URL, channel secret/access token, and an explicit message/consent policy |
| [LIFF](https://developers.line.biz/en/docs/liff/overview/) | A web app launched from LINE that can use LINE platform context and user data within granted permissions | Could host a narrow NSAT companion flow inside LINE, such as opening an invitation or account-linking page. It is not a substitute for the responsive NSAT web app. | A LINE Login channel with a LIFF app, endpoint URL, scopes, and an in-LINE plus external-browser review |
| [LINE MINI App](https://developers.line.biz/en/docs/line-mini-app/discover/introduction/) | A web application that runs on LINE and is configured/reviewed as a LINE service | Not needed for the current responsive web messenger; revisit only if NSAT needs distribution as a LINE app. | A LINE Developers Console account, MINI App channel, policy eligibility, and any required review/publishing steps |

No LINE integration is active in this repository. Do not display a “LINE connected” state or claim LINE sign-in, messaging, or wallet support until its channel configuration and end-to-end behavior are set up and verified. LINE Login is the smallest member-facing integration; Messaging API is the appropriate product if the goal is a LINE Official Account bot. Keep all channel secrets on the server and out of frontend bundles.

Official developer references checked November 22, 2026: [LINE Login overview](https://developers.line.biz/en/docs/line-login/overview/), [Messaging API overview](https://developers.line.biz/en/docs/messaging-api/overview/), [LIFF overview](https://developers.line.biz/en/docs/liff/overview/), [Introducing LINE MINI App](https://developers.line.biz/en/docs/line-mini-app/discover/introduction/).
