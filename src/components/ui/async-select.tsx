import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type AsyncSelectFetchResult<T> = {
  options: T[];
  hasMore?: boolean;
};

export interface AsyncSelectProps<T> {
  fetcher: (query?: string) => Promise<T[] | AsyncSelectFetchResult<T>>;
  preload?: boolean;
  filterFn?: (option: T, query: string) => boolean;
  renderOption: (option: T) => React.ReactNode;
  getOptionValue: (option: T) => string;
  getDisplayValue: (option: T) => React.ReactNode;
  notFound?: React.ReactNode;
  loadingSkeleton?: React.ReactNode;
  multiple?: boolean;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  width?: string | number;
  className?: string;
  triggerClassName?: string;
  noResultsMessage?: React.ReactNode;
  noResultsMessages?: Record<string, React.ReactNode>;
  locale?: string;
  clearable?: boolean;
  defaultDisplayValue?: React.ReactNode;
  loadMore?: (query?: string, page?: number) => Promise<T[] | AsyncSelectFetchResult<T>>;
  hasMore?: boolean;
  selectFirstOnEnter?: boolean;
}

const FALLBACK_FETCH_ERROR_MESSAGE = "Failed to fetch options";

const normalizeQuery = (query: string) => {
  const n = query.trim();
  return n.length > 0 ? n : undefined;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return FALLBACK_FETCH_ERROR_MESSAGE;
};

const dedupeOptions = <T,>(options: T[], getVal: (o: T) => string) => {
  const map = new Map<string, T>();
  options.forEach((o) => map.set(getVal(o), o));
  return Array.from(map.values());
};

function normalizeFetchResult<T>(
  result: T[] | AsyncSelectFetchResult<T>
): AsyncSelectFetchResult<T> {
  if (Array.isArray(result)) {
    return { options: result };
  }
  return result;
}

