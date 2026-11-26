"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 0.9,
      anchors: { offset: -88 },
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.92,
    });
    const update = () => ScrollTrigger.update();
    const tick = (time: number) => lenis.raf(time * 1000);
    const syncOverlayState = () => {
      const overlayOpen = Boolean(
        document.querySelector(
          "dialog[open], [role='dialog'][aria-modal='true']",
        ),
      );
      if (overlayOpen) lenis.stop();
      else lenis.start();
    };
    const observer = new MutationObserver(syncOverlayState);
    lenis.on("scroll", update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["open", "aria-modal"],
    });
    syncOverlayState();
    return () => {
      observer.disconnect();
      gsap.ticker.remove(tick);
      lenis.off("scroll", update);
      lenis.destroy();
    };
  }, []);
  return null;
}
