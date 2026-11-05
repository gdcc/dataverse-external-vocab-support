# Throttle tests — IQSS/dataverse#12392

Tests for the `cvocThrottledAjax` helper in `services/utils/cvocutils.js` and its
use in `services/people/people.js`.

## 1. Unit tests (no network, deterministic)

Loads the real `cvocutils.js` with a stubbed `$.ajax` and fake timers, so the
actual queue / retry / concurrency / settle-deadline logic is exercised without
touching the network. Safe to run anywhere and in CI.

```
node services/people/test/throttle.test.js
```

Asserts: happy path; 404 and status-0 are terminal (1 attempt, no retry);
429/503 recover via retry honoring `Retry-After`; `maxRetries` is respected;
concurrency never exceeds the cap (4) under a 24-request burst; the queue fully
drains with no leaked slots; and a hostile `Retry-After` is bounded by the global
settle deadline.

## 2. Live sandbox smoke test (network required)

Answers the review merge-gate: confirm the throttle works against a real ORCID
public API. Targets the ORCID **sandbox** (`https://pub.sandbox.orcid.org`) to
avoid load on production. Requires Node 18+ (global `fetch`) and outbound network.
Not run in CI.

```
node services/people/test/throttle.sandbox.live.js
```

Optional env:

```
ORCID_IDS="<sandbox-id>,<sandbox-id>"  # real sandbox ORCIDs to also test the success path
BURST=60                               # number of concurrent lookups to simulate
MAX_CONCURRENT=4                       # cap to assert against
```

Asserts: peak concurrency never exceeds the cap; every request reaches a terminal
state; the queue drains. If any 429/503 is encountered, it must be retried (not
immediately degraded). If none occur at cap 4, that is itself consistent with the
fix — raise `BURST` / lower `MAX_CONCURRENT` to provoke and exercise the retry path.
