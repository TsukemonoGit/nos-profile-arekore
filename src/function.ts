import { nip19 } from "nostr-tools";

export function getHexPubkey(str: string): string {
  try {
    if (str.startsWith("nostr:")) {
      str = str.slice(6);
    }
    if (str.startsWith("npub")) {
      str = nip19.decode(str).data as string;
    }
    nip19.npubEncode(str);
  } catch (error) {
    throw Error;
  }
  return str;
}
