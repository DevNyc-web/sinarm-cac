import type { ReactNode } from "react";

type Tone = "neutral" | "info" | "warning";

const toneStyles: Record<Tone, string> = {
  neutral: "border-neutral-200 bg-neutral-50 text-neutral-700",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
};

/**
 * Caixa de aviso reutilizavel (marca neutra, sem parecer orgao oficial — docs/24).
 * Usada para os avisos obrigatorios ("nao somos orgao", "nao garantimos aprovacao",
 * "voce confere antes de enviar") de forma consistente entre as telas.
 */
export function Notice({
  tone = "neutral",
  title,
  children,
  className = "",
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${toneStyles[tone]} ${className}`.trim()}>
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={title ? "mt-1 text-[13px] leading-relaxed" : "leading-relaxed"}>
        {children}
      </div>
    </div>
  );
}
