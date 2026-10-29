/*
 * Unit tests for cvocThrottledAjax (services/utils/cvocutils.js).
 *
 * IQSS/dataverse#12392. These tests load the REAL helper from cvocutils.js into a
 * sandbox with a stubbed `$` (jQuery) so no network is touched and timing is
 * controlled. They assert the behaviors reviewers care about:
 *   - happy path -> success, one attempt
 *   - 404        -> error, NO retry (terminal)
 *   - status 0   -> error, NO retry (terminal: CORS/abort/offline)
 *   - 429        -> recovers after retries, honoring Retry-After
 *   - 503        -> retried
 *   - concurrency never exceeds the cap under a large burst
 *   - the queue fully drains (no leaked slots)
 *   - the global settle deadline bounds total time against a hostile Retry-After
 *
 * No dependencies. Run with:  node services/people/test/throttle.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------------------------------------------------------------------------
// Test harness: tiny assert + fake timers + a stubbed $.ajax.
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
    if (cond) {
        passed++;
    } else {
        failed++;
        failures.push(msg);
        console.error('  FAIL: ' + msg);
    }
}

// Deterministic fake clock so backoff/deadline logic runs instantly and in order.
function makeClock() {
    let now = 0;
    const timers = []; // { at, fn, id }
    let nextId = 1;
    return {
        now: () => now,
        setTimeout(fn, delay) {
            const id = nextId++;
            timers.push({ at: now + Math.max(0, delay | 0), fn, id });
            return id;
        },
        clearTimeout(id) {
            const i = timers.findIndex(t => t.id === id);
            if (i >= 0) timers.splice(i, 1);
        },
        // Advance until no timers remain or a safety cap is hit.
        drain(maxSteps = 100000) {
            let steps = 0;
            while (timers.length && steps++ < maxSteps) {
                timers.sort((a, b) => a.at - b.at);
                const t = timers.shift();
                now = Math.max(now, t.at);
                t.fn();
            }
            if (steps >= maxSteps) throw new Error('fake clock drain exceeded max steps (possible infinite retry)');
        },
        pending: () => timers.length,
    };
}

/*
 * Build a stubbed `$` whose .ajax consults a per-URL script of responses.
 * scripts: { url: [resp, resp, ...] } where each resp is one of:
 *   { ok: data }                      -> success(data, 'success')
 *   { status, retryAfter }            -> error(jqXHR, 'error', '')
 * Each call to a URL consumes the next scripted response (last one repeats).
 * Tracks concurrency (in-flight between ajax() call and its callback firing).
 */
function makeJQuery(clock, scripts, concurrencyTracker) {
    function nextResponse(url) {
        const list = scripts[url];
        if (!list || list.length === 0) return { ok: {} };
        return list.length === 1 ? list[0] : list.shift();
    }
    const $ = function () {};
    $.ajax = function (opts) {
        concurrencyTracker.start();
        // Simulate async network on the fake clock (small fixed latency).
        clock.setTimeout(function () {
            const resp = nextResponse(opts.url);
            concurrencyTracker.end();
            if (Object.prototype.hasOwnProperty.call(resp, 'ok')) {
                opts.success && opts.success(resp.ok, 'success');
            } else {
                const jqXHR = {
                    status: resp.status,
                    getResponseHeader: function (name) {
                        if (name === 'Retry-After' && resp.retryAfter != null) {
                            return String(resp.retryAfter);
                        }
                        return null;
                    },
                };
                opts.error && opts.error(jqXHR, 'error', resp.errorThrown || '');
            }
        }, 10);
    };
    // $.extend — minimal shallow merge used by the helper's header merge.
    $.extend = function () {
        const out = {};
        for (let i = 0; i < arguments.length; i++) {
            const src = arguments[i];
            if (src) for (const k in src) if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
        }
        return out;
    };
    return $;
}

function makeConcurrencyTracker() {
    let inFlight = 0;
    let peak = 0;
    return {
        start() { inFlight++; peak = Math.max(peak, inFlight); },
        end() { inFlight--; },
        peak: () => peak,
        inFlight: () => inFlight,
    };
}

// Load the real helper into a fresh sandbox per test, injecting our stub `$`,
// fake timers, and a seeded Math.random (so jitter is deterministic).
function loadHelper({ $, clock }) {
    const src = fs.readFileSync(
        path.join(__dirname, '..', '..', 'utils', 'cvocutils.js'),
        'utf8'
    );
    const sandbox = {
        $,
        console: { error() {}, log() {} },
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        Date: Object.assign(function Date() {}, { now: clock.now, parse: Date.parse }),
        Math: Object.assign(Object.create(Math), { random: () => 0 }), // zero jitter
        localStorage: undefined,
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'cvocutils.js' });
    assert(typeof sandbox.cvocThrottledAjax === 'function',
        'cvocThrottledAjax is exported from cvocutils.js');
    return sandbox;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function testHappyPath() {
    console.log('test: happy path -> success in one attempt');
    const clock = makeClock();
    const ct = makeConcurrencyTracker();
    const $ = makeJQuery(clock, { 'u/ok': [{ ok: { name: 'Ada' } }] }, ct);
    const h = loadHelper({ $, clock });

    let result = null, errored = false;
    h.cvocThrottledAjax({
        url: 'u/ok',
        success: (d) => { result = d; },
        error: () => { errored = true; },
    });
    clock.drain();
    assert(result && result.name === 'Ada', 'success callback received data');
    assert(!errored, 'error callback not called on success');
}

