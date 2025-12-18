import type { ActiveProgram, Program, TimeSlot } from "src/types";

export function findActiveProgram(
  schedule: { [day: string]: TimeSlot[] | null } | null,
  currentTime: Date,
): ActiveProgram | null {
  if (!schedule) return null;

  // Get current day's schedule
  const dayOfWeek = currentTime
    .toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
    .toLowerCase() as keyof typeof schedule;

  const timeSlots = schedule[dayOfWeek];
  if (!timeSlots?.length) return null;

  // Convert current time to HH:MM format for comparison
  const currentTimeStr = currentTime
    .toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    })
    .replace(/^24:/, "00:");

  // Filter out empty slots and sort chronologically
  const definedSlots = timeSlots
    .filter((slot) => {
      const time = Object.keys(slot)[0];
      return slot[time] !== undefined && slot[time] !== null;
    })
    .sort((a, b) => {
      const timeA = Object.keys(a)[0];
      const timeB = Object.keys(b)[0];
      return timeA.localeCompare(timeB);
    });

  // Find the most recent defined program before current time
  let currentSlot: { program: Program; startTime: string } | null = null;
  for (const slot of definedSlots) {
    const slotTime = Object.keys(slot)[0];
    const program = slot[slotTime];

    if (slotTime <= currentTimeStr && program) {
      currentSlot = {
        program,
        startTime: slotTime,
      };
    } else if (slotTime > currentTimeStr) {
      break;
    }
  }

  // If we found a current slot, determine when it ends
  if (currentSlot) {
    // Find the next defined slot to determine end time
    const nextSlot = definedSlots.find(
      (slot) => currentSlot && Object.keys(slot)[0] > currentSlot.startTime,
    );

    const endTime = nextSlot ? Object.keys(nextSlot)[0] : "24:00";

    // Only return the program if we haven't passed its end time
    if (currentTimeStr < endTime) {
      return {
        program: currentSlot.program,
        startTime: currentSlot.startTime,
        endTime,
      };
    }
  }

  return null;
}
