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
    LayoutGrid,
    Rows,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Variants, Transition } from "framer-motion";

const layoutSpring = { type: "spring", stiffness: 480, damping: 34, mass: 0.6 };
const easeOut: Transition["ease"] = [0.16, 1, 0.3, 1];

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

type CardMode = "full" | "compact";

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
type PolymorphicProps<E extends React.ElementType> =
    React.ComponentPropsWithoutRef<E> & { as?: E; className?: string };

function Button<E extends React.ElementType = "button">({
    as,
    className = "",
    ...props
}: PolymorphicProps<E>) {
    const Comp = (as || "button") as React.ElementType;
    return (
        <Comp
            className={
                "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-medium outline-none " +
                "transition-all duration-200 ease-out active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-500/40 " +
                "bg-zinc-900/60 backdrop-blur-lg border border-white/10 " +
                className
            }
            {...(props as any)}
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
            "inline-flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/70 backdrop-blur px-3 py-1 text-[13px] md:text-[14px] text-zinc-300 " +
            "transition-all duration-300 " +
            className
        }
    >
        {children}
    </span>
);

const ScoreBadge = memo(function ScoreBadge({
    value = 0,
    absolute = true,
}: {
    value?: number;
    absolute?: boolean;
}) {
    const v = clamp5(value);
    const pos = absolute ? "absolute top-2 right-2 z-10" : "";
    return (
        <span
            className={`${pos} inline-flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/70 backdrop-blur px-2.5 py-1 text-[13px] md:text-[14px] text-zinc-200`}
        >
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

/* ----------------------- Mobile GIF Hint (no icon) ----------------------- */
/** โชว์เฉพาะมือถือ — full: มุมขวาล่าง / compact: มุมขวาบน */
function MobileGifHint({
    playing,
    onToggle,
    placement = "br",
}: {
    playing: boolean;
    onToggle: () => void;
    placement?: "tr" | "br";
}) {
    const pos = placement === "tr" ? "top-2 right-2" : "bottom-2 right-2";
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onToggle();
            }}
            className={[
                "absolute z-20 md:hidden", // มือถือเท่านั้น
                pos,
                "rounded-full border border-white/10 bg-black/40 backdrop-blur",
                "px-2.5 py-[5px] text-[11px] leading-none",
                "text-white/60 shadow-md active:scale-95 transition",
            ].join(" ")}
            aria-label={playing ? "หยุด GIF" : "แตะเพื่อดู GIF"}
        >
            {playing ? "หยุด" : "แตะ"}
        </button>
    );
}

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
                 rounded-full text-[12px] md:text-[13px] font-semibold text-white outline-none
                 ring-0 focus-visible:ring-2 focus-visible:ring-white/30"
            aria-label="TikTok link active (press Backspace/Delete to clear)"
        >
            <span
                aria-hidden
                className="absolute -inset-[2px] -z-10 rounded-full blur-[8px] opacity-70
                   bg-[conic-gradient(at_30%_30%,#25F4EE_0deg,#000_120deg,#FE2C55_240deg,#25F4EE_360deg)]"
            />
            <span
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-[#111] via-[#1b1b1b] to-[#111]"
            />
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
                "text-white bg-[linear-gradient(135deg,#FF6A3D_0%,#EF4D2D_50%,#E63D17_100%)] shadow-[0_6px_20px_rgba(239,77,45,0.35)]",
        } as const;

    if (u.includes("lazada") || u.includes("lzd.co"))
        return {
            label: "Lazada",
            className:
                "text-white bg-[linear-gradient(135deg,#1A9CF3_0%,#FF5A00_100%)] shadow-[0_6px_20px_rgba(26,156,243,0.35)]",
        } as const;

    if (u.includes("ikea"))
        return {
            label: "IKEA",
            className:
                "text-white bg-[linear-gradient(135deg,#1877C9_0%,#0D5FAA_100%)] shadow-[0_6px_20px_rgba(24,119,201,0.35)]",
        } as const;

    if (
        u.includes("tiktok") ||
        u.includes("shop.tiktok") ||
        u.includes("ttshop")
    )
        return {
            label: "TikTok",
            className:
                "text-white bg-[linear-gradient(135deg,#FE2C55_0%,#25F4EE_100%)] shadow-[0_6px_20px_rgba(254,44,85,0.35)]",
        } as const;

    return {
        label: "ไปที่ร้านค้า",
        className:
            "text-white bg-[linear-gradient(135deg,#10B981_0%,#059669_100%)] shadow-[0_6px_20px_rgba(16,185,129,0.35)]",
    } as const;
};

/* --------------------------- Motion Variants ---------------------------- */
const pageVar: Variants = {
    hidden: { opacity: 0, y: 8 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.28, ease: easeOut },
    },
};

