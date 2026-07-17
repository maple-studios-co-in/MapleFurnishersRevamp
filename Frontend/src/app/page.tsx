import HeroIntro from "@/components/hero/HeroIntro";

const collections = [
  {
    title: "Living",
    description: "Sofas, lounge chairs and coffee tables built around slow evenings.",
  },
  {
    title: "Dining",
    description: "Solid-timber tables and seating made for long conversations.",
  },
  {
    title: "Bedroom",
    description: "Beds, wardrobes and side tables in warm, quiet materials.",
  },
];

export default function Home() {
  return (
    <main>
      <HeroIntro />

      {/* Placeholder sections so the unlocked scroll has somewhere to go.
          These get replaced with real content in later steps. */}
      <section id="collections" className="bg-cream px-6 py-24 text-ink sm:px-12">
        <p className="text-xs uppercase tracking-[0.4em] text-clay-700">
          Collections
        </p>
        <h2
          className="mt-4 max-w-2xl text-3xl sm:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Crafted for every room
        </h2>
        <div className="mt-14 grid gap-10 sm:grid-cols-3">
          {collections.map((c) => (
            <div key={c.title} className="border-t border-ink/20 pt-6">
              <h3
                className="text-xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {c.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                {c.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink px-6 py-24 text-cream sm:px-12">
        <p className="text-xs uppercase tracking-[0.4em] text-sand-300">
          Craftsmanship
        </p>
        <h2
          className="mt-4 max-w-2xl text-3xl sm:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Every piece begins as a drawing
        </h2>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-cream/70">
          Like the film above, our work starts as a blueprint — measured,
          sketched and refined — before our workshop turns it into timber,
          stone and upholstery that lasts.
        </p>
      </section>

      <footer className="border-t border-cream/10 bg-ink px-6 py-10 text-xs text-cream/50 sm:px-12">
        © {new Date().getFullYear()} Maple Furnishers. All rights reserved.
      </footer>
    </main>
  );
}
