// GameBuddi — blog post registry
// To add a new post, append a new BlogPost object to the `posts` array below.
// Drafts originate in ~/growth-engine/content/gamebuddi/
// Pre-converted snippets live in ~/growth-engine/ship-kit/snippets/gamebuddi-*.tsx

export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  date: string            // ISO yyyy-mm-dd
  author: string
  readTime: string
  category: string
  content: string         // HTML string with Tailwind classes
  faqs?: Array<{ q: string; a: string }>
}

export const posts: BlogPost[] = [
{
  slug: 'best-offline-multiplayer-card-games-2026',
  title: 'The Best Offline Multiplayer Card Games for 2026',
  excerpt:
    'You\'re on a plane, in a car, or at a cottage with no Wi-Fi. These are the card game apps that actually work offline — and the ones that don\'t.',
  date: '2026-04-22',
  author: 'GameBuddi Team',
  readTime: '6 min read',
  category: 'guides',
  content: `
<p class="text-slate-700 leading-relaxed mb-5">You’re at 35,000 feet. Two hours until landing. The kids are
restless. Airplane Wi-Fi is $12 per device and half the time it doesn’t
work anyway. You pull up the App Store and search “multiplayer card
games.”</p>
<p class="text-slate-700 leading-relaxed mb-5">Here’s what happens next for 90% of the apps you find: you download,
open, and see “Please connect to the internet to play.” Refund,
next.</p>
<p class="text-slate-700 leading-relaxed mb-5">This guide is for anyone who’s hit that wall. It’s an honest review
of every multiplayer card game app that ACTUALLY works offline in 2026 —
plus the ones that claim to and don’t — plus exactly what to install
before your next flight.</p>
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">Why most
“offline” card apps aren’t really offline</h2>
<p class="text-slate-700 leading-relaxed mb-5">If you search the App Store for “offline card games,” you’ll find
dozens of apps with “offline” in the title. Most are solo Solitaire.
That’s not offline multiplayer — that’s single-player.</p>
<p class="text-slate-700 leading-relaxed mb-5">When you filter for actual multiplayer, the list shrinks fast. Here’s
what’s actually going on architecturally:</p>
<ul class="list-disc pl-6 space-y-2 text-slate-700 mb-6">
<li class="leading-relaxed"><strong>Online-only apps (the majority)</strong> — Plato, Card Game
Club, most Jackbox derivatives, most Uno/Hearts/Spades apps in the App
Store. These use a central server to manage game state. Unplug the
internet, they won’t even launch.</li>
<li class="leading-relaxed"><strong>Online-required-for-matchmaking</strong> — apps that match
you with random players need the internet just to find an opponent. Once
matched, some continue offline; most don’t.</li>
<li class="leading-relaxed"><strong>Local Bluetooth / local Wi-Fi</strong> — some newer apps
(including GameBuddi, disclosed below) use peer-to-peer connections
between devices in the same physical space. No central server, no
internet required.</li>
<li class="leading-relaxed"><strong>Pass-and-play</strong> — old-school, one device, pass it
around the table. Works for small groups but breaks the illusion of
“multiplayer.”</li>
</ul>
<p class="text-slate-700 leading-relaxed mb-5">The shortlist of apps that genuinely do OFFLINE MULTIPLAYER across
multiple devices in 2026 is surprisingly small.</p>
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">Our test methodology</h2>
<p class="text-slate-700 leading-relaxed mb-5">For every app in this review, we did the same test:</p>
<ol type="1">
<li class="leading-relaxed">Install on two devices (one iOS, one Android).</li>
<li class="leading-relaxed">Connect both devices to home Wi-Fi. Verify multiplayer works.</li>
<li class="leading-relaxed">Turn OFF home Wi-Fi at the router level.</li>
<li class="leading-relaxed">Turn OFF cellular data on both phones.</li>
<li class="leading-relaxed">Attempt to start a multiplayer game.</li>
<li class="leading-relaxed">If it works, note the connection method (Bluetooth? Local mesh?
Peer-to-peer Wi-Fi?).</li>
<li class="leading-relaxed">Play a full hand and note any bugs or dropouts.</li>
</ol>
<p class="text-slate-700 leading-relaxed mb-5">Apps that failed step 5 are marked <strong>online-required</strong>.
Apps that passed get a full review below.</p>
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">The
offline-capable multiplayer card apps (2026)</h2>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">1. GameBuddi</h3>
<p class="text-slate-700 leading-relaxed mb-5"><em>Full disclosure: we built this.</em></p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>What it is:</strong> A PWA (installable from gamebuddi.com)
with 35+ card and arcade games. Classic card game catalog includes
Cribbage, Euchre, Hearts, Spades, Uno, Bridge, Rummy, Go Fish, War, and
Old Maid. Includes tournament mode.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>How offline multiplayer works:</strong> When two or more
devices have the app installed and are in the same physical space (same
plane row, same car, same living room), they discover each other over
local peer-to-peer connection. No internet required after the initial
game download.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Offline test result:</strong> PASSED. Played full Cribbage
hand between iOS + Android in airplane mode. Setup took ~15 seconds
(both devices needed app open + “Start Game” tapped).</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Pros:</strong> - Deepest classic card game catalog we tested
- Tournament mode for structured multi-session play - No ads, no
pay-to-win - Teach Mode for first-time players of each game</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Cons:</strong> - Paid tiers start around $4.99/month (Free
tier has 12 games only) - Does not support cross-device multiplayer
across long distances WITHOUT internet (that’s what internet is for —
but if you need both offline and long-distance, GameBuddi seamlessly
bridges when internet IS available)</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Best for:</strong> Travel parents, grandparent visits, family
card nights, cottage weekends.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">2. Solitaired (solitaired.com)</h3>
<p class="text-slate-700 leading-relaxed mb-5"><strong>What it is:</strong> A web-based card game site with solo
solitaire + multiplayer trick-taking games (Hearts, Spades, Euchre,
Bridge, Cribbage).</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>How offline multiplayer works:</strong> IT DOESN’T.
Solitaired is entirely web-based — when you close the browser or lose
connection, multiplayer is gone. Single-player solitaire variants DO
cache and work offline, but that’s single-player.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Offline test result:</strong> FAILED for multiplayer.
Single-player solitaire continues to work in a cached tab.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Best for:</strong> Solo card game practice on any device with
a browser. <strong>Not for:</strong> Airplane/cottage multiplayer.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">3. Jackbox Games
(jackboxgames.com)</h3>
<p class="text-slate-700 leading-relaxed mb-5"><strong>What it is:</strong> Pay-per-pack party games ($19.99-29.99
per Party Pack). Phone used as controller, shared screen on TV.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>How offline multiplayer works:</strong> Requires TV (or
laptop screen) as shared display + phones connecting via local Wi-Fi
room (the jackbox.tv URL). Same physical space, same local network.
TECHNICALLY playable without internet if everyone is on the same local
Wi-Fi router — but most households’ Wi-Fi requires internet uplink to
issue IP addresses.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Offline test result:</strong> PASSED on a home router even
with WAN unplugged. FAILED on airplane (no shared screen/router to
join).</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Best for:</strong> Home party nights. Office team-building at
a venue with a router. <strong>Not for:</strong> Airplane, road trip (no
shared TV), or cottage with no router.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">4. Plato (platoapp.com)</h3>
<p class="text-slate-700 leading-relaxed mb-5"><strong>What it is:</strong> A social gaming app marketed as “the
Messenger for multiplayer games.” Includes Ocho (UNO-style), Pool,
Werewolf, and chat-first games.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>How offline multiplayer works:</strong> IT DOESN’T. Plato is
cloud-based and requires internet for all multiplayer. Their positioning
is about social connection across distance — which is the OPPOSITE of
offline play.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Offline test result:</strong> FAILED. App won’t launch
multiplayer without network.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Best for:</strong> Long-distance friends + couples who want a
chat-first game app while both parties have internet. <strong>Not
for:</strong> Offline travel. Period.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">5. Pass-and-play apps (various)</h3>
<p class="text-slate-700 leading-relaxed mb-5"><strong>What they are:</strong> Single-device card game apps designed
to be passed around the table — each player takes their turn and hands
the device to the next person.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>How offline multiplayer works:</strong> One device, no
network needed, but only one player sees the cards at a time.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Offline test result:</strong> TECHNICALLY PASSES but breaks
the spirit of multiplayer.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Best for:</strong> Budget-conscious travel with one device
and patient players. <strong>Not for:</strong> Simultaneous play where
everyone sees their own hand.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">6. Physical card deck</h3>
<p class="text-slate-700 leading-relaxed mb-5"><strong>What it is:</strong> 52 cards. Rubber band. $2 at any airport
gift shop.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>How offline multiplayer works:</strong> Always. Since ~1400
AD.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Offline test result:</strong> PASSED. Works in every
condition.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Pros:</strong> Cheap, universally compatible, no battery
required, the deck fits in a pocket. <strong>Cons:</strong> Cards drop
on airplane tray tables. Kids lose the 3 of diamonds halfway through a
flight. Score-keeping falls to the parent with a boarding pass and a
pen. Cribbage requires a physical board (the one piece of “tech” card
games still need).</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Best for:</strong> Pocket backup for when technology fails.
<strong>Honest note:</strong> GameBuddi exists because physical cards
SUCK on planes. But they remain an excellent fallback.</p>
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">The honest winner
for each travel scenario</h2>
<table class="w-full border-collapse text-sm my-6">
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<th class="border-b-2 border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">
<tr class="header">
<th class="border-b-2 border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Scenario</th>
<th class="border-b-2 border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Best option</th>
<th class="border-b-2 border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Why</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top"><strong>4-hour plane flight with kids</strong></td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">GameBuddi</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Works in airplane mode, kids play together not parallel</td>
</tr>
<tr class="even">
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top"><strong>Road trip with 2 kids in back seat</strong></td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">GameBuddi or physical cards</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Both work; GameBuddi avoids dropped cards in the car</td>
</tr>
<tr class="odd">
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top"><strong>Cottage weekend with grandparents</strong></td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">GameBuddi</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Teach Mode means Grandma doesn’t need help; offline-capable</td>
</tr>
<tr class="even">
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top"><strong>Office team-building at venue with TV</strong></td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Jackbox Party Pack</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Jackbox’s phone-as-controller is better for groups of 6+</td>
</tr>
<tr class="odd">
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top"><strong>Long-distance friend game night</strong></td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Plato</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Offline capability not needed; Plato is social-first</td>
</tr>
<tr class="even">
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top"><strong>Solo practice on the train</strong></td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Solitaired</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Best free solitaire catalog</td>
</tr>
<tr class="odd">
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top"><strong>Emergency no-battery situation</strong></td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Physical deck</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Batteries die. Cards don’t.</td>
</tr>
</tbody>
</table>
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">What to install before
your next flight</h2>
<p class="text-slate-700 leading-relaxed mb-5">If you’re boarding within 48 hours and reading this because you need
a fix:</p>
<ol type="1">
<li class="leading-relaxed"><strong>Install GameBuddi</strong> from gamebuddi.com (takes ~30
seconds; it’s a PWA so works on iOS + Android).</li>
<li class="leading-relaxed"><strong>Start a game at home BEFORE the trip.</strong> One
successful session means all games are cached to the device.</li>
<li class="leading-relaxed"><strong>Install on every family member’s device.</strong> P2P
multiplayer needs the app on both sides.</li>
<li class="leading-relaxed"><strong>Keep a physical deck in your carry-on as backup.</strong>
Batteries die.</li>
</ol>
`,
  faqs: [
    { q: 'Does GameBuddi really work with airplane mode on?', a: 'Yes. Once both devices have the app open, they discover each other over local peer-to-peer without any router, internet, or cellular needed. Airplane mode is the configuration we test against.' },
    { q: 'Can I play with my friend across the country while offline?', a: 'That would require magic or a satellite link. No app can. When you\'re both ONLINE, GameBuddi bridges cross-country multiplayer normally. The offline-first design is for same-physical-space play.' },
    { q: 'What happens if my battery dies mid-flight?', a: 'The physical card deck in your carry-on happens. See item 4 above. GameBuddi is a power-sipper but nothing beats physical cards for zero-battery situations.' },
    { q: 'Can two kids share one device?', a: 'Some games have a "pass and play" mode where one device cycles through players. But the best experience is one device per person.' },
    { q: 'Do I need to pay for all 35 games?', a: 'GameBuddi\'s free tier includes 12 core card games (Hearts, Spades, Cribbage, Euchre, Go Fish, Old Maid, War, Rummy, and 4 solitaire variants). Pro tier ($4.99/month) unlocks the arcade catalog and tournament mode.' },
    { q: 'Is this just an ad for GameBuddi?', a: 'No — but we built it, so of course we\'d recommend it. The more important point is the offline-multiplayer CATEGORY. Whether you pick GameBuddi, Jackbox (in the right setting), or a physical deck, the alternative to offline multiplayer on a flight is your kids staring at YouTube Kids for 3 hours. Any of the three options above is a win over that. --- **Related guides:** - [Cribbage Online With Friends: 6 Apps Compared] (coming soon) - [Airplane Games With No Wi-Fi: A Pre-Flight Checklist] (coming soon) - [Euchre Multiplayer Apps That Actually Work Without Cell] (coming soon) - [Road-Trip Games for Adults] (coming soon) *This article is part of the GameBuddi Travel Guides series. Written by parents who have flown with kids. Last updated April 2026.*' },
  ],
},
{
  slug: 'cribbage-online-with-friends-2026',
  title: 'Cribbage Online With Friends: 6 Apps Compared (Including Offline-Capable Options) — 2026',
  excerpt:
    'Honest review of every cribbage app worth playing online with friends in 2026. Includes the few that work without Wi-Fi, multiplayer modes, peg-board quality, and what each costs.',
  date: '2026-04-25',
  author: 'GameBuddi Editorial',
  readTime: '7 min read',
  category: 'Game Guides',
  content: `
<p class="text-slate-700 leading-relaxed mb-5">If you’ve spent any time looking for a way to play cribbage online
with friends, you’ve probably noticed two things: most of the top
results are either single-player apps with bot opponents, or browser
sites that demand sign-ups, run on laggy lobby servers, and disconnect
mid-hand the moment one player loses Wi-Fi.</p>
<p class="text-slate-700 leading-relaxed mb-5">The actually-good cribbage apps for friends are buried under 2010-era
SEO. This guide finds them, ranks them honestly, and includes the rare
few that work <em>without</em> an internet connection at all — useful
when grandma’s cottage Wi-Fi cuts out or you’re on a flight without
paying for in-flight internet.</p>
<hr />
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">What “online
with friends” actually means in 2026</h2>
<p class="text-slate-700 leading-relaxed mb-5">When most people search for “cribbage online with friends,” they want
one of these:</p>
<ol type="1">
<li class="leading-relaxed"><strong>Real-time match against a specific person</strong> — your
dad in another city, your college roommate, your spouse from the next
room.</li>
<li class="leading-relaxed"><strong>Shared score-keeping for an in-person game</strong> — same
room, two phones, you both want digital pegging instead of a physical
board.</li>
<li class="leading-relaxed"><strong>Async / turn-based</strong> — play one hand a day with a
relative who’s not available at the same time.</li>
<li class="leading-relaxed"><strong>A tournament or league</strong> — five+ players, scheduled
bracket, persistent scoring.</li>
</ol>
<p class="text-slate-700 leading-relaxed mb-5">Most apps do #1 well, half do #2, very few do #3, and almost none do
#4 properly. The rankings below split it out so you can pick by which
mode you actually need.</p>
<hr />
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">At-a-glance comparison</h2>
<table style="width:100%;">
<colgroup>
<col style="width: 16%" />
<col style="width: 16%" />
<col style="width: 16%" />
<col style="width: 16%" />
<col style="width: 16%" />
<col style="width: 16%" />
</colgroup>
<th class="border-b-2 border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">
<tr class="header">
<th class="border-b-2 border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">App</th>
<th class="border-b-2 border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Real-time vs friend</th>
<th class="border-b-2 border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Async / turn-based</th>
<th class="border-b-2 border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Tournaments</th>
<th class="border-b-2 border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Works offline</th>
<th class="border-b-2 border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Price (2026)</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top"><strong>Cribbage Pro</strong> (Fuzzy Mud)</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">✅ via lobbies</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">❌</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">❌</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">✅ vs AI only</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Free + IAP</td>
</tr>
<tr class="even">
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top"><strong>Cribbage With Grandpas</strong></td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">✅ direct invite</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">✅ async</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">❌</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">❌</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">$4.99 one-time</td>
</tr>
<tr class="odd">
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top"><strong>Solitaired Cribbage</strong> (web)</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">✅ shareable link</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">❌</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">❌</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">❌</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Free, ad-supported</td>
</tr>
<tr class="even">
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top"><strong>GameBuddi Cribbage</strong></td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">✅ P2P direct</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">✅ async</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">✅ bracket mode</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">✅ full offline P2P</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Free / $4.99 mo Pro</td>
</tr>
<tr class="odd">
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top"><strong>Pogo Cribbage</strong></td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">✅ lobbies</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">❌</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">❌</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">❌</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">Free + Club $7.99/mo</td>
</tr>
<tr class="even">
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top"><strong>Cribbage Classic</strong> (offline)</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">❌ vs AI only</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">❌</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">❌</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">✅</td>
<td class="border-b border-slate-200 px-3 py-2 text-slate-700 align-top">$2.99 one-time</td>
</tr>
</tbody>
</table>
<p class="text-slate-700 leading-relaxed mb-5">The columns most people don’t think to ask about until they’re
stuck:</p>
<ul class="list-disc pl-6 space-y-2 text-slate-700 mb-6">
<li class="leading-relaxed"><strong>Tournaments</strong> — only one app on this list runs a real
bracket. Most “tournament” claims are leaderboard variations.</li>
<li class="leading-relaxed"><strong>Works offline</strong> — the rarest column. Three apps say
“yes” but only one (GameBuddi) lets you play <em>against another
human</em> offline (P2P over local Wi-Fi or Bluetooth). The other two
fall back to AI-only.</li>
</ul>
<hr />
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">The 6 apps reviewed honestly</h2>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">1. Cribbage Pro by Fuzzy Mud
Software</h3>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Best for:</strong> purists who want maximum AI difficulty and
don’t mind matchmaking lobbies.</p>
<p class="text-slate-700 leading-relaxed mb-5">Cribbage Pro is the gold standard for AI opponents — its hardest
difficulty actually plays close to optimal cribbage strategy, which most
apps don’t. Multiplayer is via public lobbies; you can also send a
direct game code to a friend, but the experience is slower and less
polished than dedicated friend apps.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Where it falls short:</strong> no async play, no tournaments,
no offline-vs-friend mode. If your goal is “play one hand a day with
grandma in Saskatoon,” this isn’t your app.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Verdict:</strong> great for solo learning. OK for spontaneous
online matches.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">2. Cribbage With Grandpas</h3>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Best for:</strong> async play with one specific person,
especially across time zones.</p>
<p class="text-slate-700 leading-relaxed mb-5">This app exists for the exact use case nobody else serves: you and
one specific friend or relative, exchanging one hand at a time over the
course of a week. Push notifications when it’s your turn. Pegging is
properly visualized. Conversation thread per game.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Where it falls short:</strong> no real-time mode, no
tournaments, no offline. Online-only — if either device drops connection
mid-hand, the game state is preserved server-side, but you can’t keep
playing until reconnection.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Verdict:</strong> if “with friends” for you means “one
specific person, one hand at a time,” this is the best app on the
market.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">3. Solitaired Cribbage (web)</h3>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Best for:</strong> quick browser games, no install
required.</p>
<p class="text-slate-700 leading-relaxed mb-5">Solitaired’s cribbage runs in any browser. Share a game link,
opponent joins, play. No accounts, no install, lowest possible friction.
Free, ad-supported.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Where it falls short:</strong> browser-only means no push
notifications, no async, no offline. The pegging interface is functional
but cramped on mobile. Ad density got noticeably heavier in 2025.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Verdict:</strong> good for one-off “let’s play cribbage right
now” with someone who doesn’t want to install anything.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">4. GameBuddi Cribbage</h3>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Best for:</strong> households or friend groups that want one
app covering real-time + async + tournament + offline modes.</p>
<p class="text-slate-700 leading-relaxed mb-5">Disclosure: GameBuddi is the publisher of this guide. We’ve tried to
keep the review honest — see the “where it falls short” section below
for the real trade-offs.</p>
<p class="text-slate-700 leading-relaxed mb-5">GameBuddi was built around two ideas the existing cribbage market
mostly ignored:</p>
<ul class="list-disc pl-6 space-y-2 text-slate-700 mb-6">
<li class="leading-relaxed"><strong>P2P offline multiplayer</strong> — when two devices are on
the same Wi-Fi or in Bluetooth range, you can play head-to-head without
internet at all. We built this for car trips and flight delays. It works
on planes, on cottage docks, in hospital waiting rooms, and anywhere
else “always-online assumed” breaks.</li>
<li class="leading-relaxed"><strong>Real bracket tournaments</strong> — proper
single-elimination or double-elimination format with up to 32 players.
Score persistence across days. Re-buy support for casual leagues.</li>
</ul>
<p class="text-slate-700 leading-relaxed mb-5">Real-time vs friend works through a direct invite link (no public
lobbies). Async play uses the same engine as Cribbage With Grandpas but
with a cleaner notification stack.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Where it falls short:</strong> the AI difficulty is currently
capped at “intermediate” — you’ll outgrow it faster than Cribbage Pro’s
hardest setting. Tournament-mode polish is usable but less mature than
the real-time mode. Free tier limits you to 3 active games at once; Pro
at $4.99/month removes the cap and unlocks all 35+ games beyond
cribbage.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Verdict:</strong> the only app on this list covering all four
“with friends” modes plus offline. If you only play casual cribbage with
one person you’ll be fine on Cribbage With Grandpas; if you want one app
that does cribbage + Euchre + Hearts + 30+ others with the same friend
group, GameBuddi is the consolidation play.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">5. Pogo Cribbage</h3>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Best for:</strong> people who already have a Pogo / Club Pogo
subscription and want cribbage as part of a larger game catalog.</p>
<p class="text-slate-700 leading-relaxed mb-5">Pogo’s cribbage runs on the legacy Pogo lobby system. Real-time only,
browser-based, ads on the free tier, removed at $7.99/month Club
Pogo.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Where it falls short:</strong> the lobby UX hasn’t been
meaningfully updated in a decade. Mobile is functional but feels like a
desktop game wedged into a phone. No offline, no tournaments, no
async.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Verdict:</strong> only worth it if you’re already on Club
Pogo for other games.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">6. Cribbage Classic (offline)</h3>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Best for:</strong> AI-only single-player on a phone, ideal
for solo travel.</p>
<p class="text-slate-700 leading-relaxed mb-5">Cribbage Classic is a paid one-time-purchase app that runs entirely
offline. No accounts, no ads, no IAP. Just you vs AI.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Where it falls short:</strong> no multiplayer at all. “Play
with friends” isn’t a feature — you and your friend would each be
playing your own AI game side by side.</p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Verdict:</strong> the right pick if you only want offline
single-player and don’t care about friends. For “with friends” use
cases, this isn’t it.</p>
<hr />
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">How to pick — a
one-question decision tree</h2>
<p class="text-slate-700 leading-relaxed mb-5">Answer this question first:</p>
<blockquote class="border-l-4 border-amber-400 pl-4 italic text-slate-600 my-6">
<p class="text-slate-700 leading-relaxed mb-5"><strong>“Will my friend and I always have stable internet during
games?”</strong></p>
</blockquote>
<ul class="list-disc pl-6 space-y-2 text-slate-700 mb-6">
<li class="leading-relaxed"><strong>Yes, always</strong> → look at <em>Cribbage With
Grandpas</em> (async) or <em>Solitaired</em> (instant web) depending on
whether you want turn-based or real-time.</li>
<li class="leading-relaxed"><strong>Sometimes no</strong> (travel, cottage, hospital, flights) →
look at <em>GameBuddi Cribbage</em> — it’s the only app that lets you
play <em>against a human</em> without internet.</li>
<li class="leading-relaxed"><strong>Never online — solo only</strong> → <em>Cribbage
Classic</em> or <em>Cribbage Pro</em> depending on whether you want
polish ($) or maximum AI difficulty (free).</li>
</ul>
<p class="text-slate-700 leading-relaxed mb-5">Second question, only if you answered “yes always”:</p>
<blockquote class="border-l-4 border-amber-400 pl-4 italic text-slate-600 my-6">
<p class="text-slate-700 leading-relaxed mb-5"><strong>“Do we ever play more than 2 people, or run friend
tournaments?”</strong></p>
</blockquote>
<ul class="list-disc pl-6 space-y-2 text-slate-700 mb-6">
<li class="leading-relaxed"><strong>Yes</strong> → <em>GameBuddi Cribbage</em> (only app on this
list with bracket-mode tournaments).</li>
<li class="leading-relaxed"><strong>No</strong> → stay with the simpler picks above.</li>
</ul>
<hr />
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">Migration
tips if you’re switching from Cribbage With Grandpas or Cribbage
Pro</h2>
<p class="text-slate-700 leading-relaxed mb-5">If you’re moving an active multi-month game from Cribbage With
Grandpas to a new app, the game-state isn’t portable — no app on this
list imports another app’s saves. Two things to do before switching:</p>
<ol type="1">
<li class="leading-relaxed"><strong>Screenshot the running score</strong> so neither player
loses progress.</li>
<li class="leading-relaxed"><strong>Agree on whether to finish the in-progress game in the old
app first</strong>, then start fresh in the new one. Mid-stream switches
end up disputed.</li>
</ol>
<p class="text-slate-700 leading-relaxed mb-5">For Cribbage Pro users moving to a friends-focused app: your
single-player AI history doesn’t carry, but your skill does. Pegging
muscle memory is identical across apps; only UI placement differs.</p>
<hr />
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">The short version</h2>
<p class="text-slate-700 leading-relaxed mb-5">If you skipped to the bottom:</p>
<ul class="list-disc pl-6 space-y-2 text-slate-700 mb-6">
<li class="leading-relaxed"><strong>One specific friend, async</strong> → Cribbage With
Grandpas</li>
<li class="leading-relaxed"><strong>One specific friend, instant web</strong> → Solitaired
Cribbage</li>
<li class="leading-relaxed"><strong>AI training</strong> → Cribbage Pro</li>
<li class="leading-relaxed"><strong>Tournaments, offline mode, multi-mode coverage</strong> →
GameBuddi Cribbage</li>
<li class="leading-relaxed"><strong>Solo travel</strong> → Cribbage Classic</li>
</ul>
<p class="text-slate-700 leading-relaxed mb-5">Cribbage isn’t a complicated category, but the apps haven’t been
honestly compared in a long time. Pick by mode, not by name
recognition.</p>
<hr />
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">Try GameBuddi free</h2>
<p class="text-slate-700 leading-relaxed mb-5">If GameBuddi sounds like the right fit — especially if you want
offline P2P play, tournament brackets, or a single app covering Cribbage
+ Euchre + Hearts + 30 more games — you can try the free tier with no
credit card. Pro is $4.99/month if you want unlimited games and
tournament mode.</p>
<p class="text-slate-700 leading-relaxed mb-5"><a class="text-amber-600 underline hover:text-amber-700" href="https://www.gamebuddi.com/signup">Start playing GameBuddi
Cribbage free →</a></p>
<hr />
<p class="text-slate-700 leading-relaxed mb-5"><em>Last updated: 2026-04-25. We update this guide when any of the
reviewed apps ship a meaningful change. Spotted something out of date?
Email <a
href="mailto:hello@gamebuddi.com">hello@gamebuddi.com</a>.</em></p>
`,
  faqs: [
    { q: 'Can I play cribbage online with friends without creating an account?', a: '**Solitaired Cribbage** is the lowest-friction option — a shareable link, no accounts. **GameBuddi** also supports anonymous "guest" multiplayer for casual one-off games (full account required for tournament mode and persistent stats).' },
    { q: 'What\'s the best free cribbage app to play with friends?', a: 'For real-time online play: **Solitaired** (free, ad-supported). For async / turn-based: **GameBuddi** free tier (3 active games). For solo + offline learning: **Cribbage Pro**.' },
    { q: 'Is there a cribbage app that works without Wi-Fi?', a: 'Yes — but only one supports human-vs-human offline: **GameBuddi Cribbage** uses P2P (peer-to-peer over local Wi-Fi or Bluetooth) so two devices can play directly without internet. **Cribbage Classic** and **Cribbage Pro** both work offline but only against AI.' },
    { q: 'Can I run a cribbage tournament with my family or league?', a: '**GameBuddi Cribbage** is currently the only app on this list with native bracket-format tournament mode. Up to 32 players, single or double elimination, persistent scoring across days. The rest of the list either has no tournament mode at all or only "leaderboard" variants.' },
    { q: 'What\'s the difference between cribbage with friends online and "play cribbage with random people"?', a: '"Random people" is matchmaking — you queue, the app pairs you with whoever\'s available. Most apps offer this. "With friends" means a specific person you know, usually via a direct invite link or username search. The apps reviewed here all support friend-specific play; the difference is whether they *also* support random matchmaking (most do) and how easy the friend-invite flow is.' },
    { q: 'Is the GameBuddi review biased because you publish the review?', a: 'Yes — partially. We tried to be honest about where GameBuddi is weaker (AI difficulty capped at intermediate, tournament mode less mature than core multiplayer, $4.99/mo Pro tier), and to fairly recommend competitors when their fit is better (Cribbage With Grandpas wins for one-on-one async, Pogo wins if you\'re already a Club subscriber). The honest version: GameBuddi is the best pick if you want *one app* that covers every "with friends" mode plus offline. If you only need one mode, a single-purpose app may serve you better. ---' },
  ],
},
{
  slug: 'airplane-games-no-wifi-2026',
  title: 'Airplane Games With No Wi-Fi: What to Actually Install Before Your Flight',
  excerpt:
    'Most apps that say \'works offline\' don\'t. This is the pre-flight install list for parents who want games that actually run at 35,000 feet without paying $12 per device for Wi-Fi that drops every 20 minutes.',
  date: '2026-05-13',
  author: 'GameBuddi Team',
  readTime: '8 min read',
  category: 'guides',
  content: `
<p class="text-slate-700 leading-relaxed mb-5">You’re sitting at the gate. Boarding starts in twenty minutes. Your
kid asks if the new Switch game will work on the plane. You realize you
have no idea. You open the App Store and type “offline games.”</p>
<p class="text-slate-700 leading-relaxed mb-5">Two hundred results. All of them say “Works offline!” in the
description. Half of them open to a “Please connect to the internet”
screen the second you sit down in seat 22B.</p>
<p class="text-slate-700 leading-relaxed mb-5">This guide is the one I wish I’d had before the Toronto–Vancouver
flight last spring. It’s the actual pre-flight install list — what
works, what doesn’t, and why. Written for parents traveling with
6–12-year-olds, but most of it applies to adults on a 14-hour Tokyo
red-eye too.</p>
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">Why “offline” almost
never means offline</h2>
<p class="text-slate-700 leading-relaxed mb-5">Here’s the trap. When an app store listing says “offline mode,” it
usually means one of three things:</p>
<ol type="1">
<li class="leading-relaxed"><strong>You can use the app menu offline, but not actually
play.</strong> You launch, you see a deck of cards, you tap “Play” — and
you hit a spinning wheel that says “Connecting…” This is the most common
bait. The game logic lives on a server. No server, no game.</li>
<li class="leading-relaxed"><strong>Solo modes work, multiplayer doesn’t.</strong> You can play
Solitaire alone, but the moment you want to play Hearts with your kid in
the next seat, you need an internet connection so the app can “match
you” — even though both phones are right there.</li>
<li class="leading-relaxed"><strong>It works for the first 5 minutes, then ads break
it.</strong> The game itself runs locally, but every 30 seconds it tries
to load an ad. The ad fails. The game freezes waiting for the ad to
load.</li>
</ol>
<p class="text-slate-700 leading-relaxed mb-5">Real offline multiplayer — the kind that works on two phones sitting
next to each other in seats 22B and 22C — uses peer-to-peer networking
(P2P). The two devices talk directly via Bluetooth or local Wi-Fi, with
no server in the middle. That’s a different architecture, and it’s rare.
Most app companies don’t build it because it’s harder and doesn’t
generate ad impressions.</p>
<p class="text-slate-700 leading-relaxed mb-5">So when you’re looking at the App Store, the test is simple:
<strong>does this app explicitly say it supports P2P, local Wi-Fi, or
Bluetooth multiplayer?</strong> If it doesn’t say that, assume it needs
the internet even when the listing claims otherwise.</p>
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">The 6
categories worth installing before takeoff</h2>
<p class="text-slate-700 leading-relaxed mb-5">These are the categories of games that actually deliver in flight
mode. We’ll go through each with a specific recommendation.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">1. P2P
card games (best for 2-4 players in adjacent seats)</h3>
<p class="text-slate-700 leading-relaxed mb-5">These are apps where two or more phones nearby pair directly and play
without an internet connection. Hearts, Spades, Euchre, Crazy Eights,
Cribbage — the classics work great in this format because they were
designed pre-internet.</p>
<p class="text-slate-700 leading-relaxed mb-5">The bar for “good” P2P card games in 2026:</p>
<ul class="list-disc pl-6 space-y-2 text-slate-700 mb-6">
<li class="leading-relaxed">Pairs in under 30 seconds without prompting for an account</li>
<li class="leading-relaxed">Survives one phone going to sleep mid-hand</li>
<li class="leading-relaxed">Lets you switch which side of the dealt hand each player sees</li>
<li class="leading-relaxed">Doesn’t ding loudly when a turn changes (your seatmate will judge
you)</li>
</ul>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Recommended:</strong> <a
href="https://gamebuddi.app/?utm_source=blog&amp;utm_medium=content&amp;utm_campaign=airplane-games-no-wifi-2026">GameBuddi</a>
covers Hearts, Spades, Cribbage, Euchre, and 30+ other card games in
true P2P mode — no server, no account required. Pairs over local Wi-Fi
or hotspot. We’re biased, obviously, but the offline-first architecture
is the whole reason the app exists.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">2. Single-device
“pass-and-play” games</h3>
<p class="text-slate-700 leading-relaxed mb-5">If your kid is the only one on the trip with a phone (or if their
phone died at the lounge), pass-and-play is the workhorse. Both players
use the same device, taking turns.</p>
<p class="text-slate-700 leading-relaxed mb-5">The classic categories that work well in this format:</p>
<ul class="list-disc pl-6 space-y-2 text-slate-700 mb-6">
<li class="leading-relaxed"><strong>Word games:</strong> word ladders, hangman, basic crossword
fill-ins.</li>
<li class="leading-relaxed"><strong>Drawing games:</strong> modified Pictionary clones where one
player draws on their lap-out tray table and the other guesses on the
screen.</li>
<li class="leading-relaxed"><strong>Quiz games:</strong> trivia decks where you flip the device
for each question. Works great with kids who like reading.</li>
</ul>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Tip:</strong> anything with a “tournament” or “ladder” mode
tends to require server-side score tracking. Look for “local play only”
modes if you want guaranteed offline behavior.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">3. Single-player
puzzles that don’t phone home</h3>
<p class="text-slate-700 leading-relaxed mb-5">Solitaire, sudoku, crossword apps, jigsaw puzzles, picross — most of
these have offline modes that work. The trap is ads. The puzzle itself
doesn’t need internet, but the ad framework does, and a lot of apps
refuse to run without “verifying” the ad system on launch.</p>
<p class="text-slate-700 leading-relaxed mb-5">The fix: download once, play in airplane mode immediately after
launch to confirm. If the puzzle loads, the ads are decoupled and you’re
good. If the screen sits on a loading wheel, it’s coupled — delete and
find another.</p>
<p class="text-slate-700 leading-relaxed mb-5">A few that consistently behave well in our testing:</p>
<ul class="list-disc pl-6 space-y-2 text-slate-700 mb-6">
<li class="leading-relaxed">Microsoft Solitaire Collection (free, ad-free if you have Game
Pass)</li>
<li class="leading-relaxed">Sudoku.com by Easybrain (works offline once you’ve played at least
one daily challenge online)</li>
<li class="leading-relaxed">Most paid crossword apps (the New York Times Crossword app,
Crossword Quest, Squardle) — paid usually means no ads, which means no
ad-network dependency</li>
</ul>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">4. Audio-only
games for the youngest passengers</h3>
<p class="text-slate-700 leading-relaxed mb-5">For kids under 6, screen time on a plane is fine but limited. What
works really well for the last hour of a long flight: audio games.</p>
<p class="text-slate-700 leading-relaxed mb-5">Most of these are podcasts, but a few are interactive:</p>
<ul class="list-disc pl-6 space-y-2 text-slate-700 mb-6">
<li class="leading-relaxed"><strong>Audible kids stories</strong> (download before leaving) —
passive but reliable.</li>
<li class="leading-relaxed"><strong>Yoto player</strong> if you packed one — fully offline by
design.</li>
<li class="leading-relaxed"><strong>Spotify Kids</strong> with downloaded playlists — works
offline if you remembered to hit the download icon at home.</li>
</ul>
<p class="text-slate-700 leading-relaxed mb-5">None of these need internet at altitude. The catch is they all need
to be downloaded before you leave home. Two days before, not two hours
before — large podcasts can take an hour to download and airport Wi-Fi
is too slow.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">5. Console/handheld games</h3>
<p class="text-slate-700 leading-relaxed mb-5">Switch Lite is still the gold standard for in-flight play for kids 6
and up. Switch games run fully offline by default; multiplayer over
local wireless works for 2 Switch devices sitting next to each other on
the tray tables. No setup. No internet.</p>
<p class="text-slate-700 leading-relaxed mb-5">Equivalent on the Apple side: any Apple Arcade game runs offline once
downloaded. Subscription-required to launch the first time, but once
it’s on the device, it stays playable.</p>
<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">6. Board games
on tray tables (low-tech, high-success)</h3>
<p class="text-slate-700 leading-relaxed mb-5">The single most underrated airplane game category: actual cards. A $3
deck of playing cards, $4 for Uno, $6 for a travel-size Catan. Battery
life: infinite. Wi-Fi requirement: zero. Risk of melting down because
the screen froze: zero.</p>
<p class="text-slate-700 leading-relaxed mb-5">If you’re traveling with kids who can read, <strong>also
pack:</strong> - A travel chess board (magnetic) - A small word-game
like Bananagrams - A deck of trivia cards (one of the “What Do You Meme
Family Edition”–style packs)</p>
<p class="text-slate-700 leading-relaxed mb-5">Mix one analog game per kid into the bag. The tray table is bigger
than you think and 30 minutes of cards usually buys 30 minutes of peace
before they go back to the screen.</p>
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">The 4-step pre-flight test</h2>
<p class="text-slate-700 leading-relaxed mb-5">The night before your flight, run this 4-step check on every game you
plan to use on the plane. Takes 5 minutes per app.</p>
<ol type="1">
<li class="leading-relaxed"><strong>Open the app while connected to home Wi-Fi.</strong> Let it
fully load to the menu.</li>
<li class="leading-relaxed"><strong>Force-quit and turn on airplane mode.</strong> Don’t just
toggle Wi-Fi off — actually engage airplane mode so the OS doesn’t try
to reconnect.</li>
<li class="leading-relaxed"><strong>Re-open the app.</strong> If it shows you the menu, good. If
it shows a connection error, that app does not work offline regardless
of what the listing said.</li>
<li class="leading-relaxed"><strong>Start a game.</strong> Play 2-3 turns. If it stalls or
freezes, that app does not actually work in flight — find a
replacement.</li>
</ol>
<p class="text-slate-700 leading-relaxed mb-5">Apps that pass all 4 steps go in the “in-flight” folder on the home
screen. Anything else gets moved off.</p>
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">What about in-flight Wi-Fi?</h2>
<p class="text-slate-700 leading-relaxed mb-5">A note on the obvious workaround. Most major airlines now offer
in-flight Wi-Fi — typically $8-15 per device, sometimes free for
elite-status passengers. Why not just buy it?</p>
<p class="text-slate-700 leading-relaxed mb-5">Three reasons:</p>
<ol type="1">
<li class="leading-relaxed"><strong>Cost stacks fast.</strong> Family of four × $12 × two
flights = $96. That’s the price of 8 paid kids games you’d actually own
afterward.</li>
<li class="leading-relaxed"><strong>It’s unreliable.</strong> Even on the airlines that have it,
in-flight Wi-Fi drops constantly. A game that depends on a live server
connection will freeze every 15 minutes. Offline games don’t care.</li>
<li class="leading-relaxed"><strong>It doesn’t help during the climbout and descent.</strong>
Roughly 40 minutes of every flight are exactly the periods kids are most
restless — and that’s exactly when devices have to be on airplane mode.
Offline games work during that window. Online ones don’t.</li>
</ol>
<p class="text-slate-700 leading-relaxed mb-5">The practical answer: install offline games first, treat in-flight
Wi-Fi as a backup for the parent’s own laptop work, not the kids’
games.</p>
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">The
download-the-night-before checklist</h2>
<p class="text-slate-700 leading-relaxed mb-5">If you’re flying tomorrow:</p>
<ul class="task-list">
<li class="leading-relaxed"><label><input type="checkbox" />Download GameBuddi or your chosen
P2P card game on every device</label></li>
<li class="leading-relaxed"><label><input type="checkbox" />Run the 4-step pre-flight test on
each</label></li>
<li class="leading-relaxed"><label><input type="checkbox" />Download Audible/Yoto/Spotify
content (3 hours of audio per kid)</label></li>
<li class="leading-relaxed"><label><input type="checkbox" />Move offline-tested games into a
single “Flight” folder on each home screen</label></li>
<li class="leading-relaxed"><label><input type="checkbox" />Pack one analog game per kid in the
carry-on</label></li>
<li class="leading-relaxed"><label><input type="checkbox" />Charge every device to 100% the
night before, plus pack a battery pack rated 10,000mAh+</label></li>
<li class="leading-relaxed"><label><input type="checkbox" />Verify the kids know where airplane
mode is — they will need to toggle it themselves the next morning when
you’re not paying attention</label></li>
</ul>
<p class="text-slate-700 leading-relaxed mb-5">If you’re flying next week, run the same checklist tonight. The
mistakes you avoid are the ones you have time to discover.</p>
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">What to do if
everything fails at altitude</h2>
<p class="text-slate-700 leading-relaxed mb-5">Worst case: you forgot the night-before install, the games you do
have don’t work, the in-flight Wi-Fi was sold out, and the kids are
about to revolt.</p>
<p class="text-slate-700 leading-relaxed mb-5">The fallback that actually works:</p>
<ol type="1">
<li class="leading-relaxed"><strong>One device, two kids, pass-and-play.</strong> Almost every
game can be reframed as turn-based if you’re willing to physically pass
the phone. Use a 1-minute kitchen-timer trick to keep it fair.</li>
<li class="leading-relaxed"><strong>The parent becomes the game.</strong> Stories from your own
childhood, “would-you-rather,” 20-questions. Sounds cheesy. Works.</li>
<li class="leading-relaxed"><strong>Sleep is the goal.</strong> A tired kid asleep at 30,000
feet is a win. Lower the screen brightness, hand them a blanket, let the
engine noise do the rest.</li>
</ol>
<h2 class="text-2xl font-bold text-slate-900 mt-12 mb-4">Final pre-flight summary</h2>
<p class="text-slate-700 leading-relaxed mb-5">The shortest version of this entire guide:</p>
<ul class="list-disc pl-6 space-y-2 text-slate-700 mb-6">
<li class="leading-relaxed"><strong>Download offline-first P2P apps the night before</strong>
(GameBuddi, Switch games, downloaded Apple Arcade).</li>
<li class="leading-relaxed"><strong>Run the 4-step pre-flight test</strong> on every app.</li>
<li class="leading-relaxed"><strong>Pack one analog game per kid.</strong></li>
<li class="leading-relaxed"><strong>Charge to 100% + battery pack.</strong></li>
<li class="leading-relaxed"><strong>Skip in-flight Wi-Fi</strong> unless you specifically need
it for adult work.</li>
</ul>
<p class="text-slate-700 leading-relaxed mb-5">A flight isn’t the time to discover your offline games aren’t
actually offline. Do the work the night before. The kids will be fine,
you’ll be fine, and the family in seats 21B and 21C won’t have to hear
“but it WORKED at home” for six hours.</p>
<hr />
<p class="text-slate-700 leading-relaxed mb-5"><strong>Related pillars:</strong> - <a
href="/blog/best-offline-multiplayer-card-games-2026">The Best Offline
Multiplayer Card Games for 2026</a> - <a
href="/blog/cribbage-online-with-friends-2026">Cribbage Online With
Friends: 6 Apps Compared (Offline Included)</a></p>
<p class="text-slate-700 leading-relaxed mb-5"><strong>Try GameBuddi free:</strong> <a
href="https://gamebuddi.app/?utm_source=blog&amp;utm_medium=content&amp;utm_campaign=airplane-games-no-wifi-2026">gamebuddi.app</a>
— 35+ card and arcade games, offline-first P2P, no account required.</p>
`,
},
]

export function getAllSlugs(): string[] {
  return posts.map((p) => p.slug)
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug)
}
