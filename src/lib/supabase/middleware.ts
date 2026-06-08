import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() validates the session by hitting Supabase Auth.
  // Do not put logic between createServerClient and getUser, otherwise users may be logged out at random.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/passwort-vergessen") ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/auth") ||
    // Stripe-Webhooks rufen ohne Auth-Session auf — Signatur-Validation
    // passiert in der Route selbst über den whsec-Header.
    pathname.startsWith("/api/billing/webhook") ||
    pathname.startsWith("/api/connect/webhooks/") ||
    // Connected-Account-Storefront ist öffentlich für Endkunden.
    pathname.startsWith("/connect/storefront/") ||
    // Endkunden-Checkout auf der Storefront (anonyme Käufer).
    pathname.startsWith("/api/connect/checkout/") ||
    // Rechtliche Pflichtangaben — TMG/DDG + DSGVO verlangen freien
    // Zugang ohne Login.
    pathname === "/impressum" ||
    pathname === "/datenschutz" ||
    pathname === "/agb" ||
    pathname === "/avv" ||
    // Marketing-Landing + Pricing — öffentlich, das ist der eigentliche
    // Außenauftritt für Erstbesucher.
    pathname === "/" ||
    pathname === "/preise";

  // Eingeloggte User auf der Marketing-Landing → direkt ins Dashboard.
  // Wer schon ein Konto hat, will keine Hero-Section sehen.
  if (user && (pathname === "/" || pathname === "/preise")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
