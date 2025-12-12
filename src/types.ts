export type Program = {
  title: string;
  url?: string;
};

export type ActiveProgram = {
  program: Program | null;
  startTime?: string;
  endTime?: string;
};

export type TimeSlot = {
  [time: string]: Program | null;
};

export type ProgramBlock = {
  title: string;
  span: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type Channel = {
  slug: string;
  name: string;
};

export type ChannelData = {
  channel: Channel;
  blocks: ProgramBlock[];
};

export type GuideData = {
  currentTime: string;
  timeBlocks: string[];
  channels: ChannelData[];
};

export interface VisitorData {
  total?: number;
}
