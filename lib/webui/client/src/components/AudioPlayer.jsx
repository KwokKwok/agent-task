import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';

export function AudioPlayer({ src, className }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(src));

  useEffect(() => {
    const audio = audioRef.current;
    setIsPlaying(false);
    setIsLoading(Boolean(src));

    if (!audio) return;

    audio.pause();
    audio.load();
  }, [src]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleLoadedMetadata = () => setIsLoading(false);
  const handleCanPlay = () => setIsLoading(false);
  const handleEnded = () => { setIsPlaying(false); };
  const handleError = () => {
    setIsLoading(false);
    setIsPlaying(false);
  };

  return (
    <span className={className}>
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        onError={handleError}
        preload="metadata"
      />

      <button
        type="button"
        onClick={handlePlayPause}
        disabled={isLoading}
        className="audio-player-button flex h-7 w-7 items-center justify-center rounded-full p-1 shadow-sm transition-transform hover:scale-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="ml-0.5 h-3.5 w-3.5" />
        )}
      </button>
    </span>
  );
}
