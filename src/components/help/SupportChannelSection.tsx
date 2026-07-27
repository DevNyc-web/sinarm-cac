import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  resolveWhatsAppSupport,
  SUPPORT_SAFETY_NOTE,
  SUPPORT_UNAVAILABLE_TEXT,
} from "@/server/support/supportChannel";

/**
 * Area de suporte humano (read-only).
 *
 * O link sai de `SUPPORT_WHATSAPP_URL`. Sem env valida, o botao fica
 * desabilitado e explicamos o porque — nunca um numero chumbado no codigo.
 */
export function SupportChannelSection() {
  const channel = resolveWhatsAppSupport();

  return (
    <section aria-labelledby="falar-com-suporte" className="scroll-mt-20 py-6" id="suporte">
      <Card className="bg-neutral-50">
        <h2 id="falar-com-suporte" className="text-lg font-semibold">
          Ainda com dúvida? Fale com a gente
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600">
          Você fala com uma pessoa da nossa equipe pelo WhatsApp, em qualquer etapa do pedido. Se
          já tiver um pedido aberto, tenha o número dele por perto.
        </p>

        <div className="mt-4">
          {channel.available ? (
            <a
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button className="px-5 py-3 text-base">Falar com suporte</Button>
            </a>
          ) : (
            <div className="space-y-2">
              <Button className="px-5 py-3 text-base" disabled aria-disabled>
                Falar com suporte
              </Button>
              <p className="text-xs text-neutral-500">
                {SUPPORT_UNAVAILABLE_TEXT[channel.reason]}
              </p>
            </div>
          )}
        </div>

        <p className="mt-4 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
          {SUPPORT_SAFETY_NOTE}
        </p>
      </Card>
    </section>
  );
}
