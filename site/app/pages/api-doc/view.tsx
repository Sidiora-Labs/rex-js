import { Page, view } from "@sidioralabs/rex/client";
import ArticleRegion from "./regions/article/region.tsx";
import TocRegion from "./regions/toc/region.tsx";

export default view(() => (
  <Page.Stack space={6}>
    <TocRegion />
    <ArticleRegion />
  </Page.Stack>
));
