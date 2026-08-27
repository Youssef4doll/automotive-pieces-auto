import Link from "next/link";
import { getMegaMenu } from "@/lib/data/catalog";
import SectionHeading from "./SectionHeading";

const ICONS: Record<string, string> = {
  "Filtres": "🧰",
  "Freinage": "🛑",
  "Courroie, tendeur et chaine": "🔗",
  "Allumage préchauffage": "⚡",
  "Suspension": "🔩",
  "Direction et Trains roulants": "🎛️",
  "Embrayage": "⚙️",
  "Moteur": "🔧",
  "Eclairage": "💡",
  "Démarrage électrique": "🔋",
  "Capteurs et sondes": "📡",
  "Carosserie": "🚗",
  "Refroidissement moteur": "❄️",
  "Cardan et Transmission": "🌀",
  "Climatisation": "🌬️",
  "Lubrifiant": "🛢️",
};

export default async function CategoryGrid() {
  const families = await getMegaMenu();

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <SectionHeading k="home.categories" />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {families.map((f) => (
          <Link
            key={f.id}
            href={`/catalogue/${f.slug}`}
            className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-200 bg-white hover:border-navy-700 hover:shadow-md transition text-center"
          >
            <span className="text-2xl">{ICONS[f.name] ?? "🔩"}</span>
            <span className="text-xs font-semibold text-navy-900 leading-tight">{f.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
