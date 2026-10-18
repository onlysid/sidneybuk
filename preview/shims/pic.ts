// The preview has no image service: pictures are shown as they are.
export const WIDTHS = [320, 480, 640, 828, 1080, 1200, 1920] as const;
export const picAt = (src: string) => src;
export const picSet = (_src: string) => undefined;
