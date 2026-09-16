/**
 * "Est-ce que ça ira vraiment sur ma voiture ?"
 *
 * The honest answer to the question every parts shopper is actually asking,
 * and the one thing a compatibility list cannot say for itself. A list that
 * names your car reads as a guarantee. It is not one: one engine ships in
 * several trim levels, series and country versions, and a catalogue keyed on
 * the engine cannot tell them apart. Saying so costs a paragraph and saves a
 * return — and a customer who was told in advance is not a customer who feels
 * cheated afterwards.
 *
 * What it must not do is invent a service. The big European catalogues answer
 * this with a paid VIN-verification option ticked at checkout; this shop has
 * no such product, so none is offered here. What it has is real and is what is
 * described: a person who will check a chassis number against the reference
 * before you order, and an order that now records the car it was placed for,
 * so nobody has to ring you back to ask.
 *
 * A `<details>` rather than a permanent wall of text: it is the answer to a
 * question, so it sits folded until asked, and it works with no JavaScript.
 */
export default function FitNotice() {
  return (
    <details
      id="compatibilite-explication"
      className="group scroll-mt-24 rounded-xl border border-gray-200 bg-white"
    >
      <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2.5 px-4 text-sm font-semibold text-navy-950 [&::-webkit-details-marker]:hidden">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-navy-900/40"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 2-2.8 2.4-2.8 4" />
          <path d="M12 17.5h.01" />
        </svg>
        <span className="flex-1">Est-ce que cette pièce ira vraiment sur ma voiture ?</span>
        {/* Points down, not sideways: a chevron that turns is the clearest
            open/closed signal, and a vertical one needs no RTL mirroring. */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-gray-400 transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          <path d="m5 9 7 7 7-7" />
        </svg>
      </summary>

      <div className="flex flex-col gap-2.5 border-t border-gray-100 px-4 py-3.5 text-sm leading-relaxed text-gray-700">
        <p>
          Quand vous indiquez votre voiture — marque, modèle, carburant, motorisation — nous
          affichons les pièces que notre base donne comme compatibles avec cette motorisation.
        </p>
        <p>
          Une même motorisation se décline souvent en plusieurs finitions, séries et versions
          selon le pays. La liste peut donc être plus large que votre voiture exacte, et une
          référence listée n&apos;est pas encore une certitude.
        </p>
        <p>
          <span className="font-semibold text-navy-950">La vérification, c&apos;est nous.</span>{" "}
          Envoyez-nous la photo de votre carte grise, ou le numéro de châssis (VIN) qui y figure,
          et nous confirmons la référence avant que vous ne commandiez. La voiture que vous
          choisissez sur le site est enregistrée avec la commande, donc personne n&apos;a besoin de
          vous rappeler pour vous la redemander.
        </p>
        <p>
          À la réception, comparez la pièce avec celle qui est montée sur la voiture avant de la
          poser. Une pièce non montée se reprend ; une pièce déjà posée ne se reprend plus.
        </p>
      </div>
    </details>
  );
}
