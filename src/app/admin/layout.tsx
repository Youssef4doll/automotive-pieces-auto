import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { requireAdmin } from "@/lib/session";
import { logout } from "@/app/actions/auth";
import AdminNav from "@/components/admin/AdminNav";

export const metadata = { title: "Espace admin" };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  if (!admin) redirect("/compte");

  return (
    // The admin CRM is an internal French-only tool — force LTR regardless
    // of the storefront language cookie, which may be set to Arabic (RTL).
    <div dir="ltr" lang="fr" className="min-h-screen flex bg-gray-50 text-navy-950">
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-navy-950 text-white">
        <div className="p-5 border-b border-white/10">
          <Image src="/images/logo-white.png" alt="" width={150} height={50} className="h-8 w-auto" />
        </div>
        <AdminNav />
        <div className="mt-auto p-4 border-t border-white/10 flex flex-col gap-2">
          <Link href="/" className="text-xs text-white/50 hover:text-white">← Retour au site</Link>
          <form action={logout}>
            <button className="text-xs text-white/50 hover:text-white">Déconnexion</button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-navy-950 text-white p-4 flex items-center justify-between">
          <Image src="/images/logo-white.png" alt="" width={130} height={43} className="h-7 w-auto" />
          <Link href="/" className="text-xs text-white/60">Retour au site</Link>
        </header>
        <div className="lg:hidden bg-navy-900 text-white overflow-x-auto no-scrollbar">
          <AdminNav horizontal />
        </div>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
