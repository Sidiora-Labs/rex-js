import { overlay } from "@sidioralabs/rex/client";
import { createContext, use } from "react";
import Sheet from "../../../components/Sheet.tsx";
import ContactOptions, {
  type ContactOptionsProps,
} from "../regions/form/parts/ContactOptions.tsx";

export const ContactPickerContent = createContext<ContactOptionsProps | null>(null);

export default overlay("ContactPickerSheet", { dismiss: "both", binding: "region" }, () => {
  const content = use(ContactPickerContent);
  return (
    <Sheet description="Pick who receives the transfer.">
      {content === null ? (
        <p>Open the contact picker from the form.</p>
      ) : (
        <ContactOptions {...content} />
      )}
    </Sheet>
  );
});
