// Runs once when the server starts (Next.js calls register).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { keepInStep } = await import("./lib/server/sport");
  keepInStep();
}
