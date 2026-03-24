import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const program = z.object({
  /**
   * Site title
   * @example "My Cool Website"
   */
  title: z.string(),

  /**
   * The person or username of the contributor
   * @example "Ky Decker"
   */
  author: z.union([z.string(), z.array(z.string())]).optional(),

  /**
   * URL of the website
   * @example "https://mycoolwebsite.com"
   */
  url: z.string().url(),
});

// A time slot can contain a program or be empty
const timeSlotContent = z.union([program, z.null()]);

// Create a schema for a single time slot entry
const timeSlot = z.record(
  // Key must be a valid 24-hour time in HH:MM format
  // Time must be :30 or :00
  z
    .string()
    .regex(/^([01]\d|2[0-3]):(30|00)$/),
  timeSlotContent,
);

// Daily schedule is an array of time slots or null
const daySchedule = z.array(timeSlot).nullable();

const channels = defineCollection({
  loader: glob({ pattern: "**/*.yml", base: "./src/channels" }),
  schema: z.object({
    /** Two-digit channel number, e.g. "01", "02", "03" */
    slug: z.string(),
    /** Channel name, e.g. "Games", "Art" */
    name: z.string(),
    /** Daily schedule */
    schedule: z.object({
      monday: daySchedule,
      tuesday: daySchedule,
      wednesday: daySchedule,
      thursday: daySchedule,
      friday: daySchedule,
      saturday: daySchedule,
      sunday: daySchedule,
    }),
  }),
});

export const collections = {
  channels,
};
