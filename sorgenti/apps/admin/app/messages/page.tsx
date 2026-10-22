import Inbox from "./inbox";
export default function MessagesPage() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return <Inbox configured={configured} />;
}
