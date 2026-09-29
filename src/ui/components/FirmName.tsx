import { firmFont } from '../fonts/firmFonts';

/** A VC firm name in its own classic-serif face (see ui/fonts/firmFonts.ts). */
export function FirmName({ name }: { name: string }): JSX.Element {
  return <span data-firm-font={firmFont(name)}>{name}</span>;
}