const sectionVar: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.22, ease: easeOut },
    },
};

const gridVar = (delay = 0): Variants => ({
    hidden: {},
    show: {
        transition: {
            delay,
            staggerChildren: 0.06,
            when: "beforeChildren",
        },
    },
});

const cardVar = (shift = 10): Variants => ({
    hidden: { opacity: 0, y: shift, scale: 0.98 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.22, ease: easeOut },
    },
});

const dropVar: Variants = {
    hidden: { opacity: 0, y: -6, scale: 0.98 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.16, ease: easeOut },
    },
    exit: {
        opacity: 0,
        y: -6,
        scale: 0.98,
        transition: { duration: 0.12, ease: easeOut },
    },
};

/* --------------------------------- Page ---------------------------------- */
export default function ReviewHub() {
    /* state */
    const [query, setQuery] = useState("");
    const [activeTags, setActiveTags] = useState<string[]>([]);
    const [filterOpen, setFilterOpen] = useState(false);
    const [canHover, setCanHover] = useState(false);
    const [tiktokUrl, setTikTokUrl] = useState<string | null>(null);
    const [cardMode, setCardMode] = useState<CardMode>("full");
    const [year, setYear] = useState<string>(""); // กัน hydration mismatch

    const [items, setItems] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const debouncedQuery = useDebouncedValue(query, 300);

    const isFull = cardMode === "full";
    const toggleMode = () => setCardMode(isFull ? "compact" : "full");

    // GIF states by id
    const [gifOn, setGifOn] = useState<Record<string, boolean>>({});
    const gifTimersRef = useRef<Record<string, number>>({});

    /* effects */
    useEffect(() => {
        if (typeof document !== "undefined") {
            document.documentElement.classList.add("dark");
        }
        if (typeof window !== "undefined") {
            const mmHover = window.matchMedia(
                "(hover: hover) and (pointer: fine)"
            );
            const onChange = () => setCanHover(mmHover.matches);
            onChange();
            mmHover.addEventListener?.("change", onChange);
            return () => mmHover.removeEventListener?.("change", onChange);
        }
    }, []);

    // remember card mode
    useEffect(() => {
        try {
            const saved = localStorage.getItem("cardMode") as CardMode | null;
            if (saved === "compact" || saved === "full") setCardMode(saved);
        } catch {}
    }, []);
    useEffect(() => {
        try {
            localStorage.setItem("cardMode", cardMode);
        } catch {}
    }, [cardMode]);

    // year (client-only)
    useEffect(() => {
        setYear(String(new Date().getFullYear()));
    }, []);

    // data fetch
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
            const old = gifTimersRef.current[id];
            if (old) {
                clearTimeout(old);
                delete gifTimersRef.current[id];
            }
            if (on) {
                gifTimersRef.current[id] = window.setTimeout(() => {
                    setGifOn((m) => ({ ...m, [id]: false }));
                    delete gifTimersRef.current[id];
                }, 3000);
            }
            return { ...prev, [id]: on };
        });
    }, []);

    /* layout helpers */
    const gridClass =
        cardMode === "compact"
            ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

    /* render */
    return (
        <motion.div
            className="min-h-dvh bg-transparent text-[15px] md:text-[16.5px] leading-[1.75] text-zinc-100"
            variants={pageVar}
            initial="hidden"
            animate="show"
        >
            {/* Header */}
            <motion.header
                className="sticky top-0 z-50 border-b border-white/10 bg-zinc-900/40 backdrop-blur-md"
                variants={sectionVar}
            >
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
                    <span className="font-semibold text-[16px] md:text-[18px] tracking-[0.005em] text-[var(--text-primary)]">
                        ikkist&apos;s items
                    </span>

                    {/* Desktop Search */}
                    <div className="relative ml-4 hidden min-w-0 flex-1 items-center md:flex">
                        <Search
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
                            size={18}
                        />
                        <div
                            className="
                w-full rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur
                px-3 py-2 pr-3 pl-9 flex items-center gap-2
                outline-none ring-0 transition-all duration-200 ease-out
                focus-within:border-emerald-500/50 focus-within:shadow-[0_0_15px_rgba(16,185,129,0.25)]
              "
                        >
                            {tiktokUrl && <TikTokBadge onClear={clearTikTok} />}
                            <input
                                className="min-w-0 flex-1 bg-transparent text-[15px] md:text-[16px] leading-[1.6] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                                placeholder="วางลิงก์ TikTok หรือชื่อของที่ต้องการ (เช่น โคมไฟ minimal)"
                                value={stripToken(query)}
                                onChange={(e) =>
                                    handleSearchChange(e.target.value)
                                }
                                onPaste={handleSearchPaste}
                                onKeyDown={handleSearchKeyDown}
                            />
                        </div>
                    </div>

                    {/* Display mode toggle */}
                    <div className="ml-auto flex items-center gap-2">
                        <div className="hidden md:flex items-center gap-2">
                            <Button
                                onClick={toggleMode}
                                aria-pressed={isFull}
                                title={
                                    isFull
                                        ? "สลับเป็นโหมดกะทัดรัด"
                                        : "สลับเป็นโหมดเต็ม"
                                }
                                className={[
                                    "h-11 px-4 rounded-xl inline-flex items-center gap-2 transition-colors",
                                    isFull
                                        ? "bg-emerald-600/90 text-white shadow"
                                        : "bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800/70",
                                ].join(" ")}
                            >
                                <span className="relative inline-flex w-5 h-5 overflow-hidden">
                                    <AnimatePresence
                                        mode="wait"
                                        initial={false}
                                    >
                                        {isFull ? (
                                            <motion.span
                                                key="rows"
                                                initial={{
                                                    y: 16,
                                                    opacity: 0,
                                                    rotate: -10,
                                                }}
                                                animate={{
                                                    y: 0,
                                                    opacity: 1,
                                                    rotate: 0,
                                                }}
                                                exit={{
                                                    y: -16,
                                                    opacity: 0,
                                                    rotate: 10,
                                                }}
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 500,
                                                    damping: 30,
                                                    mass: 0.6,
                                                }}
                                                className="absolute inset-0 grid place-items-center"
                                            >
                                                <Rows size={18} />
                                            </motion.span>
                                        ) : (
                                            <motion.span
                                                key="grid"
                                                initial={{
                                                    y: 16,
                                                    opacity: 0,
                                                    rotate: -10,
                                                }}
                                                animate={{
                                                    y: 0,
                                                    opacity: 1,
                                                    rotate: 0,
                                                }}
                                                exit={{
                                                    y: -16,
                                                    opacity: 0,
                                                    rotate: 10,
                                                }}
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 500,
                                                    damping: 30,
                                                    mass: 0.6,
                                                }}
                                                className="absolute inset-0 grid place-items-center"
                                            >
                                                <LayoutGrid size={18} />
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </span>
                            </Button>
                        </div>

                        {/* Filter */}
                        <div className="relative">
                            <Button
                                className="h-11 rounded-xl border border-white/10 bg-zinc-900/60 text-zinc-200"
                                onClick={() => setFilterOpen((v) => !v)}
                            >
                                <Filter size={18} />
                                <span className="hidden sm:inline">
                                    ตัวกรอง
                                </span>
                                <ChevronDown size={18} />
                            </Button>
                            <AnimatePresence>
                                {filterOpen && (
                                    <motion.div
                                        key="filter"
                                        initial="hidden"
                                        animate="show"
                                        exit="exit"
                                        variants={dropVar}
                                        className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-white/10 bg-zinc-900/80 p-3 shadow-xl backdrop-blur"
                                    >
                                        <div className="mb-2 flex items-center gap-2">
                                            <Search
                                                size={14}
                                                className="opacity-60"
                                            />
                                            <span className="text-[13px] md:text-[14px] text-zinc-400">
                                                เลือกแท็กได้หลายอัน
                                            </span>
                                        </div>
                                        <div className="flex max-h-56 flex-wrap gap-2 overflow-auto rounded-xl border border-white/10 bg-zinc-900/40 p-2">
                                            {allTags.map((t) => {
                                                const active =
                                                    activeTags.includes(t);
                                                return (
                                                    <button
                                                        key={t}
                                                        onClick={() =>
                                                            toggleTag(t)
                                                        }
                                                        className={`group inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] md:text-[14px] transition ${
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
                                                className="text-[13px] md:text-[14px] text-zinc-400 hover:text-zinc-200"
                                            >
                                                ล้างทั้งหมด
                                            </button>
                                            <Button
                                                className="h-11 rounded-xl bg-zinc-100/5 text-zinc-200 hover:bg-zinc-100/10"
                                                onClick={() =>
                                                    setFilterOpen(false)
                                                }
                                            >
                                                เสร็จสิ้น
                                            </Button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Mobile search */}
                <div className="block border-t border-white/10 px-4 pb-3 pt-2 md:hidden">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
                                size={18}
                            />
                            <div
                                className="
                  w-full rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur
                  px-3 py-2 pr-3 pl-9 flex items-center gap-2
                  outline-none ring-0 transition-all duration-200 ease-out
                  focus-within:border-emerald-500/50 focus-within:shadow-[0_0_15px_rgba(16,185,129,0.25)]
                "
                            >
                                {tiktokUrl && (
                                    <TikTokBadge onClear={clearTikTok} />
                                )}
                                <input
                                    className="min-w-0 flex-1 bg-transparent text-[15px] leading-[1.6] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                                    placeholder={
                                        tiktokUrl
                                            ? "ใส่ชื่อของเพื่อค้นหา"
                                            : "แปะลิงก์ tiktok หรือ ชื่อของเพื่อค้นหา"
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

                        <div className="shrink-0">
                            <Button
                                onClick={toggleMode}
                                aria-pressed={isFull}
                                title={
                                    isFull
                                        ? "สลับเป็นโหมดกะทัดรัด"
                                        : "สลับเป็นโหมดเต็ม"
                                }
                                className={[
                                    "h-10 px-3 rounded-xl inline-flex items-center gap-2 transition-colors",
                                    isFull
                                        ? "bg-emerald-600/90 text-white shadow"
                                        : "bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800/70",
                                ].join(" ")}
                            >
                                <span className="relative inline-flex w-5 h-5 overflow-hidden">
                                    <AnimatePresence
                                        mode="wait"
                                        initial={false}
                                    >
                                        {isFull ? (
                                            <motion.span
                                                key="rows-m"
                                                initial={{ y: 12, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                exit={{ y: -12, opacity: 0 }}
                                                transition={{ duration: 0.18 }}
                                                className="absolute inset-0 grid place-items-center"
                                            >
                                                <Rows size={18} />
                                            </motion.span>
                                        ) : (
                                            <motion.span
                                                key="grid-m"
                                                initial={{ y: 12, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                exit={{ y: -12, opacity: 0 }}
                                                transition={{ duration: 0.18 }}
                                                className="absolute inset-0 grid place-items-center"
                                            >
                                                <LayoutGrid size={18} />
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </span>
                            </Button>
                        </div>
                    </div>
                </div>
            </motion.header>

            {/* Grid */}
            <motion.main
                className="mx-auto max-w-6xl px-4 py-6 md:px-6"
                variants={sectionVar}
            >
                {loading ? (
                    <motion.div
                        className={gridClass}
                        variants={gridVar(0.05)}
                        initial="hidden"
                        animate="show"
                    >
                        {Array.from({
                            length: cardMode === "compact" ? 12 : 6,
                        }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-2xl border border-white/10 bg-zinc-900/40 h-48 md:h-60 animate-pulse"
                            />
                        ))}
                    </motion.div>
                ) : (
                    <div className={gridClass}>
                        {items.map((item) => {
                            const gif = !!gifOn[item._id];
                            const m = merchantInfo(item.affiliateUrl);

                            const d = new Date(item.publishedAt);
                            const dateText = `${d
                                .getDate()
                                .toString()
                                .padStart(2, "0")}/${(d.getMonth() + 1)
                                .toString()
                                .padStart(2, "0")}/${d
                                .getFullYear()
                                .toString()
                                .slice(-2)}`;

                            if (cardMode === "compact") {
                                /* ------------------------ COMPACT CARD ------------------------ */
                                return (
                                    <motion.div
                                        variants={cardVar(8)}
                                        key={item._id}
                                    >
                                        <Card className="overflow-hidden relative group">
                                            <div
                                                className="relative aspect-[4/5] md:aspect-[1/1] w-full"
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
                                                aria-label="พรีวิว GIF"
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

                                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-black/75" />

                                                {item.productGif &&
                                                    !canHover &&
                                                    (gif ? (
                                                        // เล่น GIF อยู่: โชว์คะแนนแทนปุ่ม "หยุด" แต่ยังแตะเพื่อหยุดได้
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleGif(
                                                                    item._id
                                                                );
                                                            }}
                                                            className="absolute top-2 right-2 z-20 md:hidden"
                                                            aria-label="หยุด GIF"
                                                        >
                                                            <ScoreBadge
                                                                value={
                                                                    item.rating ||
                                                                    0
                                                                }
                                                                absolute={false}
                                                            />
                                                        </button>
                                                    ) : (
                                                        // ยังไม่เล่น: โชว์ "แตะ"
                                                        <MobileGifHint
                                                            playing={false}
                                                            onToggle={() =>
                                                                toggleGif(
                                                                    item._id
                                                                )
                                                            }
                                                            placement="tr"
                                                        />
                                                    ))}

                                                {/* bottom minimal */}
                                                <div className="absolute bottom-0 left-0 right-0 z-10 p-3 flex flex-col gap-1.5">
                                                    <h3 className="text-[14px] md:text-[16px] font-semibold text-[var(--text-primary)] leading-[1.35] line-clamp-2">
                                                        {item.title}
                                                    </h3>

                                                    <div className="flex items-center gap-2 text-[12px] md:text-[13px] text-[var(--text-tertiary)]">
                                                        {(item.tags || [])
                                                            .slice(0, 3)
                                                            .map((t) => (
                                                                <span
                                                                    key={t}
                                                                    className="text-[13px] md:text-[14px] text-[var(--text-tertiary)] bg-white/10 px-2 py-[2px] rounded-full"
                                                                >
                                                                    #{t}
                                                                </span>
                                                            ))}
                                                    </div>

                                                    {/* quick actions (compact) — ให้พื้นที่ไม่บังปุ่ม */}
                                                    <div className="mt-2 flex items-center gap-2">
                                                        {item.affiliateUrl && (
                                                            <a
                                                                href={`/go?u=${encodeURIComponent(
                                                                    item.affiliateUrl
                                                                )}`}
                                                                target="_blank"
                                                                rel="nofollow noopener noreferrer"
                                                                className={
                                                                    (m as any)
                                                                        .className +
                                                                    " inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-[12px] md:text-[13px]"
                                                                }
                                                                title={m.label}
                                                            >
                                                                {m.label}{" "}
                                                                <LinkIcon
                                                                    size={14}
                                                                    className="ml-1"
                                                                />
                                                            </a>
                                                        )}
                                                        <a
                                                            href={
                                                                item.reviewUrl
                                                            }
                                                            target="_blank"
                                                            className="inline-flex h-8 items-center justify-center rounded-lg bg-white/12 hover:bg-white/20 px-2.5 text-[12px] md:text-[13px]"
                                                        >
                                                            คลิป{" "}
                                                            <ExternalLink
                                                                size={14}
                                                                className="ml-1"
                                                            />
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    </motion.div>
                                );
                            }

                            /* -------------------------- FULL CARD --------------------------- */
                            return (
                                <motion.div
                                    variants={cardVar(10)}
                                    key={item._id}
                                >
                                    <Card className="overflow-hidden relative group">
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

                                            {/* ✅ Hint มือถือ (full → bottom-right) */}
                                            {item.productGif && !canHover && (
                                                <MobileGifHint
                                                    playing={gif}
                                                    onToggle={() =>
                                                        toggleGif(item._id)
                                                    }
                                                    placement="br"
                                                />
                                            )}

                                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/85" />
                                            <div className="absolute top-2 left-2 z-10 flex items-center gap-2 text-[13px] md:text-[14px] text-white/80">
                                                <Badge className="!text-[13px] md:!text-[14px] bg-black/50">
                                                    {item.platform}
                                                </Badge>
                                                <span>•</span>
                                                <time className="text-[13px] md:text-[14px] opacity-80">
                                                    {dateText}
                                                </time>
                                            </div>
                                            <ScoreBadge
                                                value={item.rating || 0}
                                            />

                                            <div className="absolute bottom-0 left-0 right-0 z-10 p-4 flex flex-col gap-2">
                                                <h3 className="text-[18px] md:text-[22px] font-semibold text-[var(--text-primary)] leading-[1.45] line-clamp-2">
                                                    {item.title}
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    {(item.tags || [])
                                                        .slice(0, 3)
                                                        .map((t) => (
                                                            <span
                                                                key={t}
                                                                className="text-[13px] md:text-[14px] text-[var(--text-tertiary)] bg-white/10 px-2 py-[2px] rounded-full"
                                                            >
                                                                #{t}
                                                            </span>
                                                        ))}
                                                </div>
                                            </div>
                                        </div>

                                        {(item.pros?.length ||
                                            item.cons?.length) && (
                                            <div className="p-4 bg-zinc-900/80 backdrop-blur">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <div className="text-[14px] md:text-[15px] mb-1 flex items-center gap-1 text-[var(--accent-teal)]">
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
                                                                        className="text-[14px] md:text-[15px] leading-[1.65] text-[var(--text-secondary)]"
                                                                    >
                                                                        • {p}
                                                                    </li>
                                                                ))}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <div className="text-[14px] md:text-[15px] mb-1 flex items-center gap-1 text-[var(--accent-pink)]">
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
                                                                        className="text-[14px] md:text-[15px] leading-[1.65] text-[var(--text-secondary)]"
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
                                                        href={`/go?u=${encodeURIComponent(
                                                            item.affiliateUrl
                                                        )}`}
                                                        target="_blank"
                                                        rel="nofollow noopener noreferrer"
                                                        className={
                                                            (m as any)
                                                                .className +
                                                            " h-12 px-4 rounded-xl text-[15px] md:text-[17px] font-semibold flex-1"
                                                        }
                                                    >
                                                        {m.label}{" "}
                                                        <LinkIcon size={18} />
                                                    </Button>
                                                    <Button
                                                        as="a"
                                                        href={item.reviewUrl}
                                                        target="_blank"
                                                        className="h-11 px-4 bg-white/10 text-white hover:bg-white/20 text-[15px] md:text-[17px] flex-[0.5]"
                                                    >
                                                        คลิป{" "}
                                                        <ExternalLink
                                                            size={16}
                                                        />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </motion.main>

            <motion.footer
                className="mt-16 border-t border-[var(--border-subtle)]/80"
                variants={sectionVar}
            >
                <div className="mx-auto max-w-6xl px-4 md:px-6 py-10 grid gap-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Brand + disclosure */}
                    <section className="space-y-3">
                        <h3 className="text-[20px] md:text-[22px] leading-tight text-[var(--text-primary)] font-semibold tracking-[0.005em]">
                            Description
                        </h3>

                        <p className="text-[15px] md:text-[16.5px] leading-[1.9] text-[var(--text-tertiary)]">
                            เว็บรวมของผมที่สั่งเอง ใช้เอง รีวิวเอง
                            ความเห็นทั้งหมดมาจากผมเอง ของบางส่วนเป็น Affiliate
                            ซึ่งช่วยซัพพอร์ตคอนเทนต์ของผมโดยราคาของจะไม่ได้แพงขึ้น
                            และ
                            <span className="font-semibold text-amber-400 ml-1">
                                อย่าลืม!
                            </span>{" "}
                            ตรวจสอบสเปก, ราคา, สต็อกให้รอบคอบก่อนซื้อ
                            เว็บไซต์ไม่รับผิดชอบความเสียหายใด ๆ
                            หากของไม่ตรงปกเพราะผมสั่งผมก็เจอไม่ตรงเยอะ ;w;
                        </p>

                        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2 text-[14px] md:text-[15px] text-amber-300 leading-relaxed">
                            💡 <span className="font-semibold">คำแนะนำ:</span>{" "}
                            ควรถ่ายวิดีโอระหว่างแกะของ
                            เผื่อชำรุด/ไม่ตรงปกจะได้ส่งเคลมง่ายขึ้น
                        </div>

                        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/60 backdrop-blur px-3.5 py-3 flex justify-between">
                            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)]/70 px-2.5 py-1 text-[12.5px] md:text-[13.5px] text-[var(--text-secondary)]">
                                <span className="h-[6px] w-[6px] rounded-full bg-emerald-400/90" />
                                สั่งเอง
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)]/70 px-2.5 py-1 text-[12.5px] md:text-[13.5px] text-[var(--text-secondary)]">
                                <span className="h-[6px] w-[6px] rounded-full bg-amber-400/90" />
                                ใช้เอง
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)]/70 px-2.5 py-1 text-[12.5px] md:text-[13.5px] text-[var(--text-secondary)]">
                                <span className="h-[6px] w-[6px] rounded-full bg-red-400/90" />
                                รีวิวเอง
                            </span>
                        </div>
                    </section>

                    {/* Socials */}
                    <section>
                        <h4 className="text-[14px] md:text-[15px] text-[var(--text-secondary)] font-semibold mb-3">
                            ติดตาม
                        </h4>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                            <a
                                href="https://www.instagram.com/ikk1st/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]/60 hover:bg-[var(--surface-2)] px-3.5 py-2 transition"
                            >
                                <span className="inline-flex items-center gap-2 text-[14px] md:text-[15px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                                    Instagram
                                </span>
                                <ExternalLink
                                    size={16}
                                    className="opacity-50 group-hover:opacity-80"
                                />
                            </a>
                            <a
                                href="https://www.tiktok.com/@ikk1st"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]/60 hover:bg-[var(--surface-2)] px-3.5 py-2 transition"
                            >
                                <span className="inline-flex items-center gap-2 text-[14px] md:text-[15px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                                    TikTok
                                </span>
                                <ExternalLink
                                    size={16}
                                    className="opacity-50 group-hover:opacity-80"
                                />
                            </a>
                            <a
                                href="https://www.youtube.com/@ikkist7277"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]/60 hover:bg-[var(--surface-2)] px-3.5 py-2 transition"
                            >
                                <span className="inline-flex items-center gap-2 text-[14px] md:text-[15px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                                    YouTube
                                </span>
                                <ExternalLink
                                    size={16}
                                    className="opacity-50 group-hover:opacity-80"
                                />
                            </a>
                        </div>
                    </section>

                    {/* Contact */}
                    <section>
                        <h4 className="text-[14px] md:text=[15px] text-[var(--text-secondary)] font-semibold mb-3">
                            ติดต่อ
                        </h4>
                        <ul className="space-y-2 text-[14px] md:text-[15.5px]">
                            <li className="text-[var(--text-tertiary)]">
                                อีเมล:{" "}
                                <a
                                    className="hover:text-[var(--accent-teal)]"
                                    href="mailto:bank16211@gmail.com"
                                >
                                    bank16211@gmail.com
                                </a>
                            </li>
                        </ul>
                    </section>
                </div>

                {/* Bottom bar */}
                <div className="border-t border-[var(--border-subtle)]/80">
                    <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-[13px] md:text-[14px] text-[var(--text-tertiary)]">
                            © {year} ikkist&apos;s items — All rights reserved.
                        </span>
                        <div className="text-[13px] md:text-[14px] text-[var(--text-tertiary)]">
                            Built by{" "}
                            <a
                                href="#"
                                className="hover:text-[var(--accent-teal)]"
                            >
                                ikkist
                            </a>
                        </div>
                    </div>
                </div>
            </motion.footer>
        </motion.div>
    );
}
