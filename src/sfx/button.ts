import { Howl } from "howler";
import sprite from "./button-sprite.mp3";

/** The number of distinct button click samples stored in the sound sprite. */
const sampleCount = 11;

/** The duration of each sample in the sound sprite in milliseconds. */
const sampleDuration = 375;

/** The sprite that was most recently played. */
let lastSampleId: string | undefined;

/** Get a random ID for one of the sounds in the sound sprite. */
const getNextSampleId = (): string => {
  const nextSampleId = String(Math.floor(Math.random() * sampleCount));
  // Avoid repeating the same sample as the last click.
  if (nextSampleId === lastSampleId) return getNextSampleId();
  lastSampleId = nextSampleId;
  return nextSampleId;
};

/** A Howler instance that plays back button clicks. */
const buttonSfx = new Howl({
  src: sprite,
  // This code tells Howler to break up the sprite file into 375ms chunks.
  sprite: Object.fromEntries(
    Array.from({ length: sampleCount }).map((_, index) => [
      index,
      [index * sampleDuration, sampleDuration],
    ]),
  ),
  volume: 0.5,
});

/** Play a random plastic button click sound effect. */
export const playButtonClick = (): number => buttonSfx.play(getNextSampleId());
