"use client";

import { motion, useReducedMotion } from "framer-motion";

const lines = [
  { prefix: "$", text: "lynx init --project growth-platform" },
  { prefix: "→", text: "stack: next · typescript · edge cache" },
  { prefix: "→", text: "targets: LCP < 2.0s · CLS 0 · SEO schema" },
  { prefix: "→", text: "support: 24×7 · india + global" },
  { prefix: "✓", text: "ready. you talk to who ships." },
];

export function TerminalPreview() {
  const reduce = useReducedMotion();

  return (
    <aside
      aria-label="Interactive engineering preview"
      className="overflow-hidden rounded-xl border border-white/15 bg-[#07110d]/85 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="size-2.5 rounded-full bg-[#ff5f57]/90" />
        <span className="size-2.5 rounded-full bg-[#febc2e]/90" />
        <span className="size-2.5 rounded-full bg-[#28c840]/90" />
        <span className="ml-3 font-mono text-[11px] tracking-wide text-white/45">
          lynx — delivery.sh
        </span>
      </div>
      <div className="space-y-2.5 px-4 py-5 font-mono text-[12px] leading-relaxed sm:text-[13px]">
        {lines.map((line, index) => (
          <motion.p
            key={line.text}
            className="flex gap-2 text-white/85"
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: reduce ? 0 : 0.35 + index * 0.18,
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <span className="shrink-0 text-gold">{line.prefix}</span>
            <span>{line.text}</span>
          </motion.p>
        ))}
        <motion.span
          aria-hidden
          className="mt-1 inline-block h-4 w-2 bg-gold/90"
          animate={reduce ? undefined : { opacity: [1, 0.15, 1] }}
          transition={{ repeat: Infinity, duration: 1.1 }}
        />
      </div>
    </aside>
  );
}
