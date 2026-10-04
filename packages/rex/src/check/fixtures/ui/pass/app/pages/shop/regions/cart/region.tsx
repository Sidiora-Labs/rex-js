import { Button } from "../../../../components/ui/button.tsx";
import { Card, CardContent } from "../../../../components/ui/card.tsx";
import Quantity from "./parts/Quantity.tsx";

export default function CartRegion() {
  return (
    <Card>
      <CardContent>
        <Quantity />
        <Button type="submit">Pay</Button>
      </CardContent>
    </Card>
  );
}
