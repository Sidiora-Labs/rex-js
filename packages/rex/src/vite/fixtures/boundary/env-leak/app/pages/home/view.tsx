const databaseUrl = process.env.DATABASE_URL;

export default function View() {
  return <p>{databaseUrl ?? "none"}</p>;
}
