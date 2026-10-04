import Composer from "./regions/composer/region.tsx";
import List from "./regions/list/region.tsx";

export default function View() {
  return (
    <>
      <List />
      <Composer />
    </>
  );
}
