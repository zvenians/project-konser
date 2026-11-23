"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { motion, useReducedMotion } from "motion/react";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

export function SmoothScrollProvider() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.05, anchors: true });
    const update = () => ScrollTrigger.update();
    const tick = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.off("scroll", update);
      lenis.destroy();
    };
  }, []);
  return null;
}

export function WordReveal({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useGSAP(
    () => {
      if (
        !ref.current ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      const split = SplitText.create(ref.current, {
        type: "words",
        autoSplit: true,
        aria: "auto",
        onSplit(self) {
          return gsap.from(self.words, {
            yPercent: 55,
            opacity: 0,
            duration: 0.75,
            stagger: 0.055,
            ease: "power2.out",
            scrollTrigger: {
              trigger: ref.current,
              start: "top 86%",
              once: true,
            },
          });
        },
      });
      return () => split.revert();
    },
    { scope: ref },
  );
  return (
    <h2 ref={ref} className={className}>
      {children}
    </h2>
  );
}

export function EditorialCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={reduce ? { opacity: 1, y: 0 } : undefined}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={
        reduce ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
      }
      whileHover={reduce ? undefined : { y: -3, scale: 1.012 }}
    >
      {children}
    </motion.div>
  );
}

export function HeroEntrance({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce ? { duration: 0 } : { duration: 0.85, ease: [0.22, 1, 0.36, 1] }
      }
    >
      {children}
    </motion.div>
  );
}
