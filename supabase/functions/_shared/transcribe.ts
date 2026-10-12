/**
 * Speech-to-text for voice notes via OpenAI's transcription endpoint.
 * Set the OPENAI_API_KEY secret to turn it on; TRANSCRIBE_MODEL overrides the model.
 * Swap this file to use another provider; the rest of the pipeline only needs text back.
 */
export const transcriberConfigured = () => Boolean(Deno.env.get('OPENAI_API_KEY'));

export async function transcribe(audio: Uint8Array<ArrayBuffer>, contentType: string, ext: string): Promise<string> {
  const form = new FormData();
  // The provider identifies the format from the file name.
  form.append('file', new Blob([audio], { type: contentType }), `voice-note.${ext}`);
  form.append('model', Deno.env.get('TRANSCRIBE_MODEL') ?? 'gpt-4o-mini-transcribe');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${await res.text()}`);
  const { text } = (await res.json()) as { text: string };
  return text.trim();
}
