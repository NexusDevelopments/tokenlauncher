import { Buffer } from 'buffer';

if (!('Buffer' in globalThis)) {
  globalThis.Buffer = Buffer;
}

if (!('global' in globalThis)) {
  globalThis.global = globalThis;
}
