import { Fragment } from "react";

const PROMISES: { text: string; italic: boolean }[] = [
  { text: "Sin retenciones", italic: false },
  { text: "ni comisiones", italic: true },
  { text: "Pago directo", italic: false },
  { text: "todo por escrito", italic: true },
  { text: "100% mexicana", italic: false },
];

/** Roughly how many characters one copy needs to run past a 1600px strip. */
const MIN_COPY_CHARS = 120;

/**
 * Repeats a sequence until one copy of it is wider than the widest strip, so
 * the second copy that follows it always has something to scroll into view.
 */
function fill<T extends { text: string }>(items: T[]) {
  if (!items.length) return items;
  const chars = items.reduce((total, item) => total + item.text.length + 3, 0);
  const times = Math.max(1, Math.ceil(MIN_COPY_CHARS / chars));

  return Array.from({ length: times }, () => items).flat();
}

/**
 * Two full-bleed strips that cross: the lime one repeats what the plaza
 * promises sellers, the plum one lists the real top-level categories. Each
 * track holds its text twice and slides by half its width, in opposite
 * directions, which loops without a seam; under reduced motion both stand
 * still. Screen readers get each list once: the repeats are aria-hidden.
 */
export function CrossingTapes({ categories }: { categories: string[] }) {
  const promises = fill(PROMISES);
  const names = fill((categories.length ? categories : ["Nuevo y usado"]).map((text) => ({ text })));

  return (
    <div className="relative h-[150px] overflow-clip lg:h-[220px]">
      <div className="absolute -left-10 top-7 flex h-[54px] w-[calc(100%+80px)] -rotate-3 items-center overflow-clip border-y-2 border-brand bg-accent font-display text-[24px] font-semibold tracking-[-0.02em] text-brand lg:-left-20 lg:top-11 lg:h-[78px] lg:w-[calc(100%+160px)] lg:-rotate-2 lg:text-[36px]">
        <Track gap="gap-4 pr-4 lg:gap-7 lg:pr-7">
          {(copy) =>
            promises.map((promise, index) => {
              const Text = promise.italic ? "em" : "span";

              return (
                <Fragment key={`${copy}-${index}`}>
                  <Text
                    aria-hidden={copy > 0 || index >= PROMISES.length ? "true" : undefined}
                    className={promise.italic ? "italic" : undefined}
                  >
                    {promise.text}
                  </Text>
                  <span aria-hidden="true">✦</span>
                </Fragment>
              );
            })
          }
        </Track>
      </div>

      <div className="absolute -left-10 top-[82px] flex h-11 w-[calc(100%+80px)] rotate-2 items-center overflow-clip bg-brand font-display text-[18px] font-medium text-accent lg:-left-20 lg:top-[118px] lg:h-16 lg:w-[calc(100%+160px)] lg:rotate-[1.5deg] lg:text-[26px]">
        <Track gap="gap-3.5 pr-3.5 lg:gap-6 lg:pr-6" reverse>
          {(copy) =>
            names.map((name, index) => (
              <Fragment key={`${copy}-${index}`}>
                <span aria-hidden={copy > 0 || index >= categories.length ? "true" : undefined}>{name.text}</span>
                <span aria-hidden="true" className="text-white">
                  ✦
                </span>
              </Fragment>
            ))
          }
        </Track>
      </div>
    </div>
  );
}

function Track({
  children,
  gap,
  reverse = false,
}: {
  children: (copy: number) => React.ReactNode;
  gap: string;
  reverse?: boolean;
}) {
  return (
    <div
      className={`flex w-max shrink-0 whitespace-nowrap ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}
    >
      {[0, 1].map((copy) => (
        <div className={`flex shrink-0 items-center ${gap}`} key={copy}>
          {children(copy)}
        </div>
      ))}
    </div>
  );
}
