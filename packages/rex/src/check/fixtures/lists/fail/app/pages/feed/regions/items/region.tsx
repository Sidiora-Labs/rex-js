import Activity from "./parts/Activity.tsx";
import Feed from "./parts/Feed.tsx";
import Timeline from "./parts/Timeline.tsx";

const entries = ["alpha", "beta", "gamma"];

export default function ItemsRegion() {
  return (
    <section>
      <Feed entries={entries} />
      <Timeline entries={entries} />
      <Activity entries={entries} />
    </section>
  );
}
