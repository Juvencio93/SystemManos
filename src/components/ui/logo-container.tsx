import { cn } from "@/lib/utils";

interface LogoContainerProps {
  src: string;
  alt: string;
  /** Classes extras do container (ex: size-48). */
  className?: string;
  /** Classes extras da img (ex: size-full). */
  imgClassName?: string;
}

/**
 * Logo exibida sobre fundo escuro.
 *
 * Envolve a imagem num container claro (branco) com bordas arredondadas e
 * padding, garantindo que qualquer arte — clara ou escura — fique visível.
 * A transparência da logo é preservada; o container apenas dá o fundo.
 */
export function LogoContainer({ src, alt, className, imgClassName }: LogoContainerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-white p-3 shadow-sm",
        className,
      )}
    >
      <img src={src} alt={alt} className={cn("object-contain", imgClassName)} />
    </div>
  );
}
