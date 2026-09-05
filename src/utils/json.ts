export function safeParseJson(text: string): ReturnType<typeof JSON.parse> | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
