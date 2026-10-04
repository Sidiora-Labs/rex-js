import { Dialog, DialogContent } from "../../../components/ui/dialog.tsx";
import { Textarea } from "../../../components/ui/textarea.tsx";

export default function Checkout() {
  return (
    <Dialog open>
      <DialogContent>
        <Textarea name="message" aria-label="Message" />
      </DialogContent>
    </Dialog>
  );
}
