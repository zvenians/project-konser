"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function EventMotion() {
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;

    const context = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .fromTo(
          ".event-cover",
          { opacity: 0.72, scale: 1.025 },
          { opacity: 1, scale: 1, duration: 0.9 },
        )
        .fromTo(
          ".event-identity > *",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.55, stagger: 0.07 },
          "-=.58",
        )
        .fromTo(
          ".event-facts",
          { opacity: 0, y: 22 },
          { opacity: 1, y: 0, duration: 0.65 },
          "-=.38",
        );

      gsap.utils
        .toArray<HTMLElement>(
          ".event-manifesto > *, .product-section-intro, .picker-rows, .contribution-tier-grid, .event-info, .event-side-info section",
        )
        .forEach((element) => {
          gsap.fromTo(
            element,
            { opacity: 0, y: 28 },
            {
              opacity: 1,
              y: 0,
              duration: 0.7,
              ease: "power3.out",
              scrollTrigger: {
                trigger: element,
                start: "top 88%",
                once: true,
              },
            },
          );
        });
    });

    return () => {
      context.revert();
    };
  }, []);
  return null;
}
