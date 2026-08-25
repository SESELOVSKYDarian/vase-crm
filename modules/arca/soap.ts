import { ArcaTimeoutError, ArcaWsfeError } from "./errors";
export const escapeXml = (value: string | number) =>
  String(value).replace(
    /[<>&'\"]/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[c]!,
  );
export const tag = (xml: string, name: string) =>
  new RegExp(`<\\/?(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`)
    .exec(xml)?.[1]
    ?.trim() ?? null;
export const tags = (xml: string, name: string) =>
  [
    ...xml.matchAll(
      new RegExp(
        `<\\/?(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`,
        "g",
      ),
    ),
  ].map((m) => m[1].trim());
export async function soapCall(url: string, action: string, xml: string) {
  const controller = new AbortController(),
    timeout = setTimeout(
      () => controller.abort(),
      Number(process.env.ARCA_HTTP_TIMEOUT_MS ?? 15000),
    );
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: action,
      },
      body: xml,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok || /<[^>]*Fault[\s>]/i.test(text))
      throw new ArcaWsfeError(
        tag(text, "faultstring") ?? `ARCA respondió HTTP ${response.status}.`,
      );
    return text;
  } catch (error) {
    if ((error as Error).name === "AbortError") throw new ArcaTimeoutError();
    if (error instanceof ArcaWsfeError) throw error;
    throw new ArcaWsfeError("No se pudo conectar con el servicio de ARCA.");
  } finally {
    clearTimeout(timeout);
  }
}
