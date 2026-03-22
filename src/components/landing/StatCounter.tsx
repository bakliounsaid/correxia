"use client";

import { useEffect, useRef, useState } from "react";

type StatCounterProps = {
  end: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
};

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export function StatCounter({
  end,
  prefix = "",
  suffix = "",
  duration = 1500,
  className = "",
}: StatCounterProps) {
  const [display, setDisplay] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(end);
      setHasAnimated(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasAnimated) return;
        setHasAnimated(true);

        const startTime = performance.now();

        function tick(now: number) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = easeOutQuart(progress);
          const current = Math.round(eased * end);
          setDisplay(current);

          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            setDisplay(end);
          }
        }

        requestAnimationFrame(tick);
      },
      { threshold: 0.2 },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [end, duration, hasAnimated]);

  return (
    <p ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </p>
  );
}
