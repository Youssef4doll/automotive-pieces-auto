import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The small centred card the account's side doors use — forgot my password,
 * choose a new one. Same type and colours as the sign-in card, on the same
 * pale ground, with one way back.
 */
export default function AuthCard({
  eyebrow,
  title,
  sub,
  back,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  back: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[560px] items-center justify-center bg-[#f6f7fb] px-4 py-10 sm:px-8">
      <div className="w-full max-w-[480px]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-navy-900/50">{eyebrow}</p>
        <h1 className="mt-1.5 font-heading text-[1.9rem] font-extrabold leading-tight text-navy-950 sm:text-[2.2rem]">{title}</h1>
        {sub && <p className="mt-2 text-[16px] text-gray-600">{sub}</p>}
        <div className="mt-6 rounded-2xl border border-navy-900/10 bg-white p-5 shadow-[0_18px_50px_-24px_rgba(8,22,51,0.35)] sm:p-6">
          {children}
        </div>
        <p className="mt-5 text-center text-sm">
          <Link href={back.href} className="font-semibold text-navy-900 underline underline-offset-2 hover:text-red-600">
            ← {back.label}
          </Link>
        </p>
      </div>
    </div>
  );
}
