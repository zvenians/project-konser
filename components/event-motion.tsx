"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export function EventMotion() {
  useEffect(() => {
    const lenis = new Lenis({ duration: 0.85, anchors: true });
    const scroll = () => ScrollTrigger.update();
    const tick = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", scroll);
    gsap.ticker.add(tick);
    const intro = gsap.fromTo(
      ".event-cover",
      { opacity: 0.82, y: 8 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
    );
    return () => {
      intro.kill();
      gsap.ticker.remove(tick);
      lenis.off("scroll", scroll);
      lenis.destroy();
    };
  }, []);
  return null;
}
