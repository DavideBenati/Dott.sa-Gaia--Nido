import Dashboard from "./studio";
export default function Page() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return <Dashboard configured={configured} />;
}
