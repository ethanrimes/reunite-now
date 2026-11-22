import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { gunzipSync } from "node:zlib";
import { Reader, type CountryResponse } from "mmdb-lib";
import type { Region } from "./db";

// Member states plus EU outermost regions that have their own ISO country code.
const europeanUnion = new Set(
  "AT BE BG HR CY CZ DE DK EE ES FI FR GR HU IE IT LT LU LV MT NL PL PT RO SE SI SK AX GF GP MF MQ RE YT".split(
    " ",
  ),
);
const reader = new Reader<CountryResponse>(
  gunzipSync(readFileSync("server/data/dbip-country.mmdb.gz")),
);
export function regionForIP(value: string | undefined): Region {
  let ip = (value ?? "").trim();
  if (!isIP(ip))
    ip =
      ip.match(/^\[([^\]]+)\](?::\d+)?$/)?.[1] ??
      ip.replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1");
  if (ip.toLowerCase().startsWith("::ffff:") && isIP(ip.slice(7)) === 4)
    ip = ip.slice(7);
  if (!isIP(ip)) return "us";
  const country = reader.get(ip)?.country?.iso_code;
  return country && europeanUnion.has(country) ? "eu" : "us";
}
