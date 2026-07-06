"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Centered modal popup, recreated in React from the Lawbrokr popup style
 * (lawbrokr-js/src/popup.js) — same chrome, sizing, animation and behavior,
 * but as a Next.js client component instead of the vanilla-JS injector.
 *
 * Behavior mirrored from the original:
 *  - reveal after a fixed delay
 *  - fade + scale entrance / exit (260ms)
 *  - close via X, dismiss link, backdrop click, or Escape
 *  - body scroll lock while open
 *
 * Note: for this demo the popup appears on every page load — there is no
 * dismissal/suppression persistence.
 */

const INTAKE_URL = "https://steinberggillett.lawbrokr.com/hiller-comerford";
const ANIM_MS = 260;
const REVEAL_DELAY_MS = 4000;

// Popup content/theme (the original fetches this from an API; here it is
// configured for Hiller Comerford and points at the intake funnel).
const CONFIG = {
  logoUrl: "/hc-logo.webp",
  heading: "Injured or Disabled?",
  paragraph:
    "Get a free, no-obligation case evaluation from our Personal Injury and Social Security Disability team. We can usually set up appointments within one business day.",
  buttons: [{ text: "Get a free case evaluation", url: INTAKE_URL }],
  dismissText: "No thanks, just browsing!",
  backgroundColor: "#FFFFFF",
  textColor: "#19191a",
  buttonColor: "#4e2f8c",
  buttonTextColor: "#FFFFFF",
};

export default function IntakePopup() {
  const [open, setOpen] = useState(false); // in the DOM
  const [shown, setShown] = useState(false); // at final (opacity 1) state

  // Reveal after the delay (shows on every page load for this demo).
  useEffect(() => {
    const t = window.setTimeout(() => setOpen(true), REVEAL_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Once mounted, flip to the shown state on the next frame so the CSS
  // transition runs (fade + scale in).
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const close = useCallback(() => {
    setShown(false); // reverse transition
    window.setTimeout(() => setOpen(false), ANIM_MS);
  }, []);

  // Scroll lock + Escape-to-close while open.
  useEffect(() => {
    if (!open) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <>
      <div
        className="hc-popup-overlay"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        style={{ opacity: shown ? 1 : 0 }}
      >
        <div
          className="hc-popup-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hc-popup-heading"
          style={{
            background: CONFIG.backgroundColor,
            opacity: shown ? 1 : 0,
            transform: shown
              ? "scale(1) translateY(0)"
              : "scale(0.96) translateY(8px)",
          }}
        >
          <button
            type="button"
            aria-label="Close"
            className="hc-popup-close"
            onClick={close}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M1.5 1.5 L14.5 14.5 M14.5 1.5 L1.5 14.5"
                stroke={CONFIG.textColor}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div className="hc-popup-body">
            {CONFIG.logoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="hc-popup-logo" src={CONFIG.logoUrl} alt="" />
            )}

            <h2
              id="hc-popup-heading"
              className="hc-popup-heading"
              style={{ color: CONFIG.textColor }}
            >
              {CONFIG.heading}
            </h2>

            {CONFIG.paragraph && (
              <p
                className="hc-popup-paragraph"
                style={{ color: CONFIG.textColor }}
              >
                {CONFIG.paragraph}
              </p>
            )}

            <div className="hc-popup-btn-group">
              {CONFIG.buttons.map((btn) => (
                <a
                  key={btn.text}
                  className="hc-popup-btn"
                  href={btn.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: CONFIG.buttonColor,
                    color: CONFIG.buttonTextColor,
                  }}
                >
                  {btn.text}
                </a>
              ))}

              <a
                className="hc-popup-dismiss"
                role="button"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  close();
                }}
                style={{ color: CONFIG.textColor }}
              >
                {CONFIG.dismissText}
              </a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .hc-popup-overlay {
          position: fixed;
          inset: 0;
          background: rgba(49, 49, 49, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2147483645;
          padding: 20px;
          box-sizing: border-box;
          overflow: hidden;
          transition: opacity ${ANIM_MS}ms ease;
        }
        .hc-popup-card {
          position: relative;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 55px 48px 48px 48px;
          width: 564px;
          max-width: 100%;
          max-height: calc(100vh - 40px);
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(49, 49, 49, 0.2);
          overflow-y: auto;
          transition: opacity ${ANIM_MS}ms ease,
            transform ${ANIM_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .hc-popup-body {
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 26px;
          width: 100%;
        }
        .hc-popup-logo {
          display: block;
          width: auto;
          height: 44px;
          max-width: 240px;
          object-fit: contain;
        }
        .hc-popup-heading {
          margin: 0;
          width: 100%;
          font-family: var(--font-domine), Georgia, serif;
          font-weight: 700;
          font-size: 34px;
          line-height: 110%;
          letter-spacing: 0.01em;
          text-align: center;
        }
        .hc-popup-paragraph {
          margin: 0;
          width: 100%;
          font-family: var(--font-montserrat), Arial, sans-serif;
          font-weight: 400;
          font-size: 18px;
          line-height: 140%;
          text-align: center;
          opacity: 0.9;
        }
        .hc-popup-btn-group {
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 12px;
          width: 100%;
          margin-top: 4px;
        }
        .hc-popup-btn {
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px 40px;
          width: 340px;
          max-width: 100%;
          height: 60px;
          border: none;
          border-radius: 999px;
          font-family: var(--font-montserrat), Arial, sans-serif;
          font-weight: 700;
          font-size: 18px;
          line-height: 120%;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }
        .hc-popup-btn:hover {
          opacity: 0.85;
        }
        .hc-popup-dismiss {
          display: inline-block;
          margin-top: 6px;
          padding: 10px 8px;
          font-family: var(--font-montserrat), Arial, sans-serif;
          font-weight: 400;
          font-size: 16px;
          line-height: 140%;
          text-decoration: underline;
          text-align: center;
          cursor: pointer;
          background: transparent;
          opacity: 0.85;
        }
        .hc-popup-dismiss:hover {
          opacity: 1;
        }
        .hc-popup-close {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 44px;
          height: 44px;
          padding: 0;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.75;
          transition: opacity 0.2s ease;
        }
        .hc-popup-close:hover {
          opacity: 1;
        }
        @media (max-width: 600px) {
          .hc-popup-card {
            width: 92vw;
            max-width: 374px;
            padding: 44px 28px;
          }
          .hc-popup-body { gap: 22px; }
          .hc-popup-heading { font-size: 28px; }
          .hc-popup-paragraph { font-size: 16px; }
          .hc-popup-btn { width: 100%; max-width: 340px; height: 58px; }
          .hc-popup-dismiss { font-size: 16px; }
        }
      `}</style>
    </>
  );
}
