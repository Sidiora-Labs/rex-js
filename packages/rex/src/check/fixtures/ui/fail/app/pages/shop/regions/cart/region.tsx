import Quantity from "./parts/Quantity.tsx";

export default function CartRegion() {
  return (
    <section aria-label="Cart">
      <table>
        <tbody>
          <tr>
            <td>
              <Quantity />
            </td>
          </tr>
        </tbody>
      </table>
      <button type="submit">Pay</button>
    </section>
  );
}
