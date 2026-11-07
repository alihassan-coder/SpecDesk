import { IdeaBox } from "@/components/landing/idea-box";
import { PipelineDiagram } from "@/components/landing/pipeline-diagram";
import { SiteHeader } from "@/components/landing/site-header";

export default function LandingPage() {
  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-x-clip">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
        <section className="mx-auto w-full max-w-2xl py-16 text-center sm:py-24">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">What do you want to build?</h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">Get features, screens, stack, timeline and price in about two minutes.</p>
          <div className="mt-8 text-left">
            <IdeaBox />
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-t py-14 sm:py-20">
          <h2 className="mb-10 text-center text-xl font-semibold tracking-tight">How it works</h2>
          <PipelineDiagram />
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 text-sm text-muted-foreground sm:px-6">
          <span>© 2026 SpecDesk</span>
          <a href="https://github.com/alihassan-coder/SpecDesk" target="_blank" rel="noreferrer" className="hover:text-foreground">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
