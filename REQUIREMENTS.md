# NSAT Messenger requirement tracker

Status: `✅` implemented in this app; `🟡` partial or only present in a separate service; `⬜` not implemented. Status refers to the source in this project and is updated only after code and verification.

## Product goal and navigation model

Build NSAT Messenger around the everyday jobs of its members—finding a person, continuing a conversation, coordinating in a room, and starting a call. Use established messaging products such as LINE as evidence about familiar interaction patterns, while keeping NSAT's own identity, community needs, permissions, and service boundaries.

- **Chats** is the default destination. Its inbox has one search field and explicit filters for all, direct conversations, rooms, and pinned conversations. Search messages remains a separate, clearly named action because it searches message content rather than people or room names.
- **People** owns friend search, incoming and sent requests, the friend list, blocking, and reporting.
- **Calls** is the call workspace and recovery point for call state. Starting a call from a person's conversation remains the shortest path; calls must not be confused with a chat type.
- **Settings** owns profile, privacy/session controls, and account actions. It is secondary navigation rather than a peer mixed into the conversation list.
- **Communities, channels, bots, and Wallet** become top-level destinations only when the corresponding membership model, server behavior, and service integration are implemented. A separate service is linked explicitly; an unavailable capability is not shown as a working destination.

This navigation model is the product direction; status checkboxes below still describe only what is implemented today.

## 1. Identity

- [x] Sign in with Google/Gmail (Google Identity token verified server-side).
- [x] First-time Google or local-demo members complete a unique username and display name before entering chat; profile details persist in the local profile store.
- [x] Profile photo/cover, status, bio, optional birthday, website, city, work, education, relationship status, private optional phone, and per-field audience controls are implemented; email stays private.
- [🟡] Find users by username prefix or exact Gmail; wallet address lookup is not implemented.
- [x] Friend requests, accept/decline, friend list, block/unblock, and account reports are stored locally; moderation review UI is still missing.
- [x] Opt-in trusted-device sign-in persists for 30 days; ordinary sign-in expires after seven days.
- [x] Manage signed-in devices, revoke individual or all other sessions, and disconnect their realtime sockets.

## 2. Messaging

- [x] Private 1:1 real-time chats with server-checked membership and persisted conversations.
- [🟡] Shared rooms support multiple members; private group membership/roles are not implemented.
- [🟡] Compressed photos and short voice clips are in the code; video and documents are not.
- [x] Short voice messages.
- [🟡] Edit own text, delete own messages for everyone, react, vote in polls, and reply with quoted context; browser review is pending and forward is not implemented.
- [🟡] Server-side sent/read receipts and typing events plus visible indicators are implemented; physical-device UI review is pending.
- [x] Search text and polls in accessible rooms and private chats.
- [x] Pin messages and chats; pins persist per account and pinned messages can be reopened from the People panel.
- [🟡] Authorized devices load persisted history, receive live updates, and can review or revoke signed-in sessions; bounded text retry with duplicate protection is implemented for the active browser tab.
- [ ] New-message notifications.

## 3. Calls

- [🟡] 1:1 voice-only calls are implemented alongside video mode; actual microphone-to-microphone device testing remains pending.
- [x] 1:1 video calls.
- [🟡] Mute microphone, toggle camera, and use browser-supported echo cancellation, automatic gain control, and noise suppression during a call; physical-device verification is pending.
- [🟡] Select camera, microphone, and speaker devices during a call, with data-saver/balanced/clear profiles; Balanced and Clear adapt down under sustained congestion and recover after stable samples. Browser/device review is pending.
- [🟡] Screen sharing is deployed in the app; permission handling and peer-to-peer use remain unverified.
- [🟡] Recent, missed, declined, and completed call records are shown on the current device; notifications and cross-device sync are not implemented.
- [ ] Group calls (later phase).
- [ ] Configure TURN for restrictive networks.

## 4. Security and privacy

