/**
 * The checkbox square drawn beside a brand filter's name.
 *
 * Not a real `<input type="checkbox">`: the row it sits in is a plain `<Link>`
 * — the same one that already changes the URL and re-renders the page with
 * that brand added or removed — so a shopper with JavaScript disabled can
 * still filter. A real checkbox would need a `<form>` and a submit to do the
 * same job with none of its accessibility benefit, since the control
 * activating it is the enclosing link, not this element. `aria-hidden`
 * because the link itself already carries `aria-pressed` for the state this
 * draws.
 */
export default function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 grid place-items-center w-[18px] h-[18px] rounded-[4px] border-2 transition-colors ${
        checked ? "bg-navy-900 border-navy-900" : "border-gray-300 bg-white"
      }`}
    >
      {checked && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5 9.5 17 19 7" />
        </svg>
      )}
    </span>
  );
}
