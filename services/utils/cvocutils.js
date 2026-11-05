//Common Methods - used in more than one script

// Put the text in a result that matches the term in a span with class
// select2-rendered__match that can be styled (e.g. bold)
function markMatch2(text, term) {
    // Find where the match is
    var match = text.toUpperCase().indexOf(term.toUpperCase());
    var $result = $('<span></span>');
    // If there is no match, move on
    if (match < 0) {
        return $result.text(text);
    }

    // Put in whatever text is before the match
    $result.text(text.substring(0, match));

    // Mark the match
    var $match = $('<span class="select2-rendered__match"></span>');
    $match.text(text.substring(match, match + term.length));

    // Append the matching text
    $result.append($match);

    // Put in whatever is after the match
    $result.append(text.substring(match + term.length));

    return $result;
}

function storeValue(prefix, id, value) {
    try {
        if(localStorage.getItem(prefix + id)==null) {
            // Store the most recent 1000 values across all scripts
            //ToDo: Use IndexedDB to manage storage for each script separately and avoid impacting other tools using localStorage
            if (localStorage.length > 1000) {
                localStorage.removeItem(localStorage.key(0));
            }
            localStorage.setItem(prefix + id, value);
        }
    } catch (e) {
        console.log("Problem using localStorage: " + e);
    }
}

function getValue(prefix, id) {
    try {
        let altNames='';
        let name = localStorage.getItem(prefix + id);
        if(name !== null) {
            let pos = name.indexOf('#');
            if(pos > 0) {
                altNames=name.substring(pos+1).split(',');
                name=name.substring(0, pos);
            }
        }
        return {name, altNames};
    } catch (e) {
        console.log("Problem getting value from localStorage: " + e);
    }
}

/**
 * Injects common CSS styles for CVOC scripts, specifically for Select2 search results.
 */
function injectCvocStyles() {
    if ($('#cvoc-styles').length === 0) {
        $('<style id="cvoc-styles">')
            .prop('type', 'text/css')
            .html(`
                .cvoc-extra-info {
                    font-size: 0.85em;
                    color: #777;
                    margin-left: 0px;
                }
                .select2-results__option--highlighted .cvoc-extra-info,
                .select2-highlighted .cvoc-extra-info {
                    color: #fff !important;
                }
            `)
            .appendTo('head');
    }
}

/**
 * Bounded-concurrency, retrying GET helper shared by CVOC scripts.
 *
 * Problem (gdcc/dataverse-external-vocab-support, IQSS/dataverse#12392):
 * scripts like people.js fire one $.ajax per value. On a dataset with many
 * values (e.g. 50-100+ authors) that becomes a burst of simultaneous requests
 * to a public API (ORCID). The API rate limits the burst (HTTP 429/503) and the
 * failed requests degrade to raw-text display, producing inconsistent output.
 *
 * cvocThrottledAjax caps the number of in-flight requests and retries the two
 * statuses that are actually recoverable - 429 (Too Many Requests) and 503
 * (Service Unavailable) - using the server's Retry-After header when present,
 * otherwise exponential backoff with jitter. A global settle deadline ensures
 * every request reaches a terminal state within a bounded time so the page does
 * not hang waiting on a hostile Retry-After.
 *
 * Deliberately NOT retried: status 0 (CORS rejection / aborted navigation /
 * offline) and 4xx such as 404 - none of these recover by retrying, and
 * retrying them would turn a fast fallback into a slow one.
 *
 * Usage:
 *   cvocThrottledAjax({
 *       url: retrievalUrl,
 *       headers: { 'Accept': 'application/json' }, // optional, merged with default
 *       success: function(data, status) { ... },   // same contract as $.ajax
 *       error: function(jqXHR, textStatus, errorThrown) { ... }
 *   });
 *
 * Tuning (optional): callers may pass maxConcurrent / maxRetries / etc. on the
 * options object; otherwise the defaults below apply. Defaults are shared across
 * all CVOC scripts loaded on the page via the single cvocRequestQueue.
 */
