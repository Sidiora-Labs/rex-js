import { overlay } from "@sidioralabs/rex/client";
import { createContext, use } from "react";
import Sheet from "../../../components/Sheet.tsx";
import FilterForm, { type FilterFormProps } from "../regions/actions/parts/FilterForm.tsx";

export const HoldingsFilterContent = createContext<FilterFormProps | null>(null);

export default overlay("HoldingsFilterSheet", { dismiss: "both", binding: "url" }, ({ close }) => {
  const content = use(HoldingsFilterContent);
  return (
    <Sheet description="Show only the holdings whose symbol or name contains the text.">
      {content === null ? (
        <p>Open the filter from the actions region.</p>
      ) : (
        <FilterForm {...content} onDone={close} />
      )}
    </Sheet>
  );
});
