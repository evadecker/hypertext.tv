import { Howl } from "howler";
import sprite from "./sounds.mp3";

const CLICK_SAMPLE_COUNT = 8;
const POWER_ON_SAMPLE_COUNT = 2;

/**
 * Return a random ID without repeating consecutively.
 * @param maxId - The maximum sample ID (e.g., 8 for click sounds, 2 for power on)
 */
const randomId = (maxId: number) => {
  let last: number | undefined;
  const next = (): number => {
    const id = Math.floor(Math.random() * maxId) + 1;
    if (id === last) return next();
    last = id;
    return id;
  };
  return next;
};

const nextClickOn = randomId(CLICK_SAMPLE_COUNT);
const nextClickOff = randomId(CLICK_SAMPLE_COUNT);
const nextPowerOn = randomId(POWER_ON_SAMPLE_COUNT);

const buttonSfx = new Howl({
  src: sprite,
  // Sprite generated with audiosprite
  // https://github.com/tonistiigi/audiosprite
  sprite: {
    bigclick1off: [0, 639.5691609977324],
    bigclick1on: [1299.9999999999998, 112.81179138322005],
    click1off: [2599.9999999999995, 550.9297052154194],
    click1on: [3899.9999999999995, 169.1609977324262],
    click2off: [5199.999999999999, 384.4217687074831],
    click2on: [6499.999999999999, 25.691609977323893],
    click3off: [7799.999999999999, 288.52607709750623],
    click3on: [9100, 35.69160997732368],
    click4off: [10399.999999999998, 365.6235827664407],
    click4on: [11700, 141.678004535148],
    click5off: [13000, 342.0181405895697],
    click5on: [14300, 217.70975056689323],
    click6off: [15600.000000000002, 355.7369614512478],
    click6on: [16900.000000000004, 176.91609977324418],
    click7off: [18200.000000000004, 268.39002267573875],
    click7on: [19500.000000000004, 280.95238095238176],
    click8off: [20800.000000000004, 372.3809523809507],
    click8on: [22100, 169.1609977324262],
    poweron1: [23400.000000000004, 7342.993197278911],
    poweron2: [31700.000000000004, 7557.1655328798215],
  },
  volume: 0.5,
});

/** Play a random plastic button click on sound effect. */
export const playRandomClickOn = (): number =>
  buttonSfx.play(`click${nextClickOn()}on`);

/** Play a random plastic button click off sound effect. */
export const playRandomClickOff = (): number =>
  buttonSfx.play(`click${nextClickOff()}off`);

export const playBigClickOn = (): number => buttonSfx.play("bigclick1on");
export const playBigClickOff = (): number => buttonSfx.play("bigclick1off");

/** Play a random power on sound effect. */
export const playRandomPowerOn = (): number =>
  buttonSfx.play(`poweron${nextPowerOn()}`);

/** Mute all button sounds. */
export const mute = (): void => {
  buttonSfx.mute(true);
};

/** Unmute all button sounds. */
export const unmute = (): void => {
  buttonSfx.mute(false);
};
