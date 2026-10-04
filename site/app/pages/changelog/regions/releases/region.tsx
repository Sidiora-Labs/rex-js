import { region } from "@sidioralabs/rex/client";
import { REPOSITORY_URL } from "../../../../components/Shell.tsx";
import { useChangelog } from "../../hooks/useChangelog.ts";
import Blocks from "./parts/Blocks.tsx";
import Release from "./parts/Release.tsx";

export default region("releases", () => {
  const changelog = useChangelog();
  const data = changelog.data;
  if (data === undefined) return null;
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 text-muted-foreground">
        <Blocks blocks={data.intro} />
        <p className="m-0 text-sm">
          Rendered at build time from{" "}
          <a
            href={`${REPOSITORY_URL}/blob/main/${data.source}`}
            rel="noopener"
            className="underline underline-offset-4"
          >
            <code>{data.source}</code>
          </a>
          .
        </p>
      </div>
      {data.releases.map((release) => (
        <Release key={release.slug} release={release} />
      ))}
    </div>
  );
});
