import type { ActControlProps } from "../../../../../act.ts";

export interface HelloProps {
  readonly name: string;
  readonly greeting: string;
  readonly badges: readonly string[];
  readonly state: string;
  readonly control: ActControlProps;
  readonly onGreet: () => void;
}

export default function Hello({ name, greeting, badges, state, control, onGreet }: HelloProps) {
  return (
    <div>
      <p>
        {greeting} {name}
      </p>
      <p>Badges: {badges.length === 0 ? "none" : badges.join(", ")}</p>
      <p>State: {state}</p>
      <button type="button" {...control} onClick={onGreet}>
        Greet
      </button>
    </div>
  );
}
