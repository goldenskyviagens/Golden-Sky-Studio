import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/extract", "/api/extract-promo", "/api/extract-produto", "/proposta"];

// Protege as rotas do shell autenticado, redirecionando para /login quando
// não há sessão. Enquanto as credenciais do Supabase não forem configuradas
// (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY), o middleware não bloqueia nada — isso
// permite rodar o app localmente antes da Etapa 1 estar 100% conectada.
export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Ignora assets estáticos (arquivos com extensão, ex: /branding/logo.png)
  // além dos internos do Next — sem isso, o middleware bloqueava a própria logo.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
