// One-off clone script: captures a self-contained snapshot of the live
// homepage (inlining CSS + images as data URIs) and writes it to public/clone.html.
//
//   node scripts/clone.mjs
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
  // Let lazy assets / fonts settle.
  await new Promise((r) => setTimeout(r, 3000));

  // Trigger lazy-loaded images by scrolling through the page.
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = window.innerHeight;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        y += step;
        if (y >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 120);
    });
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

    // --- strip scripts / noscript / preloads ---
    document.querySelectorAll("script, noscript").forEach((s) => s.remove());
    document
      .querySelectorAll(
        'link[rel="preload"], link[rel="prefetch"], link[rel="modulepreload"], link[rel="preconnect"], link[rel="dns-prefetch"]'
      )
      .forEach((el) => el.remove());

    // --- remove cookie/chat/admin widgets ---
    document
      .querySelectorAll(
        '#wpadminbar, [class*="cookie"], [class*="consent"], [class*="gdpr"], [id*="cookie"], [id*="consent"], [class*="chat-widget"], [id*="hubspot"], [id*="intercom"], [id*="crisp"], [id*="tawk"], [class*="drift"]'
      )
      .forEach((el) => el.remove());

    // --- inline stylesheets ---
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

    // --- inline <style> url() refs ---
    for (const style of document.querySelectorAll("style")) {
      if (style.textContent && style.textContent.includes("url(")) {
        style.textContent = await inlineCssUrls(style.textContent, baseUrl);
      }
    }

    // --- inline images ---
    const imageCache = new Map();
    for (const img of document.querySelectorAll("img")) {
      img.removeAttribute("loading");
      img.removeAttribute("decoding");
      const src = img.currentSrc || img.src;
      img.removeAttribute("srcset");
      img.removeAttribute("imageSrcSet");
      img.removeAttribute("imageSizes");
      if (!src || src.startsWith("data:")) continue;
      try {
        if (imageCache.has(src)) {
          img.src = imageCache.get(src);
        } else {
          const dataUri = await toDataUri(src);
          imageCache.set(src, dataUri);
          img.src = dataUri;
        }
      } catch {}
    }
    document.querySelectorAll("picture source").forEach((s) => s.remove());

    // --- inline inline-style background images ---
    for (const el of document.querySelectorAll("[style]")) {
      const bg = el.style.backgroundImage;
      if (bg && bg.includes("url(") && !bg.includes("data:")) {
        const um = bg.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
        if (um) {
          try {
            const absoluteUrl = new URL(um[1], baseUrl).toString();
            const dataUri = await toDataUri(absoluteUrl);
            el.style.backgroundImage = `url("${dataUri}")`;
          } catch {}
        }
      }
    }

    // --- base tag so any remaining relative links resolve ---
    if (!document.querySelector("base")) {
      const base = document.createElement("base");
      base.href = baseUrl;
      base.target = "_blank";
      document.head.prepend(base);
    }

    return "<!DOCTYPE html>" + document.documentElement.outerHTML;
  });

  mkdirSync(new URL("../public", import.meta.url), { recursive: true });
  writeFileSync(OUT, html, "utf-8");
  console.log(`Wrote ${OUT.pathname} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
} finally {
  await browser.close();
}