- [x] HTTPS/TLS on the production domain.
- [x] Server-side Google token verification and authenticated Socket.IO connections.
- [🟡] Account blocking and report intake are implemented; content-level reporting and moderator review tools are missing.
- [ ] Profile and presence visibility controls.
- [🟡] Auth and message rate limits exist; broader abuse controls are incomplete.
- [ ] Automated backup and recovery.
- [ ] Security event log with data minimization.
- [ ] End-to-end encryption.

## 5. PWA and devices

- [🟡] Responsive browser UI and PWA manifest; mobile hierarchy revised against messaging usability research and previewed at 430×932, but physical iPhone 14 Pro Max verification is pending.
- [ ] Install verification on Android, iOS, and desktop.
- [ ] Push notifications.
- [ ] Useful offline mode.
- [🟡] Safe queued text messages and retry are available in session storage, capped at 30 messages and 24 hours; media retry and cross-device outbox sync are not implemented.
- [ ] Thai and English UI.
- [🟡] Dark desktop and light mobile themes exist; accessibility and physical-device review are outstanding.

## 6. Communities and channels

- [🟡] Shared rooms can be created; private/public controls and member management are missing.
- [ ] Announcement channels.
- [x] Invite links and unique referral codes; grant inviter and new member reward credits after the new member completes first-time profile and wallet setup.
- [ ] QR codes for invite links.
- [ ] Owner/admin/member roles.
- [ ] Member permissions and moderation.
- [ ] Public room/channel discovery.

## 7. NSAT Wallet

- [🟡] A separate NSAT Wallet exists in the SatoshiCore chat stack; it is not connected to this app.
- [🟡] First-time members create a device-local non-custodial Ed25519 wallet and can access its encrypted recovery key in their profile; multi-wallet management is not implemented; users can restore the same wallet on another device with their recovery key.
- [ ] Read NSAT Mainnet balance and transaction history.
- [ ] Send/receive NSAT.
- [ ] In-chat payments and user-verified Gmail/username/address links.
- [ ] Review exact recipient, amount, and fee before each transfer.
- [ ] Additional transaction confirmation/PIN.
- [🟡] First-login recovery-key backup confirmation and device encryption are implemented; backup remains the user’s responsibility and multi-wallet support is not implemented.
- [x] Verify first-login wallet control with a one-time server challenge signed by the device-held private key; the private key never leaves the device.
- [x] Keep wallet private keys out of the chat server; only the public address and backup-confirmation flag are stored.

## 8. Bots and automation

- [ ] Bot accounts and scoped API tokens.
- [ ] Webhooks.
- [ ] Group/chat commands.
- [ ] Automated notifications.
- [ ] Least-privilege bot access and anti-spam controls.

## 9. Mini Apps

- [ ] Embedded mini-app surface.
- [ ] Permission model for mini apps.
- [ ] Consent-based profile sharing.
- [ ] Consent-based NSAT Wallet handoff.
- [ ] App catalog and version management.

## 10. 2D Pixel Social World

- [🟡] A separate NSAT chat-stack contains an experimental world panel; it is not integrated with this app and its API is not available at the checked local port.
- [ ] Avatar identity linked to an account.
- [ ] Multiplayer movement and proximity discovery.
- [ ] Room chat and spaces in the world.
- [ ] Opt-in proximity voice/video.
- [ ] Wallet access from avatar profile.
- [ ] Community spaces and events.

## 11. Administration

- [ ] Service and user dashboard.
- [ ] Account and complaint management.
- [ ] Spam/abuse reports.
- [ ] Operational logs and error status.
- [ ] Database/storage health.
- [ ] Backup, restore, and incident workflow.
- [ ] Admin roles and policy controls.

## 12. Infrastructure

- [🟡] Node API, Socket.IO, HTTPS reverse proxy, and health check are running; message, profile, and conversation data use local JSON files.
- [x] Realtime WebSocket signaling.
- [🟡] WebRTC 1:1; TURN is not configured.
- [🟡] Images and voice clips are stored in message JSON with strict size caps; general file storage is not implemented.
- [ ] Job queue, notification delivery, and retry.
- [ ] Monitoring and alerting.
- [ ] Low-downtime deployment and rollback.
- [ ] Capacity testing and horizontal scaling.
