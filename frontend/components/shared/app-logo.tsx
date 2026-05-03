import Image from "next/image";

type AppLogoProps = {
  className?: string;
};

export function AppLogo({ className }: AppLogoProps) {
  return (
    <Image
      src="/icons/icon-192.png"
      alt="Meme-Tagebuch"
      width={88}
      height={88}
      className={className ?? "mx-auto rounded-2xl shadow-lg shadow-black/40"}
      priority
    />
  );
}
