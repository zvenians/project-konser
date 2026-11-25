"use client";

import { useEffect } from "react";
import gsap from "gsap";

export function EventMotion() {
  useEffect(() => {
    const intro = gsap.fromTo(
      ".event-cover",
      { opacity: 0.82, y: 8 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
    );
    return () => {
      intro.kill();
    };
  }, []);
  return null;
}
