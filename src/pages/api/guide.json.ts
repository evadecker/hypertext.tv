import { getCollection, getEntry } from "astro:content";
import { findActiveProgram } from "@utils/findActiveProgram";
import type { APIRoute } from "astro";

function createTimeBlocks(datetime: Date) {
  const currentHour = datetime.getHours();
  const currentMinute = datetime.getMinutes();
  const nextHour = currentHour + 1;

  const createTimeBlock = (hour: number, minute: number) => {
    const date = new Date(datetime);
    date.setHours(hour, minute, 0); // Set hours, minutes, and 0 seconds
    return date;
  };

  let timeBlocks = [];

  // Show the current 30 min block + the next two 30 min blocks
  if (currentMinute >= 30) {
    timeBlocks = [
      createTimeBlock(currentHour, 30),
      createTimeBlock(nextHour, 0),
      createTimeBlock(nextHour, 30),
    ];
  } else {
    timeBlocks = [
      createTimeBlock(currentHour, 0),
      createTimeBlock(currentHour, 30),
      createTimeBlock(nextHour, 0),
    ];
  }

  return timeBlocks;
}

async function getTimeBlocksForChannel(blocks: Date[], channelId: string) {
  const channel = await getEntry("channels", channelId);
  if (!channel)
    return blocks.map(() => ({
      title: "",
      span: 1,
      continuesBefore: false,
      continuesAfter: false,
    }));

  // Create the before/after blocks for checking continuity
  const blockBefore = new Date(blocks[0].getTime() - 30 * 60000);
  const blockAfter = new Date(blocks[blocks.length - 1].getTime() + 30 * 60000);

  // Get programs for visible blocks
  const programs = await Promise.all(
    blocks.map((block) => {
      const program = findActiveProgram(channel.data.schedule, block);
      return program?.program?.title ?? "";
    }),
  );

  // Get programs for before/after blocks
  const programBefore = findActiveProgram(channel.data.schedule, blockBefore);
  const programAfter = findActiveProgram(channel.data.schedule, blockAfter);

  return programs.reduce(
    (
      acc: Array<{
        title: string;
        span: number;
        continuesBefore: boolean;
        continuesAfter: boolean;
      }>,
      title: string,
      index: number,
    ) => {
      if (index === 0 || title !== programs[index - 1]) {
        const nextDifferentIndex = programs
          .slice(index)
          .findIndex((t: string) => t !== title);
        const span =
          nextDifferentIndex === -1
            ? programs.length - index
            : nextDifferentIndex;

        // Check if program continues before/after visible blocks
        const isFirstBlock = index === 0;
        const isLastBlock = index + span === blocks.length;

        const programStartsBefore =
          isFirstBlock && programBefore?.program?.title === title;
        const programContinuesAfter =
          isLastBlock && programAfter?.program?.title === title;

        acc.push({
          title,
          span,
          continuesBefore: programStartsBefore,
          continuesAfter: programContinuesAfter,
        });
      }
      return acc;
    },
    [],
  );
}

export const GET: APIRoute = async ({ params }) => {
  const datetime = params.datetime ? new Date(params.datetime) : new Date();

  // Get all channels and sort them
  const channels = await getCollection("channels");
  const sortedChannels = channels.sort((a, b) =>
    a.data.slug.localeCompare(b.data.slug),
  );

  // Create time blocks for the guide
  const timeBlocks = createTimeBlocks(datetime);

  // Get program information for each channel
  const guideData = await Promise.all(
    sortedChannels.map(async ({ data: { slug, name } }) => {
      const blocks = await getTimeBlocksForChannel(timeBlocks, slug);
      return {
        channel: {
          slug,
          name,
        },
        blocks,
      };
    }),
  );

  // Return the guide data
  return new Response(
    JSON.stringify({
      currentTime: datetime.toISOString(),
      timeBlocks: timeBlocks.map((block) => block.toISOString()),
      channels: guideData,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};
