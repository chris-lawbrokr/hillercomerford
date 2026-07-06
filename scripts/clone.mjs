// One-off clone script: captures a self-contained snapshot of the live
// homepage (inlining CSS + images + backgrounds as data URIs) and writes it to
// public/clone.html.
//
//   node scripts/clone.mjs
//
// This targets an Elementor/WordPress site, which relies on JavaScript for
// entrance animations, lazy-loaded backgrounds, and reveal-on-scroll. Because
// the snapshot strips all scripts, we (1) let the live JS run, (2) scroll the
// whole page slowly to trigger every lazy loader / IntersectionObserver, then
// (3) force every element to its revealed state and inline *computed*
// backgrounds before serializing.
//
import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync } from "node:fs";

const TARGET = "https://www.hillercomerford.com/";
const OUT = new URL("../public/clone.html", import.meta.url);

const browser = await puppeteer.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
  ],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(TARGET, { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));

  // Slow, small-step scroll so every IntersectionObserver / lazy background
  // fires and every entrance animation completes.
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = Math.round(window.innerHeight / 2);
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await sleep(200);
    }
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(600);
    window.scrollTo(0, 0);
    await sleep(600);
  });
  await new Promise((r) => setTimeout(r, 2000));

  const html = await page.evaluate(async () => {
    async function toDataUri(resourceUrl) {
      try {
        const res = await fetch(resourceUrl, { mode: "cors" });
        if (!res.ok) return resourceUrl;
        const blob = await res.blob();
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(resourceUrl);
          reader.readAsDataURL(blob);
        });
      } catch {
        return resourceUrl;
      }
    }

    async function inlineCssUrls(cssText, baseUrl) {
      const urlRegex = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
      const matches = [];
      let m;
      while ((m = urlRegex.exec(cssText)) !== null) {
        if (!m[1].startsWith("data:")) matches.push({ full: m[0], url: m[1] });
      }
      for (const it of matches) {
        try {
          const absoluteUrl = new URL(it.url, baseUrl).toString();
          const dataUri = await toDataUri(absoluteUrl);
          cssText = cssText.split(it.full).join(`url("${dataUri}")`);
        } catch {}
      }
      return cssText;
    }

    const baseUrl = document.baseURI;

    // --- 1. FORCE-REVEAL: kill entrance animations & hidden states that JS
    //        would normally undo, so no section stays invisible/collapsed. ---
    const reveal = document.createElement("style");
    reveal.textContent = `
      /* WP Rocket "lazy render" applies content-visibility:auto, which
         collapses off-screen sections to a placeholder height in a static
         (no-JS) render. Force everything to render. */
      [data-wpr-lazyrender], * { content-visibility: visible !important; }
      .elementor-invisible { visibility: visible !important; }
      .elementor-element, .elementor-widget, .elementor-section, .e-con,
      .e-con-inner, .animated, [data-settings] {
        opacity: 1 !important;
        visibility: visible !important;
        transform: none !important;
        animation: none !important;
        transition: none !important;
      }
      /* Elementor image carousels / sliders collapse without JS: let them wrap. */
      .swiper-wrapper { display: flex !important; flex-wrap: wrap !important;
        transform: none !important; height: auto !important; }
      .swiper, .swiper-container { height: auto !important; }
      .swiper-slide { width: auto !important; }
    `;
    document.head.appendChild(reveal);
    document
      .querySelectorAll(".elementor-invisible")
      .forEach((el) => el.classList.remove("elementor-invisible"));
    document
      .querySelectorAll("[data-wpr-lazyrender]")
      .forEach((el) => el.removeAttribute("data-wpr-lazyrender"));
    // Clear any inline opacity/transform left mid-animation.
    document.querySelectorAll("[style]").forEach((el) => {
      if (el.style.opacity && parseFloat(el.style.opacity) < 1) el.style.opacity = "1";
      if (el.style.transform) el.style.transform = "none";
      if (el.style.visibility === "hidden") el.style.visibility = "visible";
    });

    // --- 1b. FIX CLIPPED SECTIONS: some sections carry a fixed pixel height
    //         (e.g. height:256px) that JS would normally recompute, so their
    //         content overflows and overlaps the next section. Release any
    //         block whose content is taller than its box. ---
    document
      .querySelectorAll(
        'section, footer, .elementor-section, .elementor-top-section, .e-con, .e-con-inner, [class*="section"], [class*="-wrapper"]'
      )
      .forEach((el) => {
        // Skip the hero (min-height driven) and tiny inline elements.
        if (el.scrollHeight > el.clientHeight + 8 && el.clientHeight > 0) {
          el.style.setProperty("height", "auto", "important");
          el.style.setProperty("max-height", "none", "important");
        }
      });

    // --- 2. strip scripts / noscript / preloads ---
    document.querySelectorAll("script, noscript").forEach((s) => s.remove());
    document
      .querySelectorAll(
        'link[rel="preload"], link[rel="prefetch"], link[rel="modulepreload"], link[rel="preconnect"], link[rel="dns-prefetch"]'
      )
      .forEach((el) => el.remove());

    // --- 3. remove cookie/chat/admin widgets ---
    document
      .querySelectorAll(
        '#wpadminbar, [class*="cookie"], [class*="consent"], [class*="gdpr"], [id*="cookie"], [id*="consent"], [class*="chat-widget"], [id*="hubspot"], [id*="intercom"], [id*="crisp"], [id*="tawk"], [class*="drift"], [class*="livechat"], [id*="livechat"], iframe[src*="youtube"], iframe[src*="chat"]'
      )
      .forEach((el) => el.remove());

    // --- 4. inline stylesheets ---
    const linkEls = document.querySelectorAll('link[rel="stylesheet"]');
    for (const link of linkEls) {
      const href = link.href;
      if (!href) continue;
      try {
        const res = await fetch(href);
        if (!res.ok) continue;
        let cssText = await res.text();
        cssText = await inlineCssUrls(cssText, href);
        const style = document.createElement("style");
        style.textContent = cssText;
        link.replaceWith(style);
      } catch {}
    }

    // --- 5. inline <style> url() refs ---
    for (const style of document.querySelectorAll("style")) {
      if (style.textContent && style.textContent.includes("url(")) {
        style.textContent = await inlineCssUrls(style.textContent, baseUrl);
      }
    }

    // --- 6. inline <img> ---
    const imageCache = new Map();
    async function cachedDataUri(src) {
      if (imageCache.has(src)) return imageCache.get(src);
      const dataUri = await toDataUri(src);
      imageCache.set(src, dataUri);
      return dataUri;
    }
    for (const img of document.querySelectorAll("img")) {
      img.removeAttribute("loading");
      img.removeAttribute("decoding");
      const src = img.currentSrc || img.src;
      img.removeAttribute("srcset");
      img.removeAttribute("imageSrcSet");
      img.removeAttribute("imageSizes");
      if (!src || src.startsWith("data:")) continue;
      try {
        img.src = await cachedDataUri(src);
      } catch {}
    }
    document.querySelectorAll("picture source").forEach((s) => s.remove());

    // --- 7. inline COMPUTED background images (catches JS-applied &
    //        CSS-class backgrounds, e.g. Elementor lazy backgrounds). ---
    for (const el of document.querySelectorAll("*")) {
      let bg;
      try {
        bg = getComputedStyle(el).backgroundImage;
      } catch {
        continue;
      }
      if (!bg || bg === "none" || !bg.includes("url(") || bg.includes("data:")) continue;
      const um = bg.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
      if (!um) continue;
      try {
        const absoluteUrl = new URL(um[1], baseUrl).toString();
        if (absoluteUrl.startsWith("data:")) continue;
        const dataUri = await cachedDataUri(absoluteUrl);
        if (dataUri.startsWith("data:")) {
          // preserve any layering (gradients) by swapping just the url()
          el.style.backgroundImage = bg.replace(um[0], `url("${dataUri}")`);
        }
      } catch {}
    }

    // --- 8. base tag so any remaining relative links resolve ---
    if (!document.querySelector("base")) {
      const base = document.createElement("base");
      base.href = baseUrl;
      base.target = "_blank";
      document.head.prepend(base);
    }

    // --- 9. Only CTA buttons link to the intake URL; every other link is
    //        made inert (no href) so it renders but doesn't navigate. ---
    const LINK = "https://steinberggillett.lawbrokr.com/hiller-comerford";
    const isButton = (a) => {
      const cls = (a.className || "").toString();
      if (
        /\b(animated-button|purple-button|green-button|orange-button|transparent-button|is-xlarge)\b/i.test(
          cls
        )
      )
        return true;
      // Header phone CTA is a styled pill with no class of its own.
      if (/1-866-HILLER-LAW/i.test(a.textContent)) return true;
      return false;
    };
    document.querySelectorAll("a").forEach((a) => {
      if (isButton(a)) {
        a.setAttribute("href", LINK);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
      } else {
        a.removeAttribute("href");
        a.removeAttribute("target");
        a.removeAttribute("rel");
        a.removeAttribute("onclick");
        a.setAttribute("aria-disabled", "true");
        a.style.cursor = "default";
      }
    });

    return "<!DOCTYPE html>" + document.documentElement.outerHTML;
  });

  mkdirSync(new URL("../public", import.meta.url), { recursive: true });
  writeFileSync(OUT, html, "utf-8");
  console.log(`Wrote ${OUT.pathname} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
} finally {
  await browser.close();
}
