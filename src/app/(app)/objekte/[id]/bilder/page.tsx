import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, canEdit } from "@/lib/workspace";
import { formatPropertyAddress } from "@/lib/properties";
import { ImageUploader } from "./image-uploader";
import { EditableImageCard } from "./editable-image-card";

type ImageCategory =
  | "exterior"
  | "living_room"
  | "bathroom"
  | "kitchen"
  | "bedroom"
  | "other";

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
            {images.map((img) => (
              <EditableImageCard
                key={img.id}
                imageId={img.id}
                propertyId={id}
                url={signedMap[img.storage_path]}
                initialCategory={img.category as ImageCategory}
                initialCaption={img.caption ?? ""}
                editable={editable}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
