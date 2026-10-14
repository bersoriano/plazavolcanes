import { LegalRoutePage, buildLegalMetadata } from "@/app/(legal)/legal-route";
import { ContactForm } from "@/components/legal/contact-form";
import { isSignedIn } from "@/lib/queries/contact.server";

export const generateMetadata = () => buildLegalMetadata("complaints_policy");

export default async function Page() {
  // Awaited here rather than rendered as <LegalRoutePage />, so the policy and
  // the session are read side by side.
  const [policy, signedIn] = await Promise.all([
    LegalRoutePage({ type: "complaints_policy" }),
    isSignedIn(),
  ]);

  return (
    <>
      {policy}
      {/* Here whether or not the policy is published: a way to reach the plaza
          does not wait on the document that describes it. */}
      <section aria-labelledby="escribenos" className="mx-auto mt-12 max-w-[68ch] print:hidden">
        <h2 className="font-display text-2xl font-semibold text-ink" id="escribenos">
          Escríbenos
        </h2>
        <p className="mt-3 leading-7 text-muted">
          Cuéntanos tu queja, duda o aclaración y te responderemos.
        </p>
        <div className="mt-6">
          <ContactForm signedIn={signedIn} />
        </div>
      </section>
    </>
  );
}
