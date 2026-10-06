import { CATALOGUE_PATH, ENQUIRY_URL } from "@/lib/links";

/**
 * Copy and media for the About page, verbatim from the Figma frame
 * "Desktop · 1440" (node 2664:172) unless noted.
 */

/**
 * The three films behind the frame's video fills, as seamless loops
 * (1600 × 686, H.264, no audio; the last 0.75s cross-fades into the first).
 * Posters are each loop's first frame, so playback starts without a jump.
 */
export const CLIPS = {
  atelier: {
    video: "/media/about/video/atelier.mp4",
    poster: "/media/about/video/atelier-poster.webp",
    width: 1600,
    height: 686,
  },
  sketch: {
    video: "/media/about/video/sketch.mp4",
    poster: "/media/about/video/sketch-poster.webp",
    width: 1600,
    height: 686,
  },
  plan: {
    video: "/media/about/video/plan.mp4",
    poster: "/media/about/video/plan-poster.webp",
    width: 1600,
    height: 686,
  },
} as const;

/** Per-slot media: the film, its poster and alt text, and a loading tone. */
export const MEDIA = {
  atelier: {
    clip: "atelier",
    ...CLIPS.atelier,
    alt: "Concept film: a designer at a desk by a city window; the camera drifts down to the room she is sketching.",
    tone: "#795c5b",
  },
  sketch: {
    clip: "sketch",
    ...CLIPS.sketch,
    alt: "Concept film: a sketched room on paper rises off the page into a furnished 3D model.",
    tone: "#a4846e",
  },
  plan: {
    clip: "plan",
    ...CLIPS.plan,
    alt: "Concept film: furniture appears on a marked-up floor plan beside fabric swatches, until someone steps into the finished room.",
    tone: "#9b8573",
  },
} as const;

export type MediaKey = keyof typeof MEDIA;

/**
 * Desktop: the three films as ONE scroll-scrubbed sequence — atelier,
 * sketch, plan at 12fps, 1920 × 824 WebP, with half-second dissolves baked
 * in where the clips meet. New footage ⇒ new folder (/media is served
 * immutable).
 *
 * `marks` are the frame indices where each part begins: the hero, then the
 * five chapters. Every clip is split in two — atelier: hero + chapter 1,
 * sketch: chapters 2–3, plan: chapters 4–5.
 */
export const FILM = {
  path: "/media/about/film-v1",
  frames: 351,
  width: 1920,
  height: 824,
  marks: [0, 58, 116, 175, 232, 291, 350],
} as const;

export const filmFrame = (index: number) =>
  `${FILM.path}/frame-${String(index + 1).padStart(3, "0")}.webp`;

export interface StoryRowData {
  id: string;
  /** Handwritten chapter label: the section's name in the Figma frame. */
  label: string;
  /** One entry per explicit line; a single entry wraps naturally. */
  title: readonly string[];
  /** TAN PEARL size in design px. */
  size: number;
  /** Unitless line height. */
  lineHeight: number;
  /** Fixed title box height in design px; the text centres inside it. */
  box?: number;
  /** Colour of the frame's 1px outside stroke, when the title has one. */
  stroke?: string;
  body: string;
  media: MediaKey;
  /** Artwork on the left (sections 02 and 04). */
  mediaFirst?: boolean;
}

export const STORY_ROWS: readonly StoryRowData[] = [
  {
    id: "we-listen",
    label: "Living, beautifully.",
    title: ["Before we draw,", "we listen."],
    size: 35,
    lineHeight: 1.5,
    stroke: "#292722",
    body: "Sculptural sofas, inviting armchairs and thoughtful tables. Build a living room around the way you unwind.",
    media: "atelier",
  },
  {
    id: "made-personal",
    label: "Made personal.",
    title: ["Touch part of the design"],
    size: 45,
    lineHeight: 1.5,
    body: "Choose the proportions, upholstery and finishes that belong in your space. Start with an idea; make it yours.",
    media: "sketch",
    mediaFirst: true,
  },
  {
    id: "ideas-to-object",
    label: "Room for connection.",
    title: ["From Ideas to Object"],
    size: 64,
    lineHeight: 1.5,
    box: 293,
    stroke: "#292722",
    body: "Dining tables and chairs designed as a conversation. Considered silhouettes, balanced proportions and a shared material story.",
    media: "sketch",
  },
  {
    id: "craft",
    label: "Craft you can feel.",
    title: ["Craft you", "can feel."],
    size: 64,
    lineHeight: 1.5,
    box: 200,
    stroke: "#292722",
    body: "From the joinery beneath a tabletop to the curve of an armrest, the smallest decisions shape the everyday experience.",
    media: "plan",
    mediaFirst: true,
  },
  {
    id: "yours",
    label: "A complete point of view.",
    title: ["And then it become yours"],
    size: 45,
    lineHeight: 66 / 45,
    stroke: "#1e1e1e",
    body: "Bring furniture, materials and your room together. A considered whole, with space to move, gather and simply be.",
    media: "plan",
  },
];

/** "Service / Paper card" instances. No pricing is assumed (per the component notes). */
export const SERVICES = [
  {
    title: "A signature piece",
    body: "Find furniture with character for your living room, dining room or bedroom.",
    cta: "Explore collections",
    href: CATALOGUE_PATH,
    rose: false,
  },
  {
    title: "A bespoke idea",
    body: "Bring your references, dimensions and material preferences. Shape a piece around your space.",
    cta: "Discuss your idea",
    href: ENQUIRY_URL,
    rose: true,
  },
  {
    title: "A shared vision",
    body: "For interior designers and architects: discuss furniture, finishes and project requirements.",
    cta: "Work with Maple",
    href: ENQUIRY_URL,
    rose: false,
  },
] as const;

/**
 * Questions are from the frame. It shows them collapsed only ("Expand to
 * reveal the answer in implementation"), so the answers are placeholder
 * copy drawn from the page's own text, awaiting the client's wording.
 */
export const FAQS = [
  {
    q: "Can furniture be customised?",
    a: "Yes. Many pieces can be adapted in proportion, upholstery and finish. Tell us what you have in mind and we will let you know what is possible for that piece.",
  },
  {
    q: "Can you help furnish an entire room?",
    a: "Yes. We can help you bring furniture, materials and your room together, whether it is a living room, a dining room or a bedroom, planned as one considered whole.",
  },
  {
    q: "Do you work with interior designers?",
    a: "Yes. Interior designers and architects work with us on furniture, finishes and project requirements.",
  },
  {
    q: "What should I share for a bespoke enquiry?",
    a: "Your references, dimensions and material preferences are the best place to start. Photos of the space help us shape a piece around it.",
  },
  {
    q: "How do I discuss timelines and delivery?",
    a: "Timelines depend on the piece and how it is made. Start a conversation with us and we will talk through timelines and delivery for your project.",
  },
] as const;
