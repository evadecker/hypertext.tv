import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

async function listAllContributors() {
  const allChannels = await getCollection("channels");
  const allContributors = allChannels.flatMap((channel) =>
    Object.values(channel.data.schedule).flatMap(
      (day) =>
        day?.flatMap((slot) => {
          const timeSlot = Object.values(slot)[0];
          if (!timeSlot?.author) return [];
          return Array.isArray(timeSlot.author)
            ? timeSlot.author
            : [timeSlot.author];
        }) ?? [],
    ),
  );

  // Remove duplicates and sort
  return [...new Set(allContributors)].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}

export const GET: APIRoute = async () => {
  const contributors = await listAllContributors();

  return new Response(JSON.stringify(contributors), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
};
