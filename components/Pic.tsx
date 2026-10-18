import { picAt, picSet } from "@/lib/pic";

// A picture served at the size it is shown. "upTo" is the widest it will ever be drawn, in CSS pixels; "sizes"
// tells the browser how wide it is at each screen width, as for any srcset.
export function Pic({ src, alt, upTo, sizes, className, eager, onError, ...rest }: { src: string; alt: string; upTo: number; sizes?: string; className?: string; eager?: boolean; onError?: () => void } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "sizes" | "className" | "loading" | "srcSet">) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={picAt(src, upTo)}
      srcSet={picSet(src, upTo)}
      sizes={sizes ?? `(max-width: ${upTo}px) 100vw, ${upTo}px`}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={onError}
      {...rest}
    />
  );
}
