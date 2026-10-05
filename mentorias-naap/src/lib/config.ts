export const brand = {
  name: process.env.NEXT_PUBLIC_NAAP_NAME || "NAAP Psicologia",
  email: process.env.NEXT_PUBLIC_NAAP_EMAIL || "contato@naappsicologia.com.br",
  phone: process.env.NEXT_PUBLIC_NAAP_PHONE || "(85) 99840-2825",
  siteName: "Mentorias NAAP",
};

export function siteUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
