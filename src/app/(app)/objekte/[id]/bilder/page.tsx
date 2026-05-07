import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { ImageUploader } from "./image-uploader";
import { DeleteImageButton } from "./delete-image-button";

const SIGNED_URL_TTL = 60 * 60;

export default async function PropertyImagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const active = await getActiveWorkspace();
  if (!active) return null;

  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id, workspace_id, street, postal_code, city, location_detail, description")
    .eq("id", id)
    .maybeSingle();

  if (!property) notFound();

  const { data: images } = await supabase
    .from("property_images")
    .select("id, storage_path, category, caption, display_order, created_at")
    .eq("property_id", id)
    .order("display_order")
    .order("created_at");

  const paths = (images ?? []).map((i) => i.storage_path);
  let signedMap: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("property-images")
      .createSignedUrls(paths, SIGNED_URL_TTL);
    signedMap = Object.fromEntries(
      (signed ?? [])
        .filter((s) => s.signedUrl && s.path)
        .map((s) => [s.path as string, s.signedUrl as string])
    );
  }

  const editable = canEdit(active.role);

  return (
    <div>
      <Link
        href={`/objekte/${id}`}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
      >
        ← {formatPropertyAddress(property)}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("images.title")}
      </h1>

      {editable && (
        <div className="mt-6">
          <ImageUploader
            workspaceId={property.workspace_id}
            propertyId={id}
          />
        </div>
      )}

      <div className="mt-8">
        {!images || images.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("images.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img) => {
              const url = signedMap[img.storage_path];
              return (
                <div
                  key={img.id}
                  className="relative aspect-square rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 group"
                >
                  {url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={url}
                      alt={img.caption ?? ""}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500">
                      —
                    </div>
                  )}
                  {editable && (
                    <DeleteImageButton imageId={img.id} propertyId={id} />
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-xs text-white/80">
                      {t(`images.category_${img.category as
                        | "exterior"
                        | "living_room"
                        | "bathroom"
                        | "kitchen"
                        | "bedroom"
                        | "other"}`)}
                    </p>
                    {img.caption && (
                      <p className="text-xs text-white truncate">
                        {img.caption}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
