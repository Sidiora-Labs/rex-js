import { useQuery } from "@tanstack/react-query";
import { region } from "../../../../page.tsx";
import { greet } from "../../page.ts";
import Hello from "./parts/Hello.tsx";

interface BasicParams {
  readonly name: string;
  readonly badges: boolean;
}

export default region<BasicParams>("main", ({ act, params, state }) => {
  const greeting = useQuery<string | null>({ queryKey: ["greeting", params.name] });
  const badges = useQuery<string[]>({ queryKey: ["badges", params.name], enabled: params.badges });
  const greetAction = act(greet);
  return (
    <Hello
      name={params.name}
      greeting={greeting.data ?? ""}
      badges={badges.data ?? []}
      state={state}
      control={greetAction.controlProps}
      onGreet={() => {
        void greetAction.run({ name: params.name });
      }}
    />
  );
});