function testNotFoundNoRetry() {
    console.log('test: 404 -> error, no retry');
    const clock = makeClock();
    const ct = makeConcurrencyTracker();
    let calls = 0;
    const $ = makeJQuery(clock, {}, ct);
    const realAjax = $.ajax;
    $.ajax = function (opts) { calls++; realAjax(opts); };
    // No script for the URL that returns ok; force a 404 via a scripted error.
    const $2 = makeJQuery(clock, { 'u/404': [{ status: 404 }] }, ct);
    let n = 0;
    const realAjax2 = $2.ajax;
    $2.ajax = function (opts) { n++; realAjax2(opts); };
    const h = loadHelper({ $: $2, clock });

    let errStatus = null;
    h.cvocThrottledAjax({
        url: 'u/404',
        success: () => {},
        error: (jqXHR) => { errStatus = jqXHR.status; },
    });
    clock.drain();
    assert(errStatus === 404, 'error callback saw 404');
    assert(n === 1, '404 made exactly 1 request (no retry), got ' + n);
}

function testStatus0NoRetry() {
    console.log('test: status 0 (CORS/abort/offline) -> error, no retry');
    const clock = makeClock();
    const ct = makeConcurrencyTracker();
    const $ = makeJQuery(clock, { 'u/0': [{ status: 0 }] }, ct);
    let n = 0;
    const realAjax = $.ajax;
    $.ajax = function (opts) { n++; realAjax(opts); };
    const h = loadHelper({ $, clock });

    let errStatus = 'unset';
    h.cvocThrottledAjax({
        url: 'u/0',
        success: () => {},
        error: (jqXHR) => { errStatus = jqXHR.status; },
    });
    clock.drain();
    assert(errStatus === 0, 'error callback saw status 0');
    assert(n === 1, 'status 0 made exactly 1 request (no retry), got ' + n);
}

function testRetryAfterRecovers() {
    console.log('test: 429 twice then success, honoring Retry-After');
    const clock = makeClock();
    const ct = makeConcurrencyTracker();
    const $ = makeJQuery(clock, {
        'u/429': [
            { status: 429, retryAfter: 1 }, // Retry-After: 1s
            { status: 429, retryAfter: 1 },
            { ok: { name: 'Grace' } },
        ],
    }, ct);
    let n = 0;
    const realAjax = $.ajax;
    $.ajax = function (opts) { n++; realAjax(opts); };
    const h = loadHelper({ $, clock });

    let result = null, errored = false;
    h.cvocThrottledAjax({
        url: 'u/429',
        success: (d) => { result = d; },
        error: () => { errored = true; },
    });
    clock.drain();
    assert(result && result.name === 'Grace', '429 recovered to success after retries');
    assert(!errored, 'error not called once recovered');
    assert(n === 3, 'made 3 attempts (2x429 + success), got ' + n);
}

function test503Retried() {
    console.log('test: 503 is retried');
    const clock = makeClock();
    const ct = makeConcurrencyTracker();
    const $ = makeJQuery(clock, {
        'u/503': [{ status: 503 }, { ok: { name: 'Linus' } }],
    }, ct);
    let n = 0;
    const realAjax = $.ajax;
    $.ajax = function (opts) { n++; realAjax(opts); };
    const h = loadHelper({ $, clock });

    let result = null;
    h.cvocThrottledAjax({ url: 'u/503', success: (d) => { result = d; }, error: () => {} });
    clock.drain();
    assert(result && result.name === 'Linus', '503 recovered after retry');
    assert(n === 2, '503 made 2 attempts, got ' + n);
}

function testMaxRetriesExhausted() {
    console.log('test: persistent 429 exhausts maxRetries then fails to fallback');
    const clock = makeClock();
    const ct = makeConcurrencyTracker();
    // Always 429 with a short Retry-After.
    const $ = makeJQuery(clock, { 'u/429x': [{ status: 429, retryAfter: 1 }] }, ct);
    let n = 0;
    const realAjax = $.ajax;
    $.ajax = function (opts) { n++; realAjax(opts); };
    const h = loadHelper({ $, clock });

    let errStatus = null;
    h.cvocThrottledAjax({
        url: 'u/429x',
        maxRetries: 3,
        success: () => {},
        error: (jqXHR) => { errStatus = jqXHR.status; },
    });
    clock.drain();
    assert(errStatus === 429, 'fell back to error after exhausting retries');
    // 1 initial + 3 retries = 4 attempts.
    assert(n === 4, 'made 1 + maxRetries(3) = 4 attempts, got ' + n);
}

