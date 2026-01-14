# Card Chess - Play Manual

# 1. Chess Rules

Standard chess movement rules apply with these modifications:

* No castling
* No draw with 50-move rule or 3-fold repetition
* King capture wins (if you destroy a piece and expose your opponent King, you can capture it directly to win the game)
* Checkmate (for self checkmate)/stalemate is checked every time a card is played/ a move is made

# 2. Time System

* Time is a resource to spend for card play and piece movement. It doesn't deplete when the real world time passes.
* It depletes when you
   * Plays a card with time cost
   * Move pieces (costs 3 seconds)
   * Mulligan (costs 10 seconds)
   * Have Disturb tags resolved (1 second per tag)
* **If your clock reaches 00:00, you lose!**
* Every 60 seconds accumulated in a single turn, your opponent draws 1 card immediately, up to max. hand size (7)

# 3. Control Power System

* Each square with control power > 0 controlled by white, each square with control power < 0 controlled by black.
* Each square at rank 1 and rank 2 starts with control power of 1, while each square at rant 7 and 8 starts with control power of -1. Other squares start with control power of 0
* For a specific square, each white piece attacks it cause it +1 control power, while each black piece attacks it cause it -1 control power
* A piece doesn't attack the square it stands. A long-range piece's attack doesn't pass through other pieces (it still attacks the square other pieces stands).

# 4. Energy System

* Required to play non-Energy cards
* Starts at 0 with a cap of 0
* Play Energy cards to increase your cap by 1 and gain 1 energy
* Refills to your energy cap at the start of each turn
* Leftover energy at end of turn converts based on your mode (see Focus/Disturb)

# 5. Focus / Disturb System

Toggle between two modes that affect how your leftover energy is used at end of turn:

# - Focus Mode

* Leftover energy converts to **clock time** (1 energy = 1 second)

# - Disturb Mode

* Leftover energy converts to **Disturb tags on your opponent**
* Disturb tags are resolved when opponent plays their first non-Energy card:
   * All tags are removed
   * Opponent loses 1 second per tag
* If opponent moves without playing cards, tags are cleared with no penalty

# 6. Scramble Mode

* When you would draw a card but you cannot, you lose all the energies and energy cap. You discard all the cards in your hand.

# 7. Pre-set Deck Composition (60 cards)

|Card|Quantity|Energy Cost|Time Cost|Effect|
|:-|:-|:-|:-|:-|
|Energy|24|\-|\-|\+1 energy cap, +1 energy|
|Pawn|10|1|10s|Deploy a Pawn|
|Knight|4|3|30s|Deploy a Knight|
|Bishop|4|4|40s|Deploy a Bishop|
|Rook|4|5|55s|Deploy a Rook|
|Queen|1|9|115s|Deploy a Queen|
|Ponder|4|3|40s|Draw 2 cards|
|Energy Grow|4|2|25s|\+1 energy cap|
|Slash|4|5|55s|Destroy a piece on a square you control|
|Deep Analysis|1|7|110s|Draw 4 cards|

# 8. Appendix

# Deployment Rules

* You can only deploy to empty squares you control
* Deployed pieces cannot move on the same turn
* Deployed pieces cannot give direct check
* If you deploy a pawn directly on the promotion square, you may directly deploy a promoted piece, as long as the deployed piece doesn't cause a check.

# Game Setup

1. **Starting Board**: Each player begins with only their King (White on e1, Black on e8)
2. **Starting Hand**: Draw 7 cards from your 60-card deck
3. **Mulligan Phase**: You may mulligan (redraw your entire hand) at a cost of 10 seconds per mulligan
4. **First Turn**: White goes first but does NOT draw a card on their first turn

# Hand Management

* **Maximum hand size**: 7 cards
* If you have more than 7 at the end of the turn, you must discard down to 7

# Turn Structure

* **Turn Start**:
   * Draw 1 card (except White's first turn)
   * Energy refills to your energy cap
* **Main Phase**:
   * Play cards from your hand
   * Stopwatch threshold processed (opponent draws if every 60 seconds spent, up to max. hand size)
* **Turn End**:
   * Move one of your pieces
   * Leftover energy converts based on Focus/Disturb mode
   * Stopwatch resets

**Note**: You can play multiple cards per turn, but only ONE Energy card per turn.
