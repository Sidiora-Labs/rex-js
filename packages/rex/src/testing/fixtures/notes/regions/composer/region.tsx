import { region } from "../../../../../client/index.ts";
import { addNote } from "../../../actions.ts";
import Composer from "./parts/Composer.tsx";

export default region("composer", ({ act }) => {
  const add = act(addNote);
  return (
    <Composer
      control={add.controlProps}
      onAdd={(title) => {
        void add.run({ title });
      }}
    />
  );
});
