import { createElement } from "react";

export default function Quantity() {
  return (
    <label>
      Quantity
      <input type="number" name="quantity" />
      <input type="hidden" name="_csrf" value="token" />
      <input type="checkbox" name="gift" />
      <input name="note" />
      {createElement("select", { name: "size" })}
    </label>
  );
}
