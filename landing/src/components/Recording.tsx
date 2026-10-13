import { useEffect, useRef } from "react";
import { useInView } from "@/hooks/useInView";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface Themed {
  dark: string;
  light: string;
}

interface RecordingProps {
  /** The recording, one for each theme. */
  video: Themed;
  /** Its first frame: shown until the recording loads, and in its place where motion is not wanted. */
  poster: Themed;
  /** What the recording shows, for a reader who cannot see it. */
  label: string;
  className?: string;
}

/**
 * A recording of the viewer, in a hairline frame, in the theme the reader has. It loads
 * and plays once it comes on screen, loops without sound, and stays a still picture for
 * a reader who asked for less motion.
 */
export function Recording({ video, poster, label, className }: RecordingProps) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className={cn("aspect-[16/10] overflow-hidden rounded-xl border bg-card shadow-sm", className)}
    >
      <Clip video={video.light} poster={poster.light} play={seen && !still} className="dark:hidden" />
      <Clip video={video.dark} poster={poster.dark} play={seen && !still} className="hidden dark:block" />
    </div>
  );
}

function Clip({ video, poster, play, className }: { video: string; poster: string; play: boolean; className: string }) {
  const element = useRef<HTMLVideoElement>(null);
  // A hidden clip is neither fetched nor played: each reader loads the one for their theme.
  useEffect(() => {
    const clip = element.current;
    if (!clip || !play || clip.offsetParent === null) return;
    void clip.play().catch(() => undefined);
  }, [play]);
  return (
    <video
      ref={element}
      src={play ? video : undefined}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      className={cn("size-full object-cover", className)}
    />
  );
}
