import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { logout } from "@/app/actions/auth";
import AuthForms from "@/components/AuthForms";
import MyGarage from "@/components/MyGarage";

export const metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthForms />;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="p-5 rounded-xl border border-gray-200 bg-white mb-4">
        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Mon compte</p>
        <p className="font-bold text-navy-950 text-lg">{user.name}</p>
        <p className="text-sm text-gray-500">{user.email}</p>
        {user.phone && <p className="text-sm text-gray-500" dir="ltr">{user.phone}</p>}
      </div>

      <MyGarage />

      <div className="flex flex-col gap-2">
        <Link href="/compte/commandes" className="px-4 py-3 rounded-lg bg-navy-900 text-white font-semibold text-center">
          Mes commandes
        </Link>
        {user.role === "ADMIN" && (
          <Link href="/admin" className="px-4 py-3 rounded-lg bg-gold-500 text-navy-950 font-semibold text-center">
            Espace admin
          </Link>
        )}
        <form action={logout}>
          <button className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-600 font-medium">
            Déconnexion
          </button>
        </form>
      </div>
    </div>
  );
}
