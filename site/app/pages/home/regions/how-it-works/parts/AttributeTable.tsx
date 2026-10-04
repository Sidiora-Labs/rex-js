import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../components/ui/table.tsx";

interface AttributeRow {
  readonly attribute: string;
  readonly value: string;
  readonly meaning: string;
}

const ATTRIBUTES: readonly AttributeRow[] = [
  {
    attribute: "data-rex-page",
    value: "<page>",
    meaning: "The main element of the active page.",
  },
  {
    attribute: "data-rex-region",
    value: "<page>/<region>",
    meaning: "The section landmark of each region.",
  },
  {
    attribute: "data-rex",
    value: "<page>/<action>",
    meaning: "Every action control, from the action declaration.",
  },
  {
    attribute: "data-rex-allowed",
    value: "true or false",
    meaning: "Whether the current actor may run the action, before anyone presses it.",
  },
  {
    attribute: "data-rex-overlay",
    value: "<page>/<Overlay>",
    meaning: "An open sheet or dialog, with its declared dismissal.",
  },
  {
    attribute: "data-rex-nav",
    value: "<page>",
    meaning: "The shell navigation links, the back button and the recovery button.",
  },
  {
    attribute: "data-rex-palette-item",
    value: "<page>/<action>",
    meaning: "Each entry of the command palette.",
  },
  {
    attribute: "script#rex-page",
    value: "application/rex+json",
    meaning: "The page sidecar: its actions, overlays, data state, outcome and screen.",
  },
];

export default function AttributeTable() {
  return (
    <Table data-site-attributes="">
      <TableCaption>The addresses Rex renders on every page.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Attribute</TableHead>
          <TableHead scope="col">Value</TableHead>
          <TableHead scope="col">Rendered on</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ATTRIBUTES.map((row) => (
          <TableRow key={row.attribute} data-site-attribute={row.attribute}>
            <TableCell className="align-top break-all whitespace-normal">
              <code>{row.attribute}</code>
            </TableCell>
            <TableCell className="align-top break-all whitespace-normal">
              <code>{row.value}</code>
            </TableCell>
            <TableCell className="align-top whitespace-normal">{row.meaning}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
