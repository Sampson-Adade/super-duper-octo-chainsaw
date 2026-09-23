# The Glitch Bargain

A mobile-first multiplayer party game prototype built around the central architecture in the brief: a server-authoritative Socket.IO game, constrained pseudo-code, synchronized deadlines, and a terminal-style browser interface.

## Open the game

On this Mac, double-click [`Open Game.command`](./Open%20Game.command). It installs packages the first time, prepares and starts the game, then opens it in your browser. Keep the Terminal window open while playing; press Control-C there to stop it.

On Replit, import the project ZIP and press **Run**. Replit installs the packages and opens the game preview automatically.

### Start a game

1. Enter a callsign and choose **Create Room**.
2. In the waiting room, choose **Solo** or **Multiplayer**, set a difficulty, then start.
3. Easy gives 90 seconds per hack, Medium 60 seconds, and Hard 30 seconds.

Multiplayer needs at least two players. Solo mode is for one player in the room.
The game does not pause during an active timer. **Back** returns to the previous page, **Go Home** leaves the room and returns to the start screen, and the host can restart a finished game with **Restart Game**. The screen footer credits Sampson Adade (2026).

For phones on the same Wi-Fi, use the phone address printed in that Terminal window. The host creates a room and shares its six-character code.

Requires Node.js 20.9 or newer. If the launcher says Node.js is missing, install it once from [nodejs.org](https://nodejs.org), then double-click the launcher again. To enable OpenAI narration, add `OPENAI_API_KEY` to the generated `.env` file; this is optional.
## Solo campaign

- Each campaign tier has the configured 3–7 bosses, fought one at a time. Every boss gets a newly randomized exploit recipe, target, and code functions. Later tiers add more lines at a gradual, accelerating pace.
- After clearing a tier, choose one AI you captured to help in the next tier. Prompt it once per boss and it autofills up to half the required lines, starting after the correctly typed lines already in your draft. You type the remaining lines yourself. Each new boss you defeat first joins your roster, then you choose an existing AI to merge it into or keep it independent.
- Required lines grow gradually at first, then accelerate in small steps with a 20-line cap. The second tier is 1.5× the opening tier. The full code recipe stays visible. Only two lines have auto-add buttons at the start, with one more button unlocked per tier; type the rest yourself.
- During the final five seconds, the current boss erases code from the beginning of your draft. Erasure gets faster in each tier; a higher fusion rank offers a small slowdown. If the timer expires, the AI counter-codes for five seconds and costs a life. A solo run starts with three lives; a failed boss must be retried before advancing.
- A red screen-edge flash warns you during the final ten seconds.

## Multiplayer

- Create a room and share its six-character code with 1–15 friends. Callsigns are checked on both the game screen and server; profanity, sexual/adult terms, and common disguised spellings are rejected.
- The room's QR code and **Copy link** button point to `/join?room=ROOMCODE`; invite links fill and lock the room-code field.
- The host chooses the AI voice, difficulty, and 3–7 rounds.
- Players write pseudo-code, make physical claims, and can challenge one claim during the review window.
- The server controls deadlines, validates code, resolves challenges, and calculates scores.
- Co-op raid assigns each living operative their own lines. Required syntax is `3 + (living players × 2)` lines; raid time grows with group size and code erasure speeds up.
- Summoned allies accept a short prompt, autofill at most half the required lines into the draft, publish their core-drain sign-off to the terminal log, and gain or lose obedience tiers as the run goes on. Manual typing also triggers the thermal vent lottery.

## DSL

Level 1 is available immediately. Syntax unlocks at level 2 on round 3 and level 3 on round 5. In solo mode, each boss's server-generated guide shows the target, your callsign, and the randomized exploit functions required for that round. The guide is visible but not selectable or copyable. Callsigns containing profanity, sexual/adult terms, common disguised spellings, or profane internet abbreviations are rejected.

```text
when AI.threatens("purge");
  require player.holding("metal");
  define target as "Alex";
  trigger bypass on player;
```

Solo example (opening tier):

```text
when AI.threatens("purge");
  define target as "EB1";
  trigger bypass on "Spoon Bandit";
  initiate lockdown on "EB1";
```

This opening-tier example illustrates one possible recipe. The live game randomizes the functions and names for every boss; follow that round's on-screen guide. All code lines end in a semicolon.

The source is parsed as text and never evaluated. The server never executes source text. It validates the trigger against the round threat and parses allowed statements. A host can verify physical claims; a challenge is correct only when the host marked the claim false. Without host evidence, a challenged claim is treated as unverified. The server owns challenge outcomes and score conversion.

## Project layout

- `apps/web`: Next.js app and mobile terminal UI.
- `apps/server`: Socket.IO server, in-memory room state, DSL validator, timers, challenge handling, scoring.
- `packages/shared`: shared room/event types.

## Deploy the game

The game uses a long-running Node/Socket.IO server. Sites' Cloudflare Worker runtime cannot run this server as-is, so use a host for the game server plus Vercel for the web app. The steps below publish the complete playable game; a static-only deployment would show the screen but could not create or join rooms.

1. Create a GitHub repository and upload the project files. Keep `package.json`, `package-lock.json`, `apps/`, and `packages/` together because the project uses npm workspaces.
2. On Render, create a **Web Service** from the repository. Leave the root directory at the repository root. Use `npm install` as the build command and `npm run start:server` as the start command. Leave `CLIENT_URL` unset for this first deploy so you can get the server URL. Render supplies the server `PORT` automatically.
3. On Vercel, import the same repository. Set the root directory to `apps/web`, enable **Include source files outside of the Root Directory in the Build Step**, and keep the Next.js output directory on its default. The included `vercel.json` runs the npm workspace install and build from the repository root.
4. Before deploying Vercel, add `NEXT_PUBLIC_SOCKET_URL` with the public HTTPS URL of the Render service, for example `https://your-game-server.onrender.com`. Keep `NEXT_PUBLIC_SOCKET_PATH=/socket.io` or leave it unset.
5. Deploy the Vercel project. Copy its production URL into Render's `CLIENT_URL` setting, for example `https://your-game.vercel.app`. If you use a custom domain, set that exact origin instead. Save the setting and let Render redeploy.
6. Open the Vercel URL, create a room, then copy its invite link or scan its QR code.

Rooms are held in the game server's memory, so restarting the server ends active rooms. OpenAI narration is optional: set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` on the server to enable bounded exploit-quality scoring and narration. Without a key, the server uses its local narration fallback.

## MVP boundaries

The server validates player code as text and never executes it. It controls deadlines, room membership, parsing, challenge truth, thermal updates, raid assignment, and score conversion. Room state is currently in memory rather than a durable database; restarting the game server ends active rooms. Production deployments should keep the Socket.IO process running while players are in a match.