var cvocThrottledAjax = (function() {
    // Defaults. A small concurrency cap is the primary rate limiter; retry is the
    // recovery mechanism for the occasional 429/503 that still slips through.
    var DEFAULT_MAX_CONCURRENT = 4;
    var DEFAULT_MAX_RETRIES = 3;
    var DEFAULT_BACKOFF_BASE_MS = 500;
    var DEFAULT_BACKOFF_MAX_MS = 8000;
    // After this long (from first enqueue of a drained-empty queue), stop retrying
    // and let remaining requests fail fast to their stable fallback.
    var DEFAULT_SETTLE_DEADLINE_MS = 30000;

    var queue = {
        pending: [],
        active: 0,
        maxConcurrent: DEFAULT_MAX_CONCURRENT,

        enqueue: function(task) {
            this.pending.push(task);
            this.pump();
        },

        pump: function() {
            while (this.active < this.maxConcurrent && this.pending.length > 0) {
                var task = this.pending.shift();
                this.active++;
                var self = this;
                var released = false;
                // One idempotent release per task frees exactly one slot.
                var done = function() {
                    if (released) {
                        return;
                    }
                    released = true;
                    self.active--;
                    self.pump();
                };
                try {
                    task(done);
                } catch (e) {
                    console.error("cvocThrottledAjax: queued task threw synchronously", e);
                    done();
                }
            }
        }
    };

    function parseRetryAfter(jqXHR, maxMs) {
        // SECURITY: Retry-After is attacker-influenced input. It is sent by whatever
        // server answers the request - the public API or, if configured, an operator's
        // data-cvoc-service-url proxy (possibly a third party). A hostile value could
        // try to stall the page. Every return path below is clamped to maxMs, and the
        // caller additionally enforces a global settle deadline, so the worst case is a
        // bounded delay rather than a hang. The strict ^\d+$ test also prevents
        // mis-parsing malformed values.
        var header = (jqXHR && jqXHR.getResponseHeader) ? jqXHR.getResponseHeader('Retry-After') : null;
        if (!header) {
            return null;
        }
        // Delta-seconds form must be all digits (avoid mis-parsing "120abc" as 120).
        if (/^\d+$/.test(header.trim())) {
            var seconds = parseInt(header, 10);
            return Math.min(seconds * 1000, maxMs);
        }
        // HTTP-date form.
        var dateMs = Date.parse(header);
        if (!isNaN(dateMs)) {
            return Math.min(Math.max(dateMs - Date.now(), 0), maxMs);
        }
        return null;
    }

    return function cvocThrottledAjax(options) {
        var maxConcurrent = options.maxConcurrent || DEFAULT_MAX_CONCURRENT;
        var maxRetries = (options.maxRetries != null) ? options.maxRetries : DEFAULT_MAX_RETRIES;
        var backoffBase = options.backoffBaseMs || DEFAULT_BACKOFF_BASE_MS;
        var backoffMax = options.backoffMaxMs || DEFAULT_BACKOFF_MAX_MS;
        var settleDeadlineMs = options.settleDeadlineMs || DEFAULT_SETTLE_DEADLINE_MS;

        // Allow the first caller to raise the shared concurrency cap if desired.
        if (maxConcurrent > queue.maxConcurrent) {
            queue.maxConcurrent = maxConcurrent;
        }

        queue.enqueue(function(done) {
            var attempt = 0;
            var deadline = Date.now() + settleDeadlineMs;

            function isRetryable(jqXHR) {
                // Only statuses that recover on retry. Status 0 (CORS/abort/offline)
                // and 4xx (incl. 404) are terminal on purpose.
                return jqXHR && (jqXHR.status === 429 || jqXHR.status === 503);
            }

            function computeDelay(jqXHR) {
                var retryAfter = parseRetryAfter(jqXHR, backoffMax);
                if (retryAfter != null) {
                    // Never 0 - a 0 would cause an immediate hammering retry.
                    return Math.max(retryAfter, backoffBase);
                }
                var backoff = backoffBase * Math.pow(2, attempt);
                var jitter = Math.floor(Math.random() * backoffBase);
                return Math.min(backoff + jitter, backoffMax);
            }

            function attemptRequest() {
                $.ajax({
                    type: "GET",
                    url: options.url,
                    dataType: options.dataType || 'json',
                    headers: $.extend({ 'Accept': 'application/json' }, options.headers || {}),
                    success: function(data, status) {
                        try {
                            if (options.success) {
                                options.success(data, status);
                            }
                        } finally {
                            done();
                        }
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        var delay = isRetryable(jqXHR) ? computeDelay(jqXHR) : null;
                        if (delay != null && attempt < maxRetries && (Date.now() + delay) < deadline) {
                            attempt++;
                            setTimeout(attemptRequest, delay);
                            return;
                        }
                        try {
                            if (options.error) {
                                options.error(jqXHR, textStatus, errorThrown);
                            }
                        } finally {
                            done();
                        }
                    }
                });
            }

            attemptRequest();
        });
    };
})();
