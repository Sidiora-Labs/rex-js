import { useState } from "react";
import type { ActControlProps } from "../../../../../../client/index.ts";

export interface ComposerProps {
  readonly control: ActControlProps;
  readonly onAdd: (title: string) => void;
}

export default function Composer({ control, onAdd }: ComposerProps) {
  const [title, setTitle] = useState("");
  return (
    <div>
      <label>
        Title
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <button type="button" {...control} onClick={() => onAdd(title)}>
        Add note
      </button>
    </div>
  );
}
