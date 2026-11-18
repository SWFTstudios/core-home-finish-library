/** Base finish vs graphic combo PNG resolution. */

export function resolveBaseFinishUrl(finish) {
  if (!finish) return null;
  return finish.imageUrl ?? finish.image_url ?? null;
}

export function resolveGraphicComboUrl(finish, graphic) {
  if (!finish || !graphic) return null;
  const combos = finish.comboImageUrls ?? finish.combo_image_urls ?? {};
  return combos[graphic.id] ?? combos[graphic.templateKey] ?? null;
}

/** Center preview: combo only when graphic is explicitly passed; else base. */
export function resolveFinishPreviewUrl(finish, graphic) {
  const combo = resolveGraphicComboUrl(finish, graphic);
  if (combo) return combo;
  return resolveBaseFinishUrl(finish);
}
