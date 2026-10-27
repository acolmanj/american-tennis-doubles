# Charleville LTC American Doubles

A web app for running American doubles nights at Charleville Lawn Tennis Club: a new partner every round, scores per player, live rankings. Players follow the night on their phones after scanning a QR code; nothing to install.

## Screens

| Path | Who | What |
| --- | --- | --- |
| `/` | Everyone | Upcoming nights |
| `/e/:id/signup` | Players | Sign up one or several players (name, Male/Female, level) |
| `/e/:id/checkin` | Players (QR code) | Check in, confirm level for tonight |
| `/e/:id/me` | Players | My night: current court, partner, opponents, score entry |
| `/e/:id/board` | Everyone, big screen | Every round and court; organizer can start/finish rounds and enter scores |
| `/e/:id/rankings` | Everyone | Live and final rankings |
| `/organizer` | Organizer | Passcode sign-in, create nights, change passcode |
| `/e/:id/manage` | Organizer | Settings, players, QR code, draw/redraw rounds, swap players |

There is deliberately no timer: the organizer calls time on court and taps Start round / Finish round.

## Pairing

`src/lib/pairing.ts` scores each possible line-up and keeps the cheapest, round by round:

- mixed pairs (one man, one woman), relaxed only when the numbers force it, spread across players
- no repeat partners, few repeat opponents
- close games (team levels balanced) and similar levels on a court
- sit-outs shared equally, balancing men and women

The organizer's "Close games ↔ Meet everyone" slider moves the weights. Redrawing after late arrivals keeps played rounds and counts them as history.

## Scoring

Games won across all rounds. A player with fewer rounds played gets their average games per round added for each missing round. Ties: game difference.

## Data and security

Supabase (Postgres + Realtime). Tables are read-only from the browser; every change goes through database functions in `supabase/migrations`, which check the organizer passcode or the player's check-in token. Player tokens are never readable by the browser.

## Develop

```bash
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm install
npm test                     # pairing and ranking tests
npm run dev
```

Apply `supabase/migrations/*.sql` to a new Supabase project, then set the first organizer passcode:

```sql
insert into private.config (organizer_passcode_hash) values (extensions.crypt('choose-a-passcode', extensions.gen_salt('bf')));
```
