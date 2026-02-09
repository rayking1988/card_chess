# Card Chess System Design (Architect View)

## Purpose
This document summarizes the system design of Card Chess from an architect’s perspective, focusing on network handling, front-end rendering, and back-end logic.

## High-Level Architecture
The game is a client-authoritative, peer-to-peer (P2P) multiplayer experience with a relay fallback for restrictive networks. Core game rules run on the client and are synchronized across peers.

```text
+------------------+                         +------------------+
|   Client A       |<------ WebRTC P2P ------>|   Client B       |
| Phaser + Rules   |                         | Phaser + Rules   |
+------------------+                         +------------------+
          |                                             |
          | (fallback, matchmaking, relay)              |
          v                                             v
+--------------------------------------------------------------+
| Cloudflare Workers (matchmaking + relay + stats + STUN fetch) |
+--------------------------------------------------------------+
```

## Network Handling
The networking layer prioritizes direct P2P via WebRTC and falls back to a relay when needed.

**Primary Transport (WebRTC via Trystero)**
- Room join uses Trystero; the local peer ID is used to derive host/client roles.
- STUN-only configuration is used for ICE discovery, fetched from a worker endpoint.
- Keep-alive pings and peer timeout detection maintain connection health.

**Fallback Transport (Cloudflare Worker Relay)**
- If no peer is discovered within a timeout window, the client switches to the relay.
- Relay uses Durable Objects to maintain room state and forward messages.
- Matchmaking is handled via worker endpoints with heartbeat and queueing.

**Core Data Exchange**
- `GameAction` messages drive gameplay events (card play, moves, mulligan, ready, etc.).
- State sync and event-log sync are used to repair or prevent desyncs.
- Host assigns player colors and sends authoritative sync snapshots.

**Resilience**
- Auto-rejoin attempts are made during disconnects.
- State hash comparisons detect desyncs; recovery uses state snapshots.

## Front-End Rendering
The front end uses Phaser 3 and is structured as a set of scenes plus reusable UI components.

**Scene Composition**
- `BootScene` preloads assets.
- `MenuScene` sets up matchmaking and launches the game.
- `GameScene` orchestrates gameplay, UI layout, animations, and input.

**UI Components**
- Board: `ChessBoardComponent` renders the board and pieces.
- Hand: `CardHandComponent` renders the fan layout and interaction model.
- Cards: `CardComponent` renders frames, art, costs, and text layers.
- Interaction: `CardTargetingComponent` manages drag-to-play and arrow targeting.
- HUD: `Clock`, `Stopwatch`, `EnergyBar`, `DisturbCounter`, `EventLog`, `FocusDisturbToggle`.

**Rendering Strategy**
- Layered sprites and containers for consistent z-ordering.
- Layout-driven placement via `GameLayout` for responsive UI across devices.
- Animation managers and pooled graphics reduce GC pressure for effects.
- UI updates are diffed where possible to avoid redundant `setText` calls.

## Back-End Logic (Client-Side Rules)
There is no dedicated game server; rules are enforced on the client and synchronized over the network.

**Core Managers**
- `GameStateManager` holds authoritative game state and applies rules.
- `DeckManager` manages deck/hand/discard flows and card draws.
- `gameState` module provides effect resolution, validation, and factories.

**Rules and Validation**
- Chess rules are delegated to `chess.js` with custom constraints (e.g., king capture allowed).
- Card effects include deploy, destroy, draw, energy/time modifications, and reshuffles.
- Deployment rules include control-power ownership and no-check deployment constraints.

**Control Power and Targeting**
- `controlPower` computes square ownership based on ranks and attacks.
- Target validation uses control-power plus piece-specific restrictions.

## Core Game Flow (Simplified)
1. Both clients join a room and establish a P2P connection or relay fallback.
2. Host assigns colors and sends a state snapshot.
3. Decks are initialized and hands are drawn (mulligan phase).
4. Main loop per turn:
- Player plays a card or moves a piece.
- Local `GameStateManager` applies effects and updates the board.
- Actions are sent to the peer; UI animations render updates.
- End-of-turn triggers time/energy/hand checks and state sync.

## Operational Notes
- Electron packaging is supported for desktop distribution.
- Cloudflare Workers provide relay, matchmaking, and optional stats endpoints.
- The system assumes honest clients; desync detection mitigates divergence but does not provide full server authority.
