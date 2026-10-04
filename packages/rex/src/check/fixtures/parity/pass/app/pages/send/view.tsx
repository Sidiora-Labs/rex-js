import ConfirmRegion from "./regions/confirm/region.tsx";
import FormRegion from "./regions/form/region.tsx";

export default function SendView() {
  return (
    <article>
      <FormRegion />
      <ConfirmRegion />
    </article>
  );
}
