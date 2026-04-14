/**
 * Storage backends in priority order
 * Examples: 'localStorage', 'cookie|localStorage', 'cookie|localStorage|sessionStorage'
 */
type StorageType = 'localStorage' | 'sessionStorage' | 'cookie';
type StorageConfig = StorageType | StorageType[] | string;
/**
 * Captured parameter data
 */
interface ParamData {
    /** Key-value pairs of captured parameters */
    params: Record<string, string>;
    /** Timestamp when first captured (Unix ms) */
    timestamp: number;
}
/**
 * Main configuration
 */
interface ParamsSaverConfig {
    /** Enable console debug logging */
    debug: boolean;
    /**
     * Parameters to capture (uses startsWith matching)
     * @example ['utm_'] - captures utm_source, utm_medium, utm_campaign, etc.
     * @example ['utm_', 'gclid', 'fbclid'] - captures all utm_* plus gclid and fbclid
     */
    params: string[];
    /**
     * Storage backend(s) with fallback support
     * @example 'localStorage'
     * @example 'cookie|localStorage' - try cookie first, fallback to localStorage
     */
    storage: StorageConfig;
    /** TTL for stored data in days (0 = never expires) */
    ttl: number;
    /**
     * Allowed domains for link decoration (supports wildcards)
     * Empty array = current domain only
     * First domain also used as cookie domain when storage includes 'cookie'
     * @example ['example.com', '*.example.com', 'partner.com']
     */
    allowedDomains: string[];
    /**
     * Patterns to EXCLUDE from decoration (supports wildcards)
     * @example ['*.exe', '*.pdf', '*logout*']
     */
    excludePatterns: string[];
    /**
     * Merge params from multiple visits into pipe-separated values
     * When false (default): Pure first-touch - keep original params forever
     * When true: Attribution journey - "google|facebook|medium" tracks visit sources
     */
    mergeParams: boolean;
    /** Called when params are captured. Receives params and whether it's first touch */
    onCapture?: (params: Record<string, string>, isFirstTouch: boolean) => void;
}
/**
 * Public API
 */
interface ParamsSaverAPI {
    /** Initialize with configuration */
    init(config?: Partial<ParamsSaverConfig>): void;
    /** Get all stored params */
    getParams(): Record<string, string>;
    /** Get a specific param value */
    getParam(name: string): string | null;
    /** Clear all stored data */
    clear(): void;
}

declare class ParamsSaver implements ParamsSaverAPI {
    private config;
    private storage;
    private paramCapture;
    private decorator;
    private observer;
    private log;
    init(userConfig?: Partial<ParamsSaverConfig>): void;
    private processPage;
    private captureInternal;
    /**
     * Merge new param values into existing, maintaining unique values in original order
     * Example: existing="google|facebook", new="medium" -> "google|facebook|medium"
     */
    private mergeParamValues;
    getParams(): Record<string, string>;
    getParam(name: string): string | null;
    clear(): void;
}
declare const paramsSaver: ParamsSaver;

export { ParamsSaver, paramsSaver as default };
export type { ParamData, ParamsSaverAPI, ParamsSaverConfig };
