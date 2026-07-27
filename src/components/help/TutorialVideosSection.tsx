import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  isTutorialAvailable,
  TUTORIAL_UNAVAILABLE_LABEL,
  TUTORIALS_DISCLAIMER,
  TUTORIAL_VIDEOS,
} from "@/server/support/tutorialVideos";

/**
 * Cards dos videos tutoriais (read-only).
 *
 * Enquanto `url` for `null`, o card renderiza o botao DESABILITADO com o aviso
 * "Em breve" — nada de link placeholder navegavel. O layout ja fica pronto para
 * quando os videos existirem.
 */
export function TutorialVideosSection() {
  return (
    <section aria-labelledby="videos-tutoriais" className="scroll-mt-20 py-6" id="videos">
      <h2 id="videos-tutoriais" className="text-xl font-semibold">
        Vídeos tutoriais
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">
        Explicações curtas em vídeo para as partes que costumam gerar dúvida. Estamos gravando —
        os primeiros aparecem aqui assim que ficarem prontos.
      </p>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TUTORIAL_VIDEOS.map((video) => {
          const available = isTutorialAvailable(video);

          return (
            <li key={video.id}>
              <Card className="flex h-full flex-col">
                <h3 className="font-medium text-neutral-900">{video.title}</h3>
                <p className="mt-2 flex-1 text-sm text-neutral-600">{video.description}</p>

                <div className="mt-4">
                  {available && video.url ? (
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block"
                    >
                      <Button variant="secondary">Assistir tutorial</Button>
                    </a>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" disabled aria-disabled>
                        Assistir tutorial
                      </Button>
                      <span className="text-xs text-neutral-500">
                        {TUTORIAL_UNAVAILABLE_LABEL}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        <Notice tone="neutral">{TUTORIALS_DISCLAIMER}</Notice>
      </div>
    </section>
  );
}
