import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

// O Google manda a pessoa de volta pra cá com um "code"; trocamos pela sessão.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const erro = searchParams.get("error_description") ?? searchParams.get("error");

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
    return NextResponse.redirect(`${origin}/entrar?erro=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}/entrar?erro=${encodeURIComponent(erro ?? "Login cancelado")}`);
}
