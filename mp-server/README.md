# mp-server: LAN server for online Pool and Snooker

Two coworkers on different office PCs can play 8-Ball or Snooker against each other from the attendance widget. One PC runs this small server. Everyone else connects to it from **Game mode › Online** in the pool panel.

The physics is deterministic, so the server never simulates anything. It only relays moves between the two tabs: each move is the exact strike, a foul choice or a timeout, a few hundred bytes. Both tabs play every move through the same rules. After each shot the shooter also sends its settled table, so a tab that drifted is corrected (in testing it never had to be).

## Running the server (one PC)
Run these in Git Bash, from the repo folder:

```
bash mp-server/make-cert.sh                                  # once: a certificate for this PC's IP
"/c/Program Files/nodejs/node.exe" mp-server/server.js       # or double-click mp-server/start.cmd
```

- **Use this exact Node.** It must be `C:\Program Files\nodejs\node.exe`: the domain firewall's inbound allow rule names that program. The bare `node` on PATH is v10 and isn't covered.
- **Port:** 7777 (wss://). The server prints its address on start.
- **Starting automatically:** add `start.cmd` to Task Scheduler with the trigger "At log on".
- **State is in memory.** Restarting the server ends any match in progress.
- **Pages allowed to connect:** `https://globalportal.mtbc.com`, and localhost or `file://` pages for development.

## Joining (each player, once)
1. Open `https://<server-ip>:7777` in Chrome and click **Advanced → Proceed**. The page says "✓ Certificate accepted". The certificate is self-signed, so Chrome has to be told to trust it once.
2. In the pool panel, open **Game mode › Online**, type the server address (e.g. `172.16.3.132`), and press **Connect**. It reconnects by itself next time.
3. Pick **Best of** (1, 3 or 5). The game is whichever one the header switch shows: 8-Ball or Snooker, with ⚙️'s reds.
4. Press **Challenge** beside a colleague. They get an invite over their table with **Accept** and **Decline**.

## In a match
- **Turns:** each tab plays only its own turns. The other player's cue moves live on your table, and the hint says "Ali is aiming" or "Ali has ball in hand".
- **Shot clock:** it runs only on the tab whose turn it is, using that player's ⚙️ setting.
- **Next frame:** either player can press **NEXT FRAME** (or **REMATCH** once the best-of is decided).
- **Reload:** the tab rejoins the room and replays its moves to the same table. A frame is never paid twice.
- **Dropped connection:** the other player's card reads "Reconnecting 2:41". After 3 minutes the room closes and the player still there wins the live frame by forfeit.
- **Leaving:** **Leave match** (in the Online tab or the frame-over dialog) concedes the live frame.
- **Records and XP:** each tab files its own result, `poolNetRecord` / `snookerNetRecord`, plus an `online` count in `poolWinsByMode` / `snookerWinsByMode`. That count syncs as `pool:online` / `snooker:online`. XP is per frame, as in 2 Players. No per-pot XP is paid online.

## Files

| File | What it is |
|---|---|
| `server.js` | Lobby, challenges, rooms with an ordered move log, reconnect hold, origin check, rate limit. The protocol is in its header. |
| `ws.js` | A minimal RFC 6455 WebSocket with no npm dependencies; npm is unreliable behind the office's TLS proxy. |
| `make-cert.sh` | The self-signed certificate, written to `certs/` (git-ignored, since the key is private). |
| `start.cmd` | Starts the server with the right Node. |
| `test.js` | Server tests: two fake clients through lobby, challenge, moves, reconnect, expiry, origin, flood. |
| `probe.js`, `probe-client.js`, `bridge.html` | The Phase 0 connectivity probe (see below). |

The client side is `pool-dev/pool-net.js`, with the engine's online mode in `pool-dev/pool-game.js`. Its tests:
- `pool-dev/net-verify.js`: two whole engines through this server, headless.
- `pool-dev/net-browser.js`: two real Chromes clicking through the UI.

## Phase 0: does another PC get through?
Checked on 2026-10-08. A coworker's PC (172.16.3.23) reached FCU-R8-09 (172.16.3.132) over every route, and the direct `wss://` route is the one used. To test a new host PC:

```
bash mp-server/make-cert.sh
"/c/Program Files/nodejs/node.exe" mp-server/probe.js
```

On a second PC:
1. Open `https://<host-ip>:7777` and click **Advanced → Proceed**.
2. On the portal page, press F12 and paste `probe-client.js` into the console. Set `HOST` first.
3. If A1 and A2 pass, that PC can play. If nothing passes, and the probe's console shows no line from the second PC's IP, the host's firewall is blocking inbound connections.

**Why it works here:** the portal resolves to 172.16.1.142, an internal address. So a portal-to-LAN connection is private-to-private, and Chrome shows no local-network prompt. The domain-profile firewall blocks inbound by default, but the local allow rule for `C:\Program Files\nodejs\node.exe` is honoured.
