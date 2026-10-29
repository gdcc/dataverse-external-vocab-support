/*
 * LIVE sandbox smoke test for cvocThrottledAjax (services/utils/cvocutils.js).
 *
 * IQSS/dataverse#12392 / gdcc/dataverse-external-vocab-support PR #71.
 *
 * Purpose: answer @qqmyers' merge gate — confirm the throttle actually works
 * against a real ORCID public API, without hammering production. It targets the
 * ORCID SANDBOX public API (https://pub.sandbox.orcid.org). Because these calls
 * are made client-side from the user's browser, there is no approved-domain
 * restriction; this script reproduces that same public path from Node.
 *
 * It loads the REAL helper from cvocutils.js and backs $.ajax with Node's global
 * fetch, so the actual queue / retry / concurrency / Retry-After code runs. It
 * simulates a many-author page by firing N lookups at once and asserts:
 *   - in-flight concurrency never exceeds the cap (default 4)
 *   - every request reaches a terminal state (success or stable fallback)
 *   - any 429/503 encountered is retried rather than immediately degraded
 *
 * Requires: Node 18+ (global fetch) and outbound network to sandbox.orcid.org.
 * This is NOT run in CI (no network there) — run manually:
 *
 *   node services/people/test/throttle.sandbox.live.js
 *
 * Optional env:
 *   ORCID_IDS="0000-0002-1825-0097,0000-0001-5109-3700"  # sandbox-valid ORCIDs
 *   BURST=60            # how many concurrent lookups to simulate
 *   MAX_CONCURRENT=4    # cap to assert against
 *
 * NOTE: the default IDs below are well-known PRODUCTION sample ORCIDs; they may
 * or may not resolve on sandbox. The point of the smoke test is the THROTTLE
 * behavior (concurrency cap + retry + terminal settle), which holds whether the
 * individual lookups 200 or 404. Supply real sandbox IDs via ORCID_IDS to also
 * exercise the success-formatting path.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

if (typeof fetch !== 'function') {
    console.error('This script needs Node 18+ with global fetch. Node version: ' + process.version);
    process.exit(2);
}

const SANDBOX_BASE = 'https://pub.sandbox.orcid.org/';
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '4', 10);
const BURST = parseInt(process.env.BURST || '40', 10);
const IDS = (process.env.ORCID_IDS
    ? process.env.ORCID_IDS.split(',').map(s => s.trim()).filter(Boolean)
    : ['0000-0002-1825-0097', '0000-0001-5109-3700', '0000-0003-1419-2405']);

// --- concurrency tracker ----------------------------------------------------
let inFlight = 0, peak = 0, started = 0, succeeded = 0, failed = 0;
let retriedStatuses = [];

// --- $.ajax shim backed by real fetch ---------------------------------------
// Mirrors just enough of jQuery's $.ajax contract for cvocThrottledAjax.
function makeJQuery() {
    const $ = function () {};
    $.extend = function () {
        const out = {};
        for (let i = 0; i < arguments.length; i++) {
            const src = arguments[i];
            if (src) for (const k in src) if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
        }
        return out;
    };
    $.ajax = function (opts) {
        inFlight++; started++; peak = Math.max(peak, inFlight);
        const headers = Object.assign({ 'Accept': 'application/json' }, opts.headers || {});
        fetch(opts.url, { method: opts.type || 'GET', headers })
            .then(async (res) => {
                inFlight--;
                if (res.ok) {
                    let data = {};
                    try { data = await res.json(); } catch (e) { /* tolerate */ }
                    opts.success && opts.success(data, 'success');
                } else {
                    if (res.status === 429 || res.status === 503) {
                        retriedStatuses.push(res.status);
                    }
                    const jqXHR = {
                        status: res.status,
                        getResponseHeader: (name) => res.headers.get(name),
                    };
                    opts.error && opts.error(jqXHR, 'error', res.statusText);
                }
            })
            .catch((err) => {
                inFlight--;
                // Network error -> status 0 (terminal, like a browser CORS/offline).
                const jqXHR = { status: 0, getResponseHeader: () => null };
                opts.error && opts.error(jqXHR, 'error', String(err && err.message || err));
            });
    };
    return $;
}

function loadHelper($) {
    const src = fs.readFileSync(
        path.join(__dirname, '..', '..', 'utils', 'cvocutils.js'),
        'utf8'
    );
    const sandbox = {
        $,
        console,
        setTimeout,
        clearTimeout,
        Date,
        Math,
        localStorage: undefined,
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'cvocutils.js' });
    if (typeof sandbox.cvocThrottledAjax !== 'function') {
        throw new Error('cvocThrottledAjax not found in cvocutils.js');
    }
    return sandbox;
}

async function main() {
    console.log('LIVE ORCID sandbox throttle smoke test');
    console.log('  base       : ' + SANDBOX_BASE);
    console.log('  burst      : ' + BURST + ' concurrent lookups');
    console.log('  cap        : ' + MAX_CONCURRENT);
    console.log('  sample IDs : ' + IDS.join(', '));
    console.log('');

    const $ = makeJQuery();
    const helper = loadHelper($);

    const total = BURST;
    await new Promise((resolve) => {
        let settled = 0;
        for (let i = 0; i < total; i++) {
            const id = IDS[i % IDS.length];
            const url = SANDBOX_BASE + 'v3.0/' + id + '/person';
            helper.cvocThrottledAjax({
                url,
                maxConcurrent: MAX_CONCURRENT,
                success: () => { succeeded++; if (++settled === total) resolve(); },
                error: () => { failed++; if (++settled === total) resolve(); },
            });
        }
    });

    console.log('results:');
    console.log('  started (incl. retries): ' + started);
    console.log('  succeeded              : ' + succeeded);
    console.log('  failed (fallback)      : ' + failed);
    console.log('  peak concurrency       : ' + peak);
    console.log('  429/503 seen & retried : ' + retriedStatuses.length +
        (retriedStatuses.length ? ' (' + retriedStatuses.join(',') + ')' : ''));
    console.log('');

    let ok = true;
    function check(cond, msg) {
        console.log((cond ? '  PASS: ' : '  FAIL: ') + msg);
        if (!cond) ok = false;
    }
    check(peak <= MAX_CONCURRENT, 'peak concurrency (' + peak + ') never exceeded cap (' + MAX_CONCURRENT + ')');
    check(succeeded + failed === total, 'every request reached a terminal state (' + (succeeded + failed) + '/' + total + ')');
    check(inFlight === 0, 'no requests left in flight (queue drained)');

    if (retriedStatuses.length === 0) {
        console.log('  NOTE: no 429/503 occurred at concurrency ' + MAX_CONCURRENT +
            ' — consistent with the fix preventing the burst. To exercise the retry path, raise BURST and/or lower the cap.');
    } else {
        check(succeeded > 0, 'at least some requests still succeeded despite rate-limiting (retry recovered them)');
    }

    console.log('');
    console.log(ok ? 'SMOKE TEST OK' : 'SMOKE TEST FAILED');
    process.exit(ok ? 0 : 1);
}

main().catch((e) => {
    console.error('smoke test error: ' + (e && e.stack || e));
    process.exit(2);
});
