"use client";
import { useState } from "react";
export function VideoPlayer({ video }) {
  const [playing, setPlaying] = useState(false);
  if (!/^video:[A-Za-z0-9_-]{11}$/u.test(video.id)) return null;
  const id = video.id.slice(6);
  return (
    <section className="eggs-video-player" aria-label={video.title + " video"}>
      {playing ? (
        <iframe
          title={video.title}
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <div className="eggs-video-consent">
          <span aria-hidden="true">▶</span>
          <h2>Watch on your terms.</h2>
          <p>
            Playing loads YouTube’s privacy-enhanced player. No YouTube media
            loads until you choose to play.
          </p>
          <button type="button" onClick={() => setPlaying(true)}>
            Play video here
          </button>
        </div>
      )}
      <a href={video.source_url} target="_blank" rel="noopener noreferrer">
        Watch on YouTube ↗
      </a>
    </section>
  );
}
