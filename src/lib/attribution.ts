"use client";

// First-touch marketing attribution — captured once per visitor and kept
// for the life of the browser's storage, so "which campaign actually
// produced this order" can be answered even if the purchase happens days
// after the ad click. First-touch (not last-touch) on purpose: it answers
// "what got this customer in the door," which is what campaign ROAS needs.

export type Attribution = {
  source: string; // "google", "instagram", "facebook", "whatsapp", "direct", ...
  medium: string; // "cpc", "social", "organic", "referral", "none"
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrer: string | null;
  landingPage: string;
  capturedAt: string;
};

const KEY = "apa-attribution";

const SOCIAL_HOSTS: Record<string, string> = {
  "instagram.com": "instagram",
  "facebook.com": "facebook",
  "l.facebook.com": "facebook",
  "lm.facebook.com": "facebook",
  "tiktok.com": "tiktok",
  "t.co": "twitter",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "wa.me": "whatsapp",
  "api.whatsapp.com": "whatsapp",
};

const SEARCH_HOSTS = ["google.", "bing.", "yahoo.", "duckduckgo."];

function inferFromReferrer(referrer: string): { source: string; medium: string } {
  if (!referrer) return { source: "direct", medium: "none" };
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (SOCIAL_HOSTS[host]) return { source: SOCIAL_HOSTS[host], medium: "social" };
    if (SEARCH_HOSTS.some((h) => host.includes(h))) return { source: host.split(".")[0], medium: "organic" };
    return { source: host, medium: "referral" };
  } catch {
    return { source: "direct", medium: "none" };
  }
}

function capture(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source");
  const referrerGuess = inferFromReferrer(document.referrer);

  return {
    source: utmSource || referrerGuess.source,
    medium: params.get("utm_medium") || referrerGuess.medium,
    campaign: params.get("utm_campaign"),
    content: params.get("utm_content"),
    term: params.get("utm_term"),
    referrer: document.referrer || null,
    landingPage: window.location.pathname,
    capturedAt: new Date().toISOString(),
  };
}

/** Returns the visitor's first-touch attribution, capturing it on the very first call. */
export function getAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return JSON.parse(existing) as Attribution;
    const fresh = capture();
    localStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return null;
  }
}