export function AsyncSelect<T>({
  fetcher,
  preload,
  filterFn,
  renderOption,
  getOptionValue,
  getDisplayValue,
  notFound,
  loadingSkeleton,
  placeholder,
  searchPlaceholder,
  value,
  onChange,
  disabled = false,
  width = "200px",
  className,
  triggerClassName,
  noResultsMessage,
  noResultsMessages,
  locale,
  clearable = true,
  defaultDisplayValue,
  multiple = false,
  loadMore,
  hasMore = false,
  selectFirstOnEnter = false,
}: AsyncSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedListOpen, setSelectedListOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [retryNonce, setRetryNonce] = useState(0);
  const [internalHasMore, setInternalHasMore] = useState(false);
  const isMobile = useIsMobile();
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userInteractedRef = useRef(false);
  const selectedCacheRef = useRef(new Map<string, T>());
  const debouncedSearchTerm = useDebounce(searchTerm, preload ? 0 : 300);
  const baseReqRef = useRef(0);
  const moreReqRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  const getValRef = useRef(getOptionValue);
  const loadMoreRef = useRef(loadMore);
  const lastQueryRef = useRef<string | undefined | null>(null);

  const requestQuery = useMemo(
    () => (preload ? undefined : normalizeQuery(debouncedSearchTerm)),
    [debouncedSearchTerm, preload]
  );

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);
  useEffect(() => {
    getValRef.current = getOptionValue;
  }, [getOptionValue]);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const fetchBaseOptions = useCallback(async () => {
    if (!open) return;
    if (retryNonce === 0 && lastQueryRef.current !== null && lastQueryRef.current === requestQuery)
      return;
    const reqId = ++baseReqRef.current;
    lastQueryRef.current = requestQuery;
    setLoading(true);
    setLoadingMore(false);
    setPage(1);
    setError(null);
    try {
      const raw = await fetcherRef.current(requestQuery);
      if (baseReqRef.current !== reqId) return;
      const { options: data, hasMore: fetchedHasMore } = normalizeFetchResult(raw);
      setOptions(dedupeOptions(data, getValRef.current));
      data.forEach((item) => selectedCacheRef.current.set(getValRef.current(item), item));
      if (fetchedHasMore !== undefined) setInternalHasMore(fetchedHasMore);
    } catch (err) {
      if (baseReqRef.current !== reqId) return;
      setOptions([]);
      setInternalHasMore(false);
      setError(getErrorMessage(err));
    } finally {
      if (baseReqRef.current !== reqId) return;
      setLoading(false);
    }
  }, [open, requestQuery, retryNonce]);

  useEffect(() => {
    void fetchBaseOptions();
  }, [fetchBaseOptions]);

  const displayedOptions = useMemo(() => {
    if (!preload || !debouncedSearchTerm || !filterFn) return options;
    return options.filter((o) => filterFn(o, debouncedSearchTerm));
  }, [options, preload, debouncedSearchTerm, filterFn]);

  const normalizedValues = useMemo(() => {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  }, [value]);

  const selectedOptions = useMemo(
    () =>
      normalizedValues
        .map((v) => options.find((o) => getOptionValue(o) === v) ?? selectedCacheRef.current.get(v))
        .filter((o): o is T => o !== undefined),
    [options, normalizedValues, getOptionValue]
  );

  const selectedOption = useMemo(
    () => (multiple ? null : (selectedOptions[0] ?? null)),
    [multiple, selectedOptions]
  );
  const selectedCount = selectedOptions.length;

  const handleSelect = useCallback(
    (currentValue: string) => {
      if (multiple) {
        const exists = normalizedValues.includes(currentValue);
        if (exists && !clearable) return;
        onChange(
          exists
            ? normalizedValues.filter((v) => v !== currentValue)
            : [...normalizedValues, currentValue]
        );
        return;
      }
      const isSame = currentValue === value;
      onChange(clearable && isSame ? "" : currentValue);
      setOpen(false);
    },
    [multiple, normalizedValues, value, onChange, clearable]
  );

  const isSelected = useCallback(
    (v: string) => (multiple ? normalizedValues.includes(v) : v === value),
    [multiple, normalizedValues, value]
  );

  const defaultMsgs: Record<string, React.ReactNode> = {
    en: "No options available",
    id: "Tidak ada pilihan",
  };
  const resolvedLocale =
    locale ?? (typeof document !== "undefined" ? document.documentElement.lang : undefined);
  const msgs = noResultsMessages ?? defaultMsgs;
  const resolvedNoResults =
    (resolvedLocale && (msgs[resolvedLocale] ?? msgs[resolvedLocale.split("-")[0]])) ??
    noResultsMessage ??
    defaultMsgs.en;

  // Reset on close
  useEffect(() => {
    if (!open) {
      baseReqRef.current++;
      moreReqRef.current++;
      lastQueryRef.current = null;
      setLoading(false);
      setLoadingMore(false);
      setInternalHasMore(false);
      setSelectedListOpen(false);
      setSearchTerm("");
      userInteractedRef.current = false;
    }
    if (open && isMobile) {
      setTimeout(() => {
        if (!userInteractedRef.current) inputRef.current?.blur();
      }, 50);
    }
  }, [open, isMobile]);

  useEffect(() => {
    if (selectedCount <= 2) setSelectedListOpen(false);
  }, [selectedCount]);

  const effectiveHasMore = internalHasMore || hasMore;

  const handleLoadMore = useCallback(async () => {
    if (!loadMoreRef.current || loadingMore || loading || error || !effectiveHasMore) return;
    const reqId = ++moreReqRef.current;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const raw = await loadMoreRef.current(requestQuery, nextPage);
      if (moreReqRef.current !== reqId) return;
      const { options: data, hasMore: fetchedHasMore } = normalizeFetchResult(raw);
      setOptions((prev) => dedupeOptions([...prev, ...data], getValRef.current));
      data.forEach((item) => selectedCacheRef.current.set(getValRef.current(item), item));
      setPage(nextPage);
      if (fetchedHasMore !== undefined) setInternalHasMore(fetchedHasMore);
    } catch (err) {
      if (moreReqRef.current !== reqId) return;
      setError(getErrorMessage(err));
    } finally {
      if (moreReqRef.current !== reqId) return;
      setLoadingMore(false);
    }
  }, [loadingMore, loading, error, effectiveHasMore, page, requestQuery]);

  const displayValue = useMemo(() => {
    if (multiple) {
      if (selectedCount === 0) return placeholder;
      const renderBadge = (option: T) => (
        <Badge
          key={getOptionValue(option)}
          variant="secondary"
          className="max-w-40 gap-1 truncate pr-1"
        >
          <span className="truncate">{getDisplayValue(option)}</span>
          {clearable && (
            <X
              className="h-3 w-3 shrink-0 cursor-pointer opacity-50 hover:opacity-100"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (!disabled)
                  onChange(normalizedValues.filter((v) => v !== getOptionValue(option)));
              }}
            />
          )}
        </Badge>
      );
      if (selectedCount <= 2)
        return (
          <span className="flex flex-wrap items-center gap-1">
            {selectedOptions.map(renderBadge)}
          </span>
        );
      const visible = selectedOptions.slice(0, 2);
      return (
        <span className="flex items-center gap-2">
          {visible.map(renderBadge)}
          <Badge
            variant="secondary"
            className="cursor-pointer select-none hover:bg-secondary/80"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) {
                setSelectedListOpen((p) => !p);
                setOpen(true);
              }
            }}
          >
            +{selectedCount - visible.length}
          </Badge>
        </span>
      );
    }
    if (selectedOption) return getDisplayValue(selectedOption);
    if (!multiple && typeof value === "string" && value.length > 0) {
      if (defaultDisplayValue) return defaultDisplayValue;
      return value;
    }
    return placeholder;
  }, [
    multiple,
    selectedOptions,
    selectedOption,
    selectedCount,
    getDisplayValue,
    getOptionValue,
    placeholder,
    disabled,
    clearable,
    defaultDisplayValue,
    normalizedValues,
    onChange,
    value,
  ]);

  return (
    <div className="relative" style={{ width }}>
      {/* Trigger */}
      <div ref={triggerRef}>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-start pr-9 text-left",
            disabled && "cursor-not-allowed opacity-50",
            triggerClassName
          )}
          disabled={disabled}
          onClick={() => {
            if (!disabled) setOpen((p) => !p);
          }}
        >
          {displayValue}
        </Button>
        <ChevronsUpDown
          className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>

      {/* Dropdown — rendered inline, not in a portal */}
      {open && (
        <div
          ref={dropdownRef}
          className={cn(
            "absolute top-full left-0 z-[999] mt-2 w-full rounded-md border bg-popover text-popover-foreground shadow-md",
            className
          )}
        >
          {/* Search */}
          <div className="flex h-9 items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !selectFirstOnEnter) return;
                e.preventDefault();
                const firstOption = displayedOptions[0];
                if (!firstOption) return;
                handleSelect(getOptionValue(firstOption));
              }}
              onPointerDown={() => {
                userInteractedRef.current = true;
              }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {loading && options.length > 0 && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            )}
          </div>

          {/* Selected list (multi) */}
          {multiple && selectedCount > 2 && !selectedListOpen && (
            <div className="border-b bg-muted/10 px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSelectedListOpen(true)}
              >
                Lihat {selectedCount} terpilih
              </Button>
            </div>
          )}
          {multiple && selectedListOpen && selectedOptions.length > 0 && (
            <div className="border-b bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Terpilih</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setSelectedListOpen(false)}
                >
                  Tutup
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedOptions.map((o) => (
                  <Badge key={getOptionValue(o)} variant="secondary" className="max-w-40 truncate">
                    {getDisplayValue(o)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Options list */}
          <div
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: 240 }}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {error && (
              <div className="p-3">
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <div className="text-center text-sm text-destructive">{error}</div>
                  <div className="mt-2 flex items-center justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRetryNonce((n) => n + 1)}
                    >
                      Coba lagi
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {loading && options.length === 0 && (loadingSkeleton || <DefaultLoadingSkeleton />)}
            {!loading &&
              !error &&
              displayedOptions.length === 0 &&
              (notFound ||
                (resolvedNoResults ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {resolvedNoResults}
                  </div>
                ) : null))}
            <div className="p-1" role="listbox">
              {displayedOptions.map((option) => {
                const val = getOptionValue(option);
                const selected = isSelected(val);
                return (
                  <div
                    key={val}
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      "relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      selected && "bg-accent/50"
                    )}
                    onClick={() => handleSelect(val)}
                  >
                    {renderOption(option)}
                    <Check
                      className={cn(
                        "ml-auto h-3 w-3 shrink-0",
                        selected ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Load more */}
          {loadMore && effectiveHasMore && (
            <div className="border-t px-2 py-1.5">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8 w-full text-xs"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Muat lebih banyak"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DefaultLoadingSkeleton() {
  return (
    <div className="p-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
          <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
          <div className="flex flex-1 flex-col gap-1">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}