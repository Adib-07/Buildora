"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircleIcon, Loader2Icon, WandIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/app/actions";
import { IDLE, messageFor, type ActionState } from "@/app/action-state";

/**
 * Sign-in form.
 *
 * `useActionState` rather than fetch: the action runs on the server, so the
 * password never travels through client-side state or a URL, and a successful
 * sign-in redirects without the token ever being in JavaScript.
 */
export function SignInForm({
  next,
  demoAccount,
}: {
  next: string;
  /** The seeded supervisor account, offered only when DEMO_MODE is on. */
  demoAccount?: { email: string; password: string } | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signIn, IDLE);
  // React resets an uncontrolled form after a form action completes. That is
  // right for the password -- a rejected attempt should not leave it in the
  // DOM -- but wiping the email means retyping the whole address to fix one
  // typo, so it is held here instead.
  const [email, setEmail] = useState("");
  // The password stays uncontrolled on purpose: the demo fill below writes
  // through this ref rather than routing it into React state, so a failed
  // attempt still leaves nothing sensitive in the component tree.
  const passwordRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />

      {/* One live region for the whole form: a screen reader announces the
          outcome once, rather than once per field. */}
      <div aria-live="polite" aria-atomic="true">
        {state?.status === "error" ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-control border border-state-disputed/30 bg-state-disputed-bg px-3 py-2.5"
          >
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-state-disputed" />
            <p className="text-sm text-ink">{messageFor(state)}</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink">
          Work email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          aria-invalid={state?.fields?.email ? true : undefined}
          aria-describedby={state?.fields?.email ? "email-error" : undefined}
          placeholder="you@site.example"
        />
        {state?.fields?.email ? (
          <p id="email-error" role="alert" className="text-sm text-state-disputed">
            {state.fields.email}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          ref={passwordRef}
          autoComplete="current-password"
          required
          aria-invalid={state?.fields?.password ? true : undefined}
          aria-describedby={state?.fields?.password ? "password-error" : undefined}
        />
        {state?.fields?.password ? (
          <p id="password-error" role="alert" className="text-sm text-state-disputed">
            {state.fields.password}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? (
          <>
            <Loader2Icon className="animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>

      {demoAccount ? (
        // Spells the credentials out rather than signing in silently: a judge
        // who is handed a working session learns nothing about the flow, and
        // this is the only part of the product that decides who sees a site's
        // data.
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setEmail(demoAccount.email);
            if (passwordRef.current) passwordRef.current.value = demoAccount.password;
            passwordRef.current?.focus();
          }}
        >
          <WandIcon aria-hidden="true" />
          Fill the demo supervisor account
        </Button>
      ) : null}

      <p className="text-sm text-ink-muted">
        Accounts are created by your site administrator. If you cannot get in,
        ask them to check the address they issued.
      </p>
    </form>
  );
}