function testConcurrencyCap() {
    console.log('test: concurrency never exceeds cap (4) under a 24-request burst');
    const clock = makeClock();
    const ct = makeConcurrencyTracker();
    const scripts = {};
    for (let i = 0; i < 24; i++) scripts['u/' + i] = [{ ok: { i } }];
    const $ = makeJQuery(clock, scripts, ct);
    const h = loadHelper({ $, clock });

    let completed = 0;
    for (let i = 0; i < 24; i++) {
        h.cvocThrottledAjax({
            url: 'u/' + i,
            success: () => { completed++; },
            error: () => {},
        });
    }
    clock.drain();
    assert(ct.peak() <= 4, 'peak concurrency <= 4, was ' + ct.peak());
    assert(ct.peak() === 4, 'peak concurrency actually reached the cap (4), was ' + ct.peak());
    assert(completed === 24, 'all 24 requests completed, got ' + completed);
    assert(ct.inFlight() === 0, 'no in-flight requests left (queue drained)');
}

function testQueueDrainsNoLeak() {
    console.log('test: queue drains with a mix of success/404/429 (no slot leak)');
    const clock = makeClock();
    const ct = makeConcurrencyTracker();
    const scripts = {};
    for (let i = 0; i < 30; i++) {
        if (i % 3 === 0) scripts['m/' + i] = [{ status: 404 }];
        else if (i % 3 === 1) scripts['m/' + i] = [{ status: 429, retryAfter: 1 }, { ok: { i } }];
        else scripts['m/' + i] = [{ ok: { i } }];
    }
    const $ = makeJQuery(clock, scripts, ct);
    const h = loadHelper({ $, clock });

    let terminal = 0;
    for (let i = 0; i < 30; i++) {
        h.cvocThrottledAjax({
            url: 'm/' + i,
            success: () => { terminal++; },
            error: () => { terminal++; },
        });
    }
    clock.drain();
    assert(ct.peak() <= 4, 'mixed burst still capped at 4, was ' + ct.peak());
    assert(terminal === 30, 'every request reached a terminal state, got ' + terminal);
    assert(ct.inFlight() === 0, 'no leaked slots after mixed burst');
    assert(clock.pending() === 0, 'no timers left pending');
}

function testSettleDeadline() {
    console.log('test: global settle deadline bounds a hostile Retry-After');
    const clock = makeClock();
    const ct = makeConcurrencyTracker();
    // Server keeps asking for a 3600s wait; deadline must stop retrying well before that.
    const $ = makeJQuery(clock, { 'u/hostile': [{ status: 503, retryAfter: 3600 }] }, ct);
    let n = 0;
    const realAjax = $.ajax;
    $.ajax = function (opts) { n++; realAjax(opts); };
    const h = loadHelper({ $, clock });

    let errored = false;
    const startNow = clock.now();
    h.cvocThrottledAjax({
        url: 'u/hostile',
        settleDeadlineMs: 30000,
        backoffMaxMs: 8000, // Retry-After clamped to this
        success: () => {},
        error: () => { errored = true; },
    });
    clock.drain();
    const elapsed = clock.now() - startNow;
    assert(errored, 'hostile Retry-After eventually fell back to error');
    // With backoff clamped to 8s and a 30s deadline, it cannot run forever.
    assert(elapsed <= 30000 + 8000, 'settled within deadline+one-clamped-wait, elapsed ' + elapsed + 'ms');
    assert(n >= 2, 'made at least one retry before giving up, attempts ' + n);
}

// ---------------------------------------------------------------------------

function run() {
    console.log('cvocThrottledAjax unit tests (stubbed $.ajax, fake timers)\n');
    const tests = [
        testHappyPath,
        testNotFoundNoRetry,
        testStatus0NoRetry,
        testRetryAfterRecovers,
        test503Retried,
        testMaxRetriesExhausted,
        testConcurrencyCap,
        testQueueDrainsNoLeak,
        testSettleDeadline,
    ];
    for (const t of tests) {
        try {
            t();
        } catch (e) {
            failed++;
            failures.push(t.name + ' threw: ' + (e && e.stack || e));
            console.error('  THREW: ' + (e && e.message));
        }
    }
    console.log('\n----------------------------------------');
    console.log('passed: ' + passed + '  failed: ' + failed);
    if (failed > 0) {
        console.log('\nFailures:');
        failures.forEach(f => console.log('  - ' + f));
        process.exit(1);
    }
    console.log('OK');
}

run();
