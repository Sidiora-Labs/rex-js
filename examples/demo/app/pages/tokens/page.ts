import { page } from "@sidioralabs/rex";

export default page("tokens", {
  route: "/tokens",
  render: "ssg",
  revalidate: 60,
  chrome: { title: "msg:tokens.title", back: "portfolio" },
  regions: ["prices"],
});
