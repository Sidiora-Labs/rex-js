import { Img } from "@sidioralabs/rex/client/media";

export default function Tile({ src, label }: { readonly src: string; readonly label: string }) {
  return <Img src={src} alt={label} width={320} height={320} />;
}
