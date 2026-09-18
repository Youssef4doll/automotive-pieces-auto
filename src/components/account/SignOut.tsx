"use client";

import { logout } from "@/app/actions/auth";
import { useCart } from "@/lib/cart-store";
import { useVehicle } from "@/lib/vehicle-store";

/**
 * Signing out, all the way out.
 *
 * `logout()` destroys the session cookie, which is the half the server owns.
 * The other half lives in this browser: the basket and the saved garage are
 * zustand stores persisted to localStorage, and a cookie being deleted does
 * nothing to them. So a customer who signed out at a garage counter left the
 * next person their 23-item basket and all three of their cars — and, because
 * the cart syncs upward, handed them to whoever signed in next.
 *
 * Every sign-out control on the site renders this, so there is one place where
 * that is true rather than four forms each remembering to tidy up.
 *
 * The clearing runs before the action rather than after the redirect: writes
 * to localStorage are synchronous, and by the time the new page mounts this
 * component is gone.
 */
export default function SignOut({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const clearCart = useCart((s) => s.clear);
  const forgetVehicles = useVehicle((s) => s.forgetAll);

  return (
    <form
      action={logout}
      onSubmit={() => {
        clearCart();
        forgetVehicles();
      }}
    >
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
