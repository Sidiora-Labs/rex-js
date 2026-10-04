export default function Thumb(props: { readonly src: string; readonly label: string }) {
  return (
    <figure>
      <img src={props.src} alt={props.label} width="96" height="96" />
      <figcaption>{props.label}</figcaption>
    </figure>
  );
}
