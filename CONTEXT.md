# Context

## Glossary

### Television Scoreboard

The unattended spectator display served at `/tv`.

### Shared Frame

The persistent visual shell of the Television Scoreboard that remains recognizable across runtime modes.

### Identity Rail

The top band of the Shared Frame that carries event identity, including the event title and logo.

### Scan Panel

The spectator-facing QR scan target presented as a high-visibility, center-top popup card overlay on the Television Scoreboard that can periodically fly in and out based on admin-configured interval and duration settings, or be disabled completely.

### Mode Canvas

The main content area inside the Shared Frame whose contents change by runtime mode.

### Utility Strip

An optional secondary strip in the Shared Frame used for lightweight live context without becoming the main content.

### Upcoming Entry

A competitor scheduled to participate but without a result yet. On the Television Scoreboard, Upcoming Entries follow all Ranked Results in the same paged ranking presentation while leaving rank and score fields empty.

### Raw Time

The measured duration of a competition run before Penalty Points are applied.

### Penalty Points

A scoring adjustment added to a Raw Time to produce the result score. Penalty Points are points, not elapsed seconds.

### Self-hosted Deployment Variant

An alternative distribution of BewerbsBoard that preserves the application’s user-facing behavior and authentication contract while running from Docker Compose on a user-managed Docker host without Cloudflare D1 or Workers KV.

### Admin Access Splash Canvas

A full-screen onboarding canvas served on the Television Scoreboard (`/tv`) during initial setup or when explicitly enabled, displaying the detected server IP and port (`http://{ServerIp}:{Port}/admin`), scannable QR code, and connection instructions for administrators. Can be deactivated or re-enabled from the Admin Dashboard.

## Evaluation Modes

### Single Evaluation

An evaluation that ranks entries from exactly one discipline (one `categoryTypeId`). Each group appears at most once in the result list. Identified by `categoryTypeId2 === null`.
_Avoid_: Einzelwertung (in code)

### Group-Combined Evaluation

An evaluation that sums the scores of two disciplines for the **same group** and ranks the combined result. Both disciplines must have the same competition class. Identified by `categoryTypeId2 !== null` and `isBrigadePairing === false`.
_Avoid_: Kombinationswertung (in code)

### Brigade-Combined Evaluation

An evaluation that pairs the **best-ranked group from discipline 1** with the **best-ranked group from discipline 2** within each fire brigade, then ranks the combined result across all brigades. Used to pair an AKTIV discipline with a JUGEND discipline. Remainders when brigade entry counts differ between disciplines are silently dropped. Identified by `isBrigadePairing === true` on the `EvaluationDescriptor`.
_Avoid_: isBrigadeLevel (use `isBrigadePairing`)

### Brigade-Combined Pairing Rule

Within a Brigade-Combined Evaluation, entries from each discipline are sorted ascending (lowest score = best), then paired positionally (rank-1 with rank-1, rank-2 with rank-2). When Show Single Results is disabled, surplus entries when brigade sizes are unequal are dropped without warning. When Show Single Results is enabled, surplus entries participate in the 1-result tier.

### Show Single Results Option

A configuration toggle on two-discipline evaluations (`categoryTypeId2 !== null`).
- When **disabled** (`false`): Only competitors with completed results (`VALID` or `DNF`) in both disciplines are visible. Competitors with at least 1 `DNF` receive a score of `-`, receive no numerical rank (`-`), and are positioned after all valid groups.
- When **enabled** (`true`): Competitors with at least 1 result (`VALID` or `DNF`) in either discipline are visible.
  1. Competitors with 2 `VALID` results are ranked first by combined score.
  2. Competitors with 1 `VALID` result follow, ranked by their single discipline score, with a combined score display of `-`.
  3. Competitors with at least 1 `DNF` are placed last with score `-` and rank `-`.
