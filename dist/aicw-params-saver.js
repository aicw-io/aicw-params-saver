(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.ParamsSaver = {}));
})(this, (function (exports) { 'use strict';

    const DEFAULT_CONFIG = {
        debug: false,
        // Parameters - common tracking params (startsWith matching)
        params: ['utm_', 'gclid', 'fbclid', 'msclkid', 'ref'],
        // Storage - localStorage only (GDPR-compliant, no cookies by default)
        storage: 'localStorage',
        ttl: 30, // 30 days
        // Link decoration (first domain also used as cookie domain when cookies enabled)
        allowedDomains: [], // Current domain only
        excludePatterns: [
            '*.exe',
            '*.msi',
            '*.dmg',
            '*.pkg',
            '*.zip',
            '*.rar',
            '*.7z',
            '*.tar*',
            '*.pdf',
            'mailto:*',
            'tel:*',
            'javascript:*',
            '*logout*',
            '*signout*',
            '*unsubscribe*',
        ],
        // Attribution - pure first-touch by default
        mergeParams: false,
        onCapture: undefined,
    };
    // Hardcoded constants
    const STORAGE_PREFIX = 'pz_';
    const EXCLUDE_SELECTOR = '[data-pz-ignore], .pz-ignore';

    /**
     * Unified storage adapter with fallback support
     */
    class Storage {
        constructor(config, prefix, allowedDomains, debug) {
            this.backends = this.parseStorageConfig(config);
            this.prefix = prefix;
            // Use first allowedDomain as cookie domain (for cross-subdomain cookies)
            this.cookieDomain = allowedDomains[0] || '';
            this.debugEnabled = debug;
            this.log(`Initialized with backends: ${this.backends.join(' -> ')}`);
        }
        /**
         * Parse storage config into ordered array of backends
         * Supports: 'localStorage', 'cookie|localStorage', ['cookie', 'localStorage']
         */
        parseStorageConfig(config) {
            if (Array.isArray(config)) {
                return config;
            }
            if (typeof config === 'string' && config.includes('|')) {
                return config.split('|').map((s) => s.trim());
            }
            return [config];
        }
        log(msg, ...args) {
            if (this.debugEnabled)
                console.log(`[ParamsSaver:Storage] ${msg}`, ...args);
        }
        key(name) {
            return `${this.prefix}${name}`;
        }
        // ═══════════════════════════════════════════════════════════════
        // BACKEND-SPECIFIC OPERATIONS
        // ═══════════════════════════════════════════════════════════════
        isBackendAvailable(backend) {
            try {
                switch (backend) {
                    case 'localStorage':
                        localStorage.setItem('__pz_test__', '1');
                        localStorage.removeItem('__pz_test__');
                        return true;
                    case 'sessionStorage':
                        sessionStorage.setItem('__pz_test__', '1');
                        sessionStorage.removeItem('__pz_test__');
                        return true;
                    case 'cookie':
                        document.cookie = '__pz_test__=1';
                        const hasCookie = document.cookie.includes('__pz_test__');
                        document.cookie = '__pz_test__=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                        return hasCookie;
                }
            }
            catch (_a) {
                return false;
            }
            return false;
        }
        setToBackend(backend, key, item) {
            const value = JSON.stringify(item);
            try {
                switch (backend) {
                    case 'localStorage':
                        localStorage.setItem(key, value);
                        return true;
                    case 'sessionStorage':
                        sessionStorage.setItem(key, value);
                        return true;
                    case 'cookie':
                        if (value.length > 4000) {
                            this.log('Data too large for cookie');
                            return false;
                        }
                        let cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
                        if (item.expiresAt > 0) {
                            cookie += `; expires=${new Date(item.expiresAt).toUTCString()}`;
                        }
                        if (this.cookieDomain) {
                            cookie += `; domain=${this.cookieDomain}`;
                        }
                        document.cookie = cookie;
                        return true;
                }
            }
            catch (e) {
                this.log(`Failed to write to ${backend}:`, e);
                return false;
            }
            return false;
        }
        getFromBackend(backend, key) {
            try {
                let raw = null;
                switch (backend) {
                    case 'localStorage':
                        raw = localStorage.getItem(key);
                        break;
                    case 'sessionStorage':
                        raw = sessionStorage.getItem(key);
                        break;
                    case 'cookie':
                        const match = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(key)}=([^;]*)`));
                        raw = match ? decodeURIComponent(match[1]) : null;
                        break;
                }
                if (!raw)
                    return null;
                const item = JSON.parse(raw);
                // Check expiration
                if (item.expiresAt > 0 && Date.now() > item.expiresAt) {
                    this.log(`Data expired in ${backend}`);
                    this.removeFromBackend(backend, key);
                    return null;
                }
                return item;
            }
            catch (e) {
                this.log(`Failed to read from ${backend}:`, e);
                return null;
            }
        }
        removeFromBackend(backend, key) {
            try {
                switch (backend) {
                    case 'localStorage':
                        localStorage.removeItem(key);
                        break;
                    case 'sessionStorage':
                        sessionStorage.removeItem(key);
                        break;
                    case 'cookie':
                        let cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
                        if (this.cookieDomain) {
                            cookie += `; domain=${this.cookieDomain}`;
                        }
                        document.cookie = cookie;
                        break;
                }
            }
            catch (e) {
                this.log(`Failed to remove from ${backend}:`, e);
            }
        }
        // ═══════════════════════════════════════════════════════════════
        // PUBLIC API
        // ═══════════════════════════════════════════════════════════════
        /**
         * Store data - writes to FIRST available backend
         */
        set(name, data, ttlDays) {
            const key = this.key(name);
            const item = {
                data,
                expiresAt: ttlDays > 0 ? Date.now() + ttlDays * 86400000 : 0,
            };
            for (const backend of this.backends) {
                if (this.isBackendAvailable(backend)) {
                    if (this.setToBackend(backend, key, item)) {
                        this.log(`Stored '${name}' in ${backend}`);
                        return true;
                    }
                }
            }
            this.log(`Failed to store '${name}' - no available backend`);
            return false;
        }
        /**
         * Retrieve data - returns from FIRST backend that has it
         */
        get(name) {
            const key = this.key(name);
            for (const backend of this.backends) {
                if (!this.isBackendAvailable(backend))
                    continue;
                const item = this.getFromBackend(backend, key);
                if (item) {
                    this.log(`Retrieved '${name}' from ${backend}`);
                    return item.data;
                }
            }
            return null;
        }
        /**
         * Remove data from ALL backends
         */
        remove(name) {
            const key = this.key(name);
            for (const backend of this.backends) {
                this.removeFromBackend(backend, key);
            }
            this.log(`Removed '${name}' from all backends`);
        }
        /**
         * Clear all stored data from ALL backends
         */
        clearAll() {
            // localStorage
            try {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key === null || key === void 0 ? void 0 : key.startsWith(this.prefix)) {
                        localStorage.removeItem(key);
                    }
                }
            }
            catch (_a) {
                // Ignore errors
            }
            // sessionStorage
            try {
                for (let i = sessionStorage.length - 1; i >= 0; i--) {
                    const key = sessionStorage.key(i);
                    if (key === null || key === void 0 ? void 0 : key.startsWith(this.prefix)) {
                        sessionStorage.removeItem(key);
                    }
                }
            }
            catch (_b) {
                // Ignore errors
            }
            // cookies
            try {
                document.cookie.split(';').forEach((c) => {
                    const name = c.split('=')[0].trim();
                    if (decodeURIComponent(name).startsWith(this.prefix)) {
                        this.removeFromBackend('cookie', decodeURIComponent(name));
                    }
                });
            }
            catch (_c) {
                // Ignore errors
            }
            this.log('Cleared all data');
        }
    }

    /**
     * Simple glob pattern matching
     * Supports: * (any chars), ? (single char)
     * @example matchPattern('*.exe', 'file.exe') => true
     * @example matchPattern('*logout*', '/user/logout?redirect=home') => true
     */
    function matchPattern(pattern, value) {
        // Convert glob to regex
        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
            .replace(/\*/g, '.*') // * -> .*
            .replace(/\?/g, '.'); // ? -> .
        const regex = new RegExp(`^${escaped}$`, 'i');
        return regex.test(value);
    }
    /**
     * Check if URL matches any exclusion pattern
     */
    function matchesAnyPattern(url, patterns) {
        return patterns.some((pattern) => matchPattern(pattern, url));
    }
    /**
     * Check if hostname matches domain pattern
     * @example matchDomain('example.com', 'example.com') => true
     * @example matchDomain('*.example.com', 'sub.example.com') => true
     * @example matchDomain('*.example.com', 'example.com') => false
     */
    function matchDomain(pattern, hostname) {
        const p = pattern.toLowerCase();
        const h = hostname.toLowerCase();
        if (p.startsWith('*.')) {
            const base = p.slice(2);
            return h === base || h.endsWith('.' + base);
        }
        return h === p;
    }
    /**
     * Parse URL safely
     */
    function parseUrl(url, base) {
        try {
            return new URL(url, base || (typeof window !== 'undefined' ? window.location.origin : undefined));
        }
        catch (_a) {
            return null;
        }
    }
    /**
     * Get query params as object
     */
    function getQueryParams(search) {
        const params = {};
        new URLSearchParams(search).forEach((v, k) => {
            params[k] = v;
        });
        return params;
    }
    /**
     * Debounce function
     */
    function debounce(fn, ms) {
        let timer;
        return ((...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        });
    }
    /**
     * Extract root domain from hostname
     * @example getRootDomain('app.aicw.io') => 'aicw.io'
     * @example getRootDomain('sub.example.co.uk') => 'example.co.uk'
     */
    function getRootDomain(hostname) {
        // Handle localhost and IP addresses
        if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            return hostname;
        }
        const parts = hostname.split('.');
        // Single part (e.g., 'localhost') - return as-is
        if (parts.length <= 1) {
            return hostname;
        }
        // Handle known 2-part TLDs (e.g., .co.uk, .com.au)
        const knownDoubleTlds = ['co.uk', 'com.au', 'co.nz', 'com.br', 'co.jp', 'org.uk', 'net.au'];
        const lastTwo = parts.slice(-2).join('.');
        if (knownDoubleTlds.includes(lastTwo) && parts.length > 2) {
            return parts.slice(-3).join('.');
        }
        // Standard: last 2 parts (e.g., aicw.io, example.com)
        return parts.slice(-2).join('.');
    }

    class ParamCapture {
        constructor(config) {
            this.config = config;
        }
        log(msg, ...args) {
            if (this.config.debug)
                console.log(`[ParamsSaver:Capture] ${msg}`, ...args);
        }
        /**
         * Check if a param name should be captured (startsWith matching)
         */
        shouldCapture(name) {
            return this.config.params.some((pattern) => name.startsWith(pattern));
        }
        /**
         * Capture params from current URL
         */
        capture() {
            const allParams = getQueryParams(window.location.search);
            const captured = {};
            Object.entries(allParams).forEach(([key, value]) => {
                // Only capture non-empty values
                if (value && this.shouldCapture(key)) {
                    captured[key] = value;
                }
            });
            if (Object.keys(captured).length === 0) {
                this.log('No matching params in URL');
                return null;
            }
            const data = {
                params: captured,
                timestamp: Date.now(),
            };
            this.log('Captured:', captured);
            return data;
        }
        /**
         * Check if current URL has any capturable params
         */
        hasParams() {
            const allParams = getQueryParams(window.location.search);
            return Object.keys(allParams).some((k) => this.shouldCapture(k));
        }
    }

    class LinkDecorator {
        constructor(config) {
            this.decorated = new WeakSet();
            this.config = config;
        }
        log(msg, ...args) {
            if (this.config.debug)
                console.log(`[ParamsSaver:Decorator] ${msg}`, ...args);
        }
        /**
         * Decorate all links on page
         * @returns Number of links decorated
         */
        decorateAll(params) {
            if (Object.keys(params).length === 0)
                return 0;
            const links = document.querySelectorAll('a[href]');
            let count = 0;
            links.forEach((link) => {
                if (this.decorateLink(link, params))
                    count++;
            });
            this.log(`Decorated ${count} links`);
            return count;
        }
        /**
         * Decorate a single link
         */
        decorateLink(link, params) {
            // Skip if already processed
            if (this.decorated.has(link))
                return false;
            const href = link.getAttribute('href');
            if (!href)
                return false;
            // Skip special protocols (non-http links that shouldn't have params appended)
            if (/^(mailto:|tel:|javascript:|data:|blob:|file:|ftp:|sms:|whatsapp:|skype:|facetime:|#)/.test(href)) {
                return false;
            }
            // Check exclusion selector
            if (link.matches(EXCLUDE_SELECTOR)) {
                this.log('Link excluded by selector:', href);
                return false;
            }
            // Check exclusion patterns
            if (matchesAnyPattern(href, this.config.excludePatterns)) {
                this.log('Link excluded by pattern:', href);
                return false;
            }
            // Parse URL
            const url = parseUrl(href);
            if (!url)
                return false;
            // Check domain allowlist
            if (!this.isDomainAllowed(url.hostname)) {
                this.log('Domain not allowed:', url.hostname);
                return false;
            }
            // Add params to URL (skip if param already exists)
            const newHref = this.addParamsToUrl(url, params);
            if (newHref !== href) {
                link.setAttribute('href', newHref);
                this.decorated.add(link);
                this.log('Decorated:', href, '->', newHref);
                return true;
            }
            return false;
        }
        /**
         * Check if domain is in allowlist
         */
        isDomainAllowed(hostname) {
            const patterns = this.config.allowedDomains;
            // If no patterns, allow current domain + all subdomains of root domain
            if (patterns.length === 0) {
                const currentHost = window.location.hostname;
                const rootDomain = getRootDomain(currentHost);
                const targetLower = hostname.toLowerCase();
                const rootLower = rootDomain.toLowerCase();
                // Allow: exact match, root domain, or any subdomain of root
                return (targetLower === currentHost.toLowerCase() ||
                    targetLower === rootLower ||
                    targetLower.endsWith('.' + rootLower));
            }
            return patterns.some((p) => matchDomain(p, hostname));
        }
        /**
         * Add params to URL - skip if param already exists
         */
        addParamsToUrl(url, params) {
            Object.entries(params).forEach(([key, value]) => {
                // Only add if doesn't exist
                if (url.searchParams.get(key) === null) {
                    url.searchParams.set(key, value);
                }
            });
            return url.toString();
        }
        /**
         * Reset decorated links tracking
         */
        reset() {
            this.decorated = new WeakSet();
        }
    }

    class DynamicObserver {
        constructor(config, decorator, paramsGetter) {
            this.observer = null;
            this.originalPushState = null;
            this.originalReplaceState = null;
            this.popstateHandler = null;
            this.config = config;
            this.decorator = decorator;
            this.paramsGetter = paramsGetter;
        }
        log(msg, ...args) {
            if (this.config.debug)
                console.log(`[ParamsSaver:Observer] ${msg}`, ...args);
        }
        /**
         * Start observing (both MutationObserver and History API)
         */
        start() {
            this.startMutationObserver();
            this.hookHistoryAPI();
        }
        /**
         * Stop observing
         */
        stop() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            this.unhookHistoryAPI();
        }
        startMutationObserver() {
            if (typeof MutationObserver === 'undefined') {
                this.log('MutationObserver not available');
                return;
            }
            const handleMutations = debounce(() => {
                this.decorator.decorateAll(this.paramsGetter());
            }, 100);
            this.observer = new MutationObserver((mutations) => {
                // Only process if links were added
                const hasNewLinks = mutations.some((m) => Array.from(m.addedNodes).some((n) => {
                    var _a, _b;
                    return n.nodeType === Node.ELEMENT_NODE &&
                        (n.tagName === 'A' || ((_b = (_a = n).querySelector) === null || _b === void 0 ? void 0 : _b.call(_a, 'a')));
                }));
                if (hasNewLinks)
                    handleMutations();
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
            this.log('MutationObserver started');
        }
        hookHistoryAPI() {
            const onNavigation = debounce(() => {
                this.log('SPA navigation detected');
                this.decorator.reset();
                this.decorator.decorateAll(this.paramsGetter());
            }, 50);
            this.originalPushState = history.pushState;
            history.pushState = (...args) => {
                this.originalPushState.apply(history, args);
                onNavigation();
            };
            this.originalReplaceState = history.replaceState;
            history.replaceState = (...args) => {
                this.originalReplaceState.apply(history, args);
                onNavigation();
            };
            this.popstateHandler = onNavigation;
            window.addEventListener('popstate', this.popstateHandler);
            this.log('History API hooked');
        }
        unhookHistoryAPI() {
            if (this.originalPushState) {
                history.pushState = this.originalPushState;
                this.originalPushState = null;
            }
            if (this.originalReplaceState) {
                history.replaceState = this.originalReplaceState;
                this.originalReplaceState = null;
            }
            if (this.popstateHandler) {
                window.removeEventListener('popstate', this.popstateHandler);
                this.popstateHandler = null;
            }
        }
    }

    const STORAGE_KEY = 'params';
    class ParamsSaver {
        constructor() {
            this.config = { ...DEFAULT_CONFIG };
            this.storage = null;
            this.paramCapture = null;
            this.decorator = null;
            this.observer = null;
        }
        log(msg, ...args) {
            if (this.config.debug)
                console.log(`[ParamsSaver] ${msg}`, ...args);
        }
        init(userConfig) {
            try {
                this.config = { ...DEFAULT_CONFIG, ...userConfig };
                this.log('Initializing with config:', this.config);
                // Initialize components
                this.storage = new Storage(this.config.storage, STORAGE_PREFIX, this.config.allowedDomains, this.config.debug);
                this.paramCapture = new ParamCapture(this.config);
                this.decorator = new LinkDecorator(this.config);
                this.observer = new DynamicObserver(this.config, this.decorator, () => this.getParams());
                // Process current page
                this.processPage();
                // Start dynamic observation
                this.observer.start();
                this.log('Initialized');
            }
            catch (e) {
                this.log('Error in init:', e);
            }
        }
        processPage() {
            var _a;
            // 1. Capture params from URL
            this.captureInternal();
            // 2. Decorate links with stored params
            (_a = this.decorator) === null || _a === void 0 ? void 0 : _a.decorateAll(this.getParams());
        }
        captureInternal() {
            var _a, _b;
            if (!this.paramCapture || !this.storage)
                return null;
            const newData = this.paramCapture.capture();
            if (!newData)
                return null;
            const existing = this.storage.get(STORAGE_KEY);
            let isFirstTouch = !existing;
            let finalData;
            if (!existing) {
                // First visit - store new params
                finalData = newData;
            }
            else if (this.config.mergeParams) {
                // Merge mode - append unique values
                finalData = {
                    params: this.mergeParamValues(existing.params, newData.params),
                    timestamp: existing.timestamp, // Keep original timestamp
                };
            }
            else {
                // Pure first-touch - ignore new params
                this.log('First-touch mode: keeping original params');
                return null;
            }
            this.storage.set(STORAGE_KEY, finalData, this.config.ttl);
            // Call onCapture callback
            (_b = (_a = this.config).onCapture) === null || _b === void 0 ? void 0 : _b.call(_a, finalData.params, isFirstTouch);
            return finalData;
        }
        /**
         * Merge new param values into existing, maintaining unique values in original order
         * Example: existing="google|facebook", new="medium" -> "google|facebook|medium"
         */
        mergeParamValues(existing, newParams) {
            const result = { ...existing };
            for (const [key, newValue] of Object.entries(newParams)) {
                const existingValue = result[key];
                if (!existingValue) {
                    result[key] = newValue;
                }
                else {
                    // Split existing into array, add new value if not present
                    const values = existingValue.split('|');
                    if (!values.includes(newValue)) {
                        values.push(newValue);
                        result[key] = values.join('|');
                    }
                }
            }
            return result;
        }
        // ═══════════════════════════════════════════════════════════════
        // PUBLIC API
        // ═══════════════════════════════════════════════════════════════
        getParams() {
            var _a, _b;
            const data = (_a = this.storage) === null || _a === void 0 ? void 0 : _a.get(STORAGE_KEY);
            return (_b = data === null || data === void 0 ? void 0 : data.params) !== null && _b !== void 0 ? _b : {};
        }
        getParam(name) {
            var _a;
            return (_a = this.getParams()[name]) !== null && _a !== void 0 ? _a : null;
        }
        clear() {
            var _a, _b;
            (_a = this.storage) === null || _a === void 0 ? void 0 : _a.clearAll();
            (_b = this.decorator) === null || _b === void 0 ? void 0 : _b.reset();
            this.log('Cleared all data');
        }
    }
    // Singleton instance
    const paramsSaver = new ParamsSaver();
    // Auto-init from script tag attributes (always runs)
    if (typeof document !== 'undefined') {
        const autoInit = () => {
            const script = document.currentScript;
            let config = {};
            if (script) {
                // 1. Parse JSON config first (lowest priority)
                const configAttr = script.getAttribute('data-config');
                if (configAttr) {
                    try {
                        config = JSON.parse(configAttr);
                    }
                    catch (_a) {
                        // Ignore parse errors
                    }
                }
                // 2. Parse individual data-* attributes (override JSON config)
                // Boolean: debug
                if (script.dataset.debug === 'true') {
                    config.debug = true;
                }
                // Boolean: mergeParams
                if (script.dataset.mergeParams === 'true') {
                    config.mergeParams = true;
                }
                // String: storage
                if (script.dataset.storage) {
                    config.storage = script.dataset.storage;
                }
                // Array: params (comma-separated, uses startsWith matching)
                if (script.dataset.params) {
                    config.params = script.dataset.params
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0);
                }
                // Array: allowed-domains (comma-separated domains)
                if (script.dataset.allowedDomains) {
                    config.allowedDomains = script.dataset.allowedDomains
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0);
                }
                // Array: exclude-patterns (comma-separated URL patterns)
                if (script.dataset.excludePatterns) {
                    config.excludePatterns = script.dataset.excludePatterns
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0);
                }
            }
            paramsSaver.init(config);
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', autoInit);
        }
        else {
            autoInit();
        }
    }
    // Expose globally
    if (typeof window !== 'undefined') {
        window.ParamsSaver = paramsSaver;
    }

    exports.ParamsSaver = ParamsSaver;
    exports.default = paramsSaver;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=aicw-params-saver.js.map
