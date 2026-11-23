"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { priceText, sizeNames, slugify, type Product } from "@/lib/products";
import { ChevronIcon, SearchIcon } from "./icons";
import Photo from "./Photo";
import { useProducts } from "./Store";

/** `?category=new`: products added in the last NEW_DAYS days. */
export const NEW_FILTER = "new";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Category chips. A black pill slides to the chosen chip, and the row scrolls
 * so the chosen chip is in view (it's off-screen on phones for later categories).
 */
export function FilterChips({ active, showNew }: { active?: string; showNew?: boolean }) {
  const { categories } = useProducts();
  const nav = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const moved = useRef(false);
  const chips: { label: string; href: string; key: string }[] = [
    { label: "All", href: "/", key: "All" },
    ...(showNew ? [{ label: "New", href: `/?category=${NEW_FILTER}`, key: NEW_FILTER }] : []),
    ...categories.map((c) => ({ label: c, href: `/?category=${slugify(c)}`, key: c })),
  ];

  useIsoLayoutEffect(() => {
    const el = nav.current;
    if (!el) return;
    const place = () => {
      const chip = el.querySelector<HTMLElement>("[aria-current='page']");
      setPill(chip ? { x: chip.offsetLeft, y: chip.offsetTop, w: chip.offsetWidth, h: chip.offsetHeight } : null);
    };
    place();
    const chip = el.querySelector<HTMLElement>("[aria-current='page']");
    if (chip && el.scrollWidth > el.clientWidth) {
      const smooth = moved.current && !matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2, behavior: smooth ? "smooth" : "auto" });
    }
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active, categories.length, showNew]);
  // the first placement jumps; later ones glide
  useEffect(() => {
    if (pill) moved.current = true;
  }, [pill]);

  return (
    <nav
      ref={nav}
      aria-label="Filter by category"
      className="no-scrollbar relative -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pt-0.5 pb-1 sm:-mx-6 sm:px-6 lg:flex-wrap lg:overflow-visible"
    >
      {pill && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-0 left-0 rounded-full bg-fg ${moved.current ? "transition-[transform,width,height] duration-500 ease-out-expo" : ""}`}
          style={{ transform: `translate(${pill.x}px, ${pill.y}px)`, width: pill.w, height: pill.h }}
        />
      )}
      {chips.map((c) => {
        const on = c.key === active;
        return (
          <Link
            key={c.key}
            href={c.href}
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={`relative shrink-0 rounded-full border border-fg px-3.5 py-2 text-xs font-semibold tracking-[0.06em] whitespace-nowrap uppercase transition-[color,background-color,scale] duration-300 active:scale-95 ${
              on ? (pill ? "text-white" : "bg-fg text-white") : "hover:bg-soft"
            }`}
          >
            {c.key === NEW_FILTER && <span aria-hidden="true" className={`mr-1.5 inline-block size-1.5 -translate-y-px rounded-full align-middle ${on ? "bg-white" : "bg-fg"}`} />}
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Every photo of a product: main, extra views, then the other colours. */
export const photosOf = (p: Product) => [...new Set([p.image, ...p.gallery, ...p.colorImages.filter((f): f is string => !!f)])];

/** Card photo: swipe left/right (or use the arrows on desktop) to see the other photos. */
function CardPhotos({ p, eager }: { p: Product; eager: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const files = photosOf(p);
  const many = files.length > 1;
  const href = `/product/${p.id}/`;

  const go = (i: number) => {
    const t = track.current;
    if (!t) return;
    const n = (i + files.length) % files.length;
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    t.scrollTo({ left: n * t.clientWidth, behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <div className="group/photos relative">
      <div
        ref={track}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
        data-testid="card-photos"
      >
        {files.map((f, i) => (
          <Link
            key={f + i}
            href={href}
            tabIndex={i === 0 ? undefined : -1}
            aria-hidden={i === 0 ? undefined : true}
            className="block size-full shrink-0 basis-full snap-center overflow-hidden"
          >
            <Photo
              file={f}
              alt={i === 0 ? p.name : ""}
              eager={eager && i === 0}
              className={`size-full object-contain transition-transform duration-700 ease-out-expo group-hover:scale-[1.03] ${p.soldOut ? "sold-img" : ""}`}
            />
          </Link>
        ))}
      </div>
      {p.soldOut ? <SoldBadge /> : p.isNew && <NewBadge />}
      {many && (
        <>
          {(["prev", "next"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => go(index + (d === "prev" ? -1 : 1))}
              aria-label={`${d === "prev" ? "Previous" : "Next"} photo of ${p.name}`}
              className={`absolute top-1/2 -mt-4 hidden size-8 place-items-center rounded-full border border-fg bg-white/90 opacity-0 transition-opacity group-hover/photos:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:grid ${d === "prev" ? "left-1.5" : "right-1.5"}`}
            >
              <ChevronIcon dir={d === "prev" ? "left" : "right"} size={12} />
            </button>
          ))}
          <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1" aria-hidden="true">
            {files.map((f, i) => (
              <span key={f + i} className={`block size-1.5 rounded-full transition-colors ${i === index ? "bg-fg" : "bg-line"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ProductCard({ p, i }: { p: Product; i: number }) {
  return (
    <article className="reveal group" style={{ "--d": `${(i % 4) * 50}ms` } as React.CSSProperties} data-testid="card" data-sold={p.soldOut || undefined}>
      <CardPhotos p={p} eager={i < 4} />
      <Link href={`/product/${p.id}/`} className="block" tabIndex={-1}>
        <h2 className="mt-2.5 mb-0.5 text-[13px] leading-snug font-semibold tracking-[0.02em] uppercase underline-offset-3 group-hover:underline">{p.name}</h2>
        <p className="text-[13px] tabular-nums">
          {p.soldOut ? <span className="sr-only">Sold out. </span> : p.isNew && <span className="sr-only">New. </span>}
          <span className={p.soldOut ? "text-muted line-through" : ""}>{priceText(p)}</span>
        </p>
        {sizeNames(p).length > 0 && (
          <p className="text-xs text-muted">
            {sizeNames(p).length > 1 ? "Sizes" : "Size"}: {sizeNames(p).join(", ")}
          </p>
        )}
        {p.colors.length > 1 && <p className="text-xs text-muted">{p.colors.length} colours</p>}
      </Link>
    </article>
  );
}

export const SoldBadge = ({ large }: { large?: boolean }) => (
  <span
    className={`pointer-events-none absolute z-2 bg-fg font-extrabold tracking-[0.12em] text-white uppercase ${large ? "top-3 left-3 px-3 py-2 text-[13px]" : "top-2 left-2 px-2 py-1.5 text-[11px]"}`}
  >
    Sold out
  </span>
);

/** Shown for NEW_DAYS days after a product is added in the admin. */
export const NewBadge = ({ large }: { large?: boolean }) => (
  <span
    aria-hidden="true"
    className={`pointer-events-none absolute z-2 border border-fg bg-white font-extrabold tracking-[0.12em] text-fg uppercase ${large ? "top-3 left-3 px-3 py-2 text-[13px]" : "top-2 left-2 px-2 py-1.5 text-[11px]"}`}
  >
    New
  </span>
);

const GRID = "grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-4";

export function ProductGrid({ products }: { products: Product[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cards = ref.current?.querySelectorAll<HTMLElement>(".reveal:not(.in)");
    if (!cards?.length) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      cards.forEach((c) => c.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.1 },
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [products]);
  return (
    <div ref={ref} className={GRID}>
      {products.map((p, i) => (
        <ProductCard key={p.id} p={p} i={i} />
      ))}
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading products…</p>
      <div className="no-scrollbar mb-6 flex gap-2 overflow-hidden">
        {[44, 70, 84, 120, 64].map((w, i) => (
          <span key={i} className="shimmer h-[34px] shrink-0 rounded-full" style={{ width: w }} />
        ))}
      </div>
      <div className={GRID}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <div className="shimmer aspect-[4/5]" />
            <div className="shimmer mt-3 h-3 w-4/5" />
            <div className="shimmer mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShopView() {
  const { products, categories, status } = useProducts();
  const params = useSearchParams();
  const router = useRouter();
  const catSlug = params.get("category") ?? "";
  const q = (params.get("q") ?? "").trim();

  const hasNew = products.some((p) => p.isNew);
  const newOnly = catSlug === NEW_FILTER;
  const category = newOnly ? undefined : categories.find((c) => slugify(c) === catSlug);
  let items = newOnly ? products.filter((p) => p.isNew) : category ? products.filter((p) => p.category === category) : products;
  if (q) {
    const s = q.toLowerCase();
    items = items.filter((p) => [p.name, p.category, ...sizeNames(p), ...p.colors].join(" ").toLowerCase().includes(s));
  }

  useEffect(() => {
    document.title = (newOnly ? "New in — " : category ? category + " — " : q ? "Search — " : "") + "Trap House Society";
  }, [category, q, newOnly]);

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = new FormData(e.currentTarget).get("q")?.toString().trim() ?? "";
    router.push(v ? `/?q=${encodeURIComponent(v)}` : "/");
  };

  const title = q ? `Results for “${q}”` : newOnly ? "New in" : category ?? "Shop all";
  const active = q ? undefined : newOnly ? NEW_FILTER : category ?? (catSlug ? undefined : "All");

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-14 sm:px-6">
      {q && (
        <form onSubmit={onSearch} role="search" className="mt-5 flex border border-fg" key={q}>
          <label htmlFor="page-q" className="sr-only">
            Search products
          </label>
          <input id="page-q" name="q" type="search" defaultValue={q} autoComplete="off" enterKeyHint="search" className="min-w-0 flex-1 bg-white p-3.5 text-base outline-none" />
          <button type="submit" aria-label="Search" className="grid w-[54px] place-items-center bg-fg text-white">
            <SearchIcon />
          </button>
        </form>
      )}
      <h1 className="display mt-6 mb-3.5 text-[30px] sm:text-[40px]">
        {title}{" "}
        {status === "ready" && (
          <span key={items.length} className="anim-fade align-top text-sm font-medium tracking-normal text-muted normal-case [font-stretch:100%]">
            {items.length}
          </span>
        )}
      </h1>
      {status === "loading" ? (
        <GridSkeleton />
      ) : (
        <>
          <FilterChips active={active} showNew={hasNew} />
          {items.length ? (
            // a new key per filter: the cards fade up again, so the change reads as a change
            <ProductGrid key={`${catSlug}|${q}`} products={items} />
          ) : (
            <div className="anim-rise py-14 text-center">
              <p className="text-muted">
                {products.length
                  ? q
                    ? `No products match “${q}”.`
                    : newOnly
                      ? "Nothing new right now — check back soon."
                      : "Nothing here yet."
                  : "Products are unavailable right now. Please refresh in a moment."}
              </p>
              <Link href="/" className="mt-4 inline-flex min-h-12 items-center border border-fg px-5 text-sm font-bold tracking-widest uppercase hover:bg-soft">
                Shop all
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
