export default function Lightbox({ src }: { readonly src: string }) {
  return <img src={src} alt="Enlarged" width={1600} height={900} />;
}
