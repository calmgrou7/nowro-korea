import https from "node:https";
import { rootCertificates } from "node:tls";
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
// The origin omits this intermediate. Its signature must chain to an already trusted Node root.
// This scoped agent retains certificate and hostname verification; no new root is trusted.
let agent;
function verifiedAgent() {
  if (agent) return agent;
  const pem = readFileSync(
    new URL("./certificates/sectigo-dv-r36.pem", import.meta.url),
    "utf8",
  );
  const issuer = new X509Certificate(pem),
    now = Date.now();
  const trusted = rootCertificates.some((p) => {
    const root = new X509Certificate(p);
    return issuer.issuer === root.subject && issuer.verify(root.publicKey);
  });
  if (
    !trusted ||
    !issuer.ca ||
    now < Date.parse(issuer.validFrom) ||
    now > Date.parse(issuer.validTo)
  )
    throw Error("EXHIBITION_ISSUER_UNTRUSTED");
  return (agent = new https.Agent({
    ca: [...rootCertificates, pem],
    rejectUnauthorized: true,
    keepAlive: true,
    maxSockets:4,
  }));
}
export function readExhibitionOrigin(url) {
  if (
    url.protocol !== "https:" ||
    url.hostname !== "busandabom.net" ||
    !['/play/list.nm','/play/view.nm'].includes(url.pathname) ||
    url.username ||
    url.password
  )
    throw Error("EXHIBITION_ORIGIN_NOT_ALLOWED");
  return new Promise((resolve, reject) => {
    const request = https.get(url, { agent: verifiedAgent() }, (response) => {
      if (response.statusCode !== 200) {
        clearTimeout(timer);
        response.resume();
        reject(Error("EXHIBITION_ORIGIN_UNAVAILABLE"));
        return;
      }
      response.setEncoding("utf8");
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
        if (body.length > 2000000)
          request.destroy(Error("EXHIBITION_ORIGIN_TOO_LARGE"));
      });
      response.on("end", () => {
        clearTimeout(timer);
        resolve(body);
      });
      response.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    const timer = setTimeout(
      () => request.destroy(Error("EXHIBITION_ORIGIN_TIMEOUT")),
      8000,
    );
    request.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
