import { redirect } from "next/navigation";

import { BrandLockup } from "@/components/brand";

import { getSession } from "@/lib/auth/dal";

import { SignInForm } from "./sign-in-form";

/**
 * Sign in.
 *
 * Already-signed-in visitors are sent to their site rather than shown a form
 * they do not need. The session check happens before render, so the page never
 * flashes a login prompt at someone who is already authenticated.
 */
export default async function LoginPage(props: PageProps<"/login">) {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const params = await props.searchParams;
  const requested = typeof params.next === "string" ? params.next : "/dashboard";
  // Only a same-site path is carried through. An absolute URL here would be an
  // open redirect: a crafted /login?next=https://evil.example link would look
  // exactly like ours and land a signed-in user somewhere hostile.
  const next = /^\/(?!\/)/.test(requested) ? requested : "/dashboard";

  return (
    <div className="flex min-h-dvh flex-col">
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12"
      >
        <div className="flex flex-col gap-6">
          <BrandLockup />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
            <p className="text-ink-muted">
              Use the staff account issued for your site.
            </p>
          </div>
          <SignInForm next={next} />
        </div>
      </main>
    </div>
  );
}
