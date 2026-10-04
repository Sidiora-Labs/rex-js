import Feed from "./parts/Feed.tsx";
import Header from "./parts/Header.tsx";
import Rows from "./parts/Rows.tsx";

const entries = ["alpha", "beta", "gamma"];

export default function ItemsRegion() {
  return (
    <section>
      <Header />
      <Feed entries={entries} />
      <Rows entries={entries} />
    </section>
  );
}
