"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions/auth";
import { IconUser } from "./icons";

export type AccountUser = { name: string; email: string; role: "CUSTOMER" | "ADMIN" };

/**
 * The avatar in the page header, as a menu rather than a link.
 *
 * A tap used to go straight to /compte/profil, which meant logging out was a
 * page load and a scroll to the bottom of that page away. Every app puts the
 * session controls one tap under the avatar, so this does too: who you are
 * signed in as, the profile, and "Se déconnecter" without leaving the page.
 */
export default function AccountMenu({ user, initials }: { user: AccountUser; initials: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label="Mon compte"
        onClick={() => setOpen((v) => !v)}
        className={`w-tap h-11 rounded-full border grid place-items-center font-display font-bold text-sm tracking-wide transition-colors ${
          open
            ? "bg-navy-900 border-navy-900 text-white"
            : "bg-slate-100 border-slate-200 text-navy-900 hover:bg-slate-200"
        }`}
      >
        {initials}
      </button>

      {open && (
        <div
          id="account-menu"
          className="absolute end-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl p-1.5"
        >
          <div className="px-3 py-2.5 border-b border-slate-100 mb-1.5">
            <p className="text-sm font-semibold text-navy-950 truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate" dir="ltr">
              {user.email}
            </p>
          </div>

          <Link
            href="/compte/profil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 min-h-tap rounded-xl text-sm text-slate-700 hover:bg-slate-50 hover:text-navy-950"
          >
            <IconUser className="text-slate-400" />
            Mon profil
          </Link>

          {user.role === "ADMIN" && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 min-h-tap rounded-xl text-sm text-slate-700 hover:bg-slate-50 hover:text-navy-950"
            >
              <IconShield className="text-slate-400" />
              Espace admin
            </Link>
          )}

          <form action={logout} className="border-t border-slate-100 mt-1.5 pt-1.5">
            <button
              className="w-full flex items-center gap-2.5 px-3 min-h-tap rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <IconLogout />
              Se déconnecter
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * The rail's own logout, so the control exists whether the customer reaches
 * for the avatar or scans the navigation.
 */
export function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <form action={logout}>
      <button
        className={`w-full flex items-center gap-3 px-3.5 min-h-tap rounded-xl text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors ${className}`}
      >
        <IconLogout className="text-slate-400" />
        Se déconnecter
      </button>
    </form>
  );
}

function IconLogout({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function IconShield({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  );
}
