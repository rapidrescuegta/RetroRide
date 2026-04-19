# RetroRide — Quick Start (5 minutes)

> **Goal:** get the family playing together on phones over Wi-Fi or hotspot, as fast as possible.

---

## 👨‍👩‍👧 For the family playing (the easiest path)

If a developer has already deployed RetroRide to a live URL (e.g. `https://retroride.app`), **this is all you need**:

### On each phone

1. **Open the URL** in Chrome (Android) or Safari (iPhone).
2. **Tap the share icon → "Add to Home Screen"** (iPhone) or the ⋮ menu → "Install app" (Android). This makes it launch like a real app.
3. **Tap the RetroRide icon** on your home screen.
4. Choose your avatar and nickname.

### Starting a game together

**One person is the host.** The others are joiners.

1. **Host:** Tap **Multiplayer → Create Room**. A 6-letter code appears (e.g. `PLANE7`).
2. **Host:** Read the code out loud, or text it to the family.
3. **Joiners:** Tap **Multiplayer → Join Room**, type the code, tap **Join**.
4. When everyone's avatars appear in the lobby, host taps **Start Game**.
5. Pick any game from the list. Play!

### On a plane / hotspot-only setup

- Turn on **one phone's Wi-Fi hotspot** (Settings → Personal Hotspot).
- All other phones **connect to that hotspot**.
- Everyone opens the RetroRide URL.
- Follow the lobby steps above.

**⚠️ If the hotspot has no internet at all** (pure plane mode), rooms may fail to connect — the signaling handshake needs to reach the RetroRide server. Airline Wi-Fi usually works. If the lobby spins forever, see the Full Guide section on "Local Mode (QR)".

---

## 👩‍💻 For the developer setting it up tonight

### 3-minute local test (just to prove it runs)

```bash
cd ~/retroride
cp .env.example .env
# Edit .env — set a dummy DATABASE_URL pointing to a local Postgres, and dummy Stripe keys.
# (Payments won't be used, but the app boots faster if the vars exist.)

npm install
npx prisma migrate dev --name init   # creates the signaling tables
npm run dev
```

Open `http://localhost:3000` → create a room in one browser tab, join from another → you should see both avatars connect.

### Deploy in 5 minutes (Railway)

1. Push the repo to GitHub.
2. At [railway.app](https://railway.app) → **New Project → Deploy from GitHub**.
3. Add the **PostgreSQL plugin** (it auto-sets `DATABASE_URL`).
4. Set `NEXT_PUBLIC_APP_URL` to the Railway-generated URL.
5. Leave Stripe/Resend blank for now — they're optional (payments will be disabled).
6. Wait ~2 minutes for the first deploy.
7. Visit the Railway URL on your phone and test the lobby.

Full deploy details: see `docs/SETUP.md`.

---

## 🆘 Troubleshooting — one-liners

| Problem | Try this first |
|---|---|
| "Room not found" | Host and joiner must be on the same build — make sure everyone reloaded after deploy |
| Lobby spins forever | Airline Wi-Fi may block outbound requests; try phone hotspot instead |
| Wordle/Hangman unplayable on phone | **Known issue — use a phone with a physical keyboard or play a different game** |
| Can't install PWA | Safari → Share → Add to Home Screen. Private browsing blocks installs. |
| Audio cuts out | iOS mutes audio in background tabs; keep the game tab foregrounded |

---

**Next:** `docs/FULL_GUIDE.md` for every option (Railway, Docker, local-only, TURN setup).
