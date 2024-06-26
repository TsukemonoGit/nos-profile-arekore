import { getPublicKey, nip19 } from "nostr-tools";

export function getHexPubkey(str: string): string {
  try {
    if (str.startsWith("nostr:")) {
      str = str.slice(6);
    }
    if (str.startsWith("npub")) {
      str = nip19.decode(str).data as string;
    } else if (str.startsWith("nsec")) {
      const sec = nip19.decode(str).data as Uint8Array;
      str = getPublicKey(sec);
    }
    nip19.npubEncode(str);
  } catch (error) {
    throw Error;
  }
  return str;
}

export function getHexSeckey(str: string): Uint8Array {
  let sec: Uint8Array;
  try {
    if (str.startsWith("nostr:")) {
      str = str.slice(6);
    }
    if (str.startsWith("nsec")) {
      sec = nip19.decode(str).data as Uint8Array;
    } else {
      throw Error;
    }
  } catch (error) {
    throw Error;
  }
  return sec;
}
