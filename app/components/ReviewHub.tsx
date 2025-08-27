"use client";
import React, {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Search,
    ExternalLink,
    Filter,
    Link as LinkIcon,
    Tag,
    Star,
    Check,
    ChevronDown,
    ThumbsUp,
    ThumbsDown,
    X,
} from "lucide-react";

/* ----------------------------- Types & Const ----------------------------- */
type Platform = "tiktok" | "youtube" | "reels";

type ReviewItem = {
    _id: string;
    title: string;
    platform: Platform;
    productImage?: string;
    productGif?: string;
    price?: string;
    rating?: number;
    tags: string[];
    aliases?: string[];
    publishedAt: string;
    reviewUrl: string;
    affiliateUrl: string;
    pros?: string[];
    cons?: string[];
};

const TIKTOK_TOKEN = "tiktok>";
const TIKTOK_URL_RE =
    /\bhttps?:\/\/(?:www\.)?(?:m\.)?(?:vt\.)?tiktok\.com\/[^\s]+/i;

/* --------------------------------- Utils -------------------------------- */
const clamp5 = (n: number) =>
    Math.max(0, Math.min(5, Number.isFinite(n) ? n : 0));

const stripToken = (text: string) => text.replaceAll(TIKTOK_TOKEN, "").trim();

function extractTikTokFromInput(input: string) {
    const m = input.match(TIKTOK_URL_RE);
    if (!m) return { displayText: input, tiktokUrl: null as string | null };
    const raw = m[0].replace(/^["']|["']$/g, "");
    let url: URL | null = null;
    try {
        url = new URL(raw);
    } catch {}
    if (!url) return { displayText: input, tiktokUrl: null };
    [
        "is_from_webapp",
        "sender_device",
        "sender_web_id",
        "utm_source",
        "utm_medium",
        "utm_campaign",
    ].forEach((k) => url!.searchParams.delete(k));
    const cleaned = url!.toString();
    const displayText = input
        .replace(TIKTOK_URL_RE, TIKTOK_TOKEN)
        .replace(/\s{2,}/g, " ")
        .trim();
    return { displayText, tiktokUrl: cleaned };
}

function useDebouncedValue<T>(value: T, delay = 250) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

/* ------------------------------- UI Atoms -------------------------------- */
type PolymorphicProps<E extends keyof JSX.IntrinsicElements> =
    JSX.IntrinsicElements[E] & { as?: E; className?: string };

function Button<E extends keyof JSX.IntrinsicElements = "button">({
    as,
    className = "",
    ...props
}: PolymorphicProps<E>) {
    const Comp = (as || "button") as any;
    return (
        <Comp
            className={
                "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium outline-none " +
                "transition-all duration-200 ease-out active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-500/40 " +
                "bg-zinc-900/60 backdrop-blur-lg border border-white/10 " +
                className
            }
            {...props}
        />
    );
}

const Card = memo(function Card({
    className = "",
    ...props
}: { className?: string } & React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={
                "rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 backdrop-blur-xl shadow-xl " +
                "transition-all duration-500 hover:shadow-emerald-500/10 hover:scale-[1.01] " +
                className
            }
            {...props}
        />
    );
});

const Badge = ({
    className = "",
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) => (
    <span
        className={
            "inline-flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/70 backdrop-blur px-3 py-1 text-xs text-zinc-300 " +
            "transition-all duration-300 " +
            className
        }
    >
        {children}
    </span>
);

const ScoreBadge = memo(function ScoreBadge({ value = 0 }: { value?: number }) {
    const v = clamp5(value);
    return (
        <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/70 backdrop-blur px-2.5 py-1 text-xs text-zinc-200">
            <span className="font-semibold">{v.toFixed(1)}</span>
            <span className="opacity-60">/ 5</span>
            <Star
                size={14}
                className="-mt-px text-yellow-400"
                fill="currentColor"
                strokeWidth={0}
            />
        </span>
    );
});

function TikTokBadge({ onClear }: { onClear: () => void }) {
    const onKey = (e: React.KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Backspace" || e.key === "Delete") {
            e.preventDefault();
            onClear();
        }
    };
    return (
        <span
            tabIndex={0}
            onKeyDown={onKey}
            className="relative isolate inline-flex items-center gap-1 pl-2 pr-1 py-1
                 rounded-full text-[11px] font-semibold text-white outline-none
                 ring-0 focus-visible:ring-2 focus-visible:ring-white/30"
            aria-label="TikTok link active (press Backspace/Delete to clear)"
        >
            {/* glow layer */}
            <span
                aria-hidden
                className="absolute -inset-[2px] -z-10 rounded-full blur-[8px] opacity-70
                   bg-[conic-gradient(at_30%_30%,#25F4EE_0deg,#000_120deg,#FE2C55_240deg,#25F4EE_360deg)]"
            />
            {/* gradient core */}
            <span
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-[#111] via-[#1b1b1b] to-[#111]"
            />
            {/* border shimmer */}
            <span
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full p-px
                   [background:linear-gradient(90deg,rgba(37,244,238,.9),rgba(255,255,255,.15),rgba(254,44,85,.9))] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)]
                   [mask-composite:exclude]"
            />
            tiktok&gt;
            <button
                type="button"
                onClick={onClear}
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full
                   bg-black/50 hover:bg-black/70 active:scale-95 transition"
                aria-label="ลบ tiktok url"
            >
                <X size={10} />
            </button>
        </span>
    );
}

/* ----------------------------- Helper (UI) ------------------------------- */
const merchantInfo = (url: string) => {
    const u = (url || "").toLowerCase();
    if (u.includes("shopee"))
        return {
            label: "Shopee",
            className:
                "bg-[linear-gradient(135deg,#FF6A3D_0%,#EF4D2D_48%,#E63D17_100%)] text-white",
        } as const;
    if (u.includes("ikea"))
        return {
            label: "IKEA",
            className: "!bg-[#0058A3] text-white",
            style: { backgroundColor: "#0058A3" } as React.CSSProperties,
        } as const;
    return {
        label: "ไปที่ร้านค้า",
        className: "bg-emerald-600 text-white",
    } as const;
};

/* --------------------------------- Page ---------------------------------- */
export default function ReviewHub() {
    /* state */
    const [query, setQuery] = useState("");
    const [activeTags, setActiveTags] = useState<string[]>([]);
    const [filterOpen, setFilterOpen] = useState(false);
    const [canHover, setCanHover] = useState(false);
    const [tiktokUrl, setTikTokUrl] = useState<string | null>(null);

    const [items, setItems] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const debouncedQuery = useDebouncedValue(query, 300);

    // GIF states by id; timers map to avoid re-creating timeouts loop
    const [gifOn, setGifOn] = useState<Record<string, boolean>>({});
    const gifTimersRef = useRef<Record<string, number>>({});

    /* effects */
    useEffect(() => {
        document.documentElement.classList.add("dark");
        const mmHover = window.matchMedia("(hover: hover) and (pointer: fine)");
        const onChange = () => setCanHover(mmHover.matches);
        onChange();
        mmHover.addEventListener?.("change", onChange);
        return () => mmHover.removeEventListener?.("change", onChange);
    }, []);

    // data fetch with proper cancellation (reuse controller via ref to cancel fast)
    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            try {
                setLoading(true);
                const url = new URL("/api/reviews", window.location.origin);
                const rest = stripToken(debouncedQuery);
                if (tiktokUrl) url.searchParams.set("tiktokUrl", tiktokUrl);
                if (rest) url.searchParams.set("q", rest);
                if (activeTags.length)
                    url.searchParams.set("tags", activeTags.join(","));
                const res = await fetch(url.toString(), {
                    signal: controller.signal,
                    cache: "no-store",
                });
                const json = await res.json();
                setItems(json.data || []);
            } catch (e: any) {
                if (e?.name !== "AbortError") console.warn("fetch failed", e);
            } finally {
                setLoading(false);
            }
        })();
        return () => controller.abort();
    }, [debouncedQuery, activeTags, tiktokUrl]);

    /* memo */
    const allTags = useMemo(() => {
        const t = new Set<string>();
        for (const d of items) for (const x of d.tags || []) t.add(x);
        return Array.from(t);
    }, [items]);

    /* callbacks */
    const toggleTag = useCallback((t: string) => {
        setActiveTags((prev) =>
            prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
        );
    }, []);
    const clearTags = useCallback(() => setActiveTags([]), []);

    const clearTikTok = useCallback(() => {
        setTikTokUrl(null);
        setQuery(stripToken(query));
    }, [query]);

    const handleSearchKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Backspace" || e.key === "Delete") {
                const el = e.currentTarget;
                const val = el.value ?? "";
                const s = el.selectionStart ?? 0;
                const epos = el.selectionEnd ?? 0;
                const emptyOrAllSelected =
                    val.length === 0 || (s === 0 && epos === val.length);
                if (tiktokUrl && emptyOrAllSelected) {
                    e.preventDefault();
                    clearTikTok();
                }
            }
        },
        [tiktokUrl, clearTikTok]
    );

    const handleSearchChange = useCallback(
        (raw: string) => {
            const withToken = tiktokUrl ? `${TIKTOK_TOKEN} ${raw}`.trim() : raw;
            const { displayText, tiktokUrl: found } =
                extractTikTokFromInput(withToken);
            setQuery(displayText);
            if (displayText.includes(TIKTOK_TOKEN)) {
                if (found) setTikTokUrl(found);
            } else {
                setTikTokUrl(null);
            }
        },
        [tiktokUrl]
    );

    const handleSearchPaste = useCallback(
        (e: React.ClipboardEvent<HTMLInputElement>) => {
            const text = e.clipboardData.getData("text");
            if (!TIKTOK_URL_RE.test(text)) return;
            e.preventDefault();
            const base =
                (tiktokUrl ? `${TIKTOK_TOKEN} ${stripToken(query)}` : query) ||
                "";
            const el = e.target as HTMLInputElement;
            const before = base.slice(0, el.selectionStart ?? base.length);
            const after = base.slice(el.selectionEnd ?? base.length);
            const merged = `${before}${text}${after}`;
            const { displayText, tiktokUrl: found } =
                extractTikTokFromInput(merged);
            setQuery(displayText);
            if (found) setTikTokUrl(found);
        },
        [query, tiktokUrl]
    );

    const toggleGif = useCallback((id: string, next?: boolean) => {
        setGifOn((prev) => {
            const on = next ?? !prev[id];
            // clear old timer
            const old = gifTimersRef.current[id];
            if (old) {
                clearTimeout(old);
                delete gifTimersRef.current[id];
            }
            // set new timer if turning on
            if (on) {
                gifTimersRef.current[id] = window.setTimeout(() => {
                    setGifOn((m) => ({ ...m, [id]: false }));
                    delete gifTimersRef.current[id];
                }, 3000);
            }
            return { ...prev, [id]: on };
        });
    }, []);

    /* render */
    return (
        <div className="min-h-dvh bg-transparent text-zinc-100">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
                    <span className="font-semibold">ikkist's items</span>

                    {/* Desktop Search */}
                    <div className="relative ml-4 hidden min-w-0 flex-1 items-center md:flex">
                        <Search
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
                            size={18}
                        />
                        <div
                            className="
              w-full rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur
              px-3 py-1.5 pr-3 pl-9 flex items-center gap-2
              outline-none ring-0 transition-all duration-200 ease-out
              focus-within:border-emerald-500/50 focus-within:shadow-[0_0_15px_rgba(16,185,129,0.25)]
            "
                        >
                            {tiktokUrl && <TikTokBadge onClear={clearTikTok} />}
                            <input
                                className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
                                placeholder="วาง TikTok แล้วพิมพ์ต่อ เช่น: tiktok> โคมไฟ minimal"
                                value={stripToken(query)}
                                onChange={(e) =>
                                    handleSearchChange(e.target.value)
                                }
                                onPaste={handleSearchPaste}
                                onKeyDown={handleSearchKeyDown}
                            />
                        </div>
                    </div>

                    {/* Filter */}
                    <div className="ml-auto relative z-50">
                        <Button
                            className="rounded-xl border border-white/10 bg-zinc-900/60 text-zinc-200"
                            onClick={() => setFilterOpen((v) => !v)}
                        >
                            <Filter size={16} /> ตัวกรอง{" "}
                            <ChevronDown size={16} />
                        </Button>
                        {filterOpen && (
                            <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-white/10 bg-zinc-900/80 p-3 shadow-xl backdrop-blur">
                                <div className="mb-2 flex items-center gap-2">
                                    <Search size={14} className="opacity-60" />
                                    <span className="text-xs text-zinc-400">
                                        เลือกแท็กได้หลายอัน
                                    </span>
                                </div>
                                <div className="flex max-h-56 flex-wrap gap-2 overflow-auto rounded-xl border border-white/10 bg-zinc-900/40 p-2">
                                    {allTags.map((t) => {
                                        const active = activeTags.includes(t);
                                        return (
                                            <button
                                                key={t}
                                                onClick={() => toggleTag(t)}
                                                className={`group inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${
                                                    active
                                                        ? "border-emerald-500/60 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/40"
                                                        : "border-white/10 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-900"
                                                }`}
                                                aria-pressed={active}
                                            >
                                                {active ? (
                                                    <Check size={14} />
                                                ) : (
                                                    <Tag size={12} />
                                                )}
                                                {t}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-2">
                                    <button
                                        onClick={clearTags}
                                        className="text-xs text-zinc-400 hover:text-zinc-200"
                                    >
                                        ล้างทั้งหมด
                                    </button>
                                    <Button
                                        className="h-10 rounded-xl bg-zinc-100/5 text-zinc-200 hover:bg-zinc-100/10"
                                        onClick={() => setFilterOpen(false)}
                                    >
                                        เสร็จสิ้น
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile search */}
                <div className="block border-t border-white/10 px-4 pb-3 pt-2 md:hidden">
                    <div className="relative">
                        <Search
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
                            size={18}
                        />
                        <div
                            className="
              w-full rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur
              px-3 py-1.5 pr-3 pl-9 flex items-center gap-2
              outline-none ring-0 transition-all duration-200 ease-out
              focus-within:border-emerald-500/50 focus-within:shadow-[0_0_15px_rgba(16,185,129,0.25)]
            "
                        >
                            {tiktokUrl && <TikTokBadge onClear={clearTikTok} />}
                            <input
                                className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
                                placeholder={
                                    tiktokUrl
                                        ? "ใส่ชื่อ/ชนิดสินค้าเพื่อค้นหา"
                                        : "แปะลิงค์ tiktok หรือ ชื่อ/ชนิดสินค้าเพื่อค้นหา"
                                }
                                value={stripToken(query)}
                                onChange={(e) =>
                                    handleSearchChange(e.target.value)
                                }
                                onPaste={handleSearchPaste}
                                onKeyDown={handleSearchKeyDown}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Grid */}
            <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
                {loading ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-2xl border border-white/10 bg-zinc-900/40 h-64 animate-pulse"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((item) => {
                            const gif = !!gifOn[item._id];
                            const m = merchantInfo(item.affiliateUrl);
                            return (
                                <Card
                                    key={item._id}
                                    className="overflow-hidden relative group"
                                >
                                    <div
                                        className="relative aspect-[4/5] md:aspect-[16/10] w-full"
                                        onMouseEnter={() =>
                                            item.productGif &&
                                            canHover &&
                                            toggleGif(item._id, true)
                                        }
                                        onMouseLeave={() =>
                                            item.productGif &&
                                            canHover &&
                                            toggleGif(item._id, false)
                                        }
                                        onClick={() =>
                                            item.productGif &&
                                            toggleGif(item._id)
                                        }
                                        role="button"
                                        aria-label="พรีวิว GIF (เดสก์ท็อป: hover / มือถือ: แตะ)"
                                    >
                                        <img
                                            src={item.productImage}
                                            alt={item.title}
                                            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                                                gif
                                                    ? "opacity-0"
                                                    : "opacity-100"
                                            }`}
                                            loading="lazy"
                                            decoding="async"
                                        />
                                        {item.productGif && (
                                            <img
                                                src={item.productGif}
                                                alt={`${item.title} gif`}
                                                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                                                    gif
                                                        ? "opacity-100"
                                                        : "opacity-0"
                                                }`}
                                                loading="lazy"
                                                decoding="async"
                                            />
                                        )}

                                        {/* overlays */}
                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/80" />
                                        <div className="absolute top-2 left-2 z-10 flex items-center gap-2 text-xs text-white/80">
                                            <Badge className="!text-xs bg-black/50">
                                                {item.platform}
                                            </Badge>
                                            <span>•</span>
                                            <time dateTime={item.publishedAt}>
                                                {new Date(
                                                    item.publishedAt
                                                ).toLocaleDateString("th-TH", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </time>
                                        </div>
                                        <ScoreBadge value={item.rating || 0} />

                                        {/* bottom content */}
                                        <div className="absolute bottom-0 left-0 right-0 z-10 p-4 flex flex-col gap-2">
                                            <h3 className="text-lg font-semibold text-white leading-snug line-clamp-2">
                                                {item.title}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                {(item.tags || [])
                                                    .slice(0, 3)
                                                    .map((t) => (
                                                        <span
                                                            key={t}
                                                            className="text-xs text-zinc-300 bg-white/10 px-2 py-0.5 rounded-full"
                                                        >
                                                            #{t}
                                                        </span>
                                                    ))}
                                            </div>
                                            {item.productGif && (
                                                <span className="md:hidden mt-1 text-[11px] text-white/80">
                                                    {gif
                                                        ? "แตะเพื่อหยุด GIF"
                                                        : "แตะเพื่อเล่น GIF"}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {(item.pros?.length ||
                                        item.cons?.length) && (
                                        <div className="p-4 bg-zinc-900/80 backdrop-blur">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-emerald-400 text-sm mb-1 flex items-center gap-1">
                                                        <ThumbsUp
                                                            size={14}
                                                            className="opacity-90"
                                                        />{" "}
                                                        ข้อดี
                                                    </div>
                                                    <ul className="space-y-1">
                                                        {(item.pros || [])
                                                            .slice(0, 2)
                                                            .map((p, i) => (
                                                                <li
                                                                    key={i}
                                                                    className="text-xs text-zinc-200"
                                                                >
                                                                    • {p}
                                                                </li>
                                                            ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <div className="text-red-400 text-sm mb-1 flex items-center gap-1">
                                                        <ThumbsDown
                                                            size={14}
                                                            className="opacity-90"
                                                        />{" "}
                                                        ข้อเสีย
                                                    </div>
                                                    <ul className="space-y-1">
                                                        {(item.cons || [])
                                                            .slice(0, 2)
                                                            .map((c, i) => (
                                                                <li
                                                                    key={i}
                                                                    className="text-xs text-zinc-200"
                                                                >
                                                                    • {c}
                                                                </li>
                                                            ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex gap-2">
                                                <Button
                                                    as="a"
                                                    href={item.affiliateUrl}
                                                    target="_blank"
                                                    rel="nofollow noopener noreferrer"
                                                    style={(m as any).style}
                                                    className={
                                                        (m as any).className +
                                                        " h-12 px-4 rounded-xl text-base font-semibold flex-1"
                                                    }
                                                >
                                                    {m.label}{" "}
                                                    <LinkIcon size={18} />
                                                </Button>
                                                <Button
                                                    as="a"
                                                    href={item.reviewUrl}
                                                    target="_blank"
                                                    className="h-10 px-4 bg-white/10 text-white hover:bg-white/20 flex-[0.5]"
                                                >
                                                    คลิป{" "}
                                                    <ExternalLink size={16} />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
