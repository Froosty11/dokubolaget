// Display strings + icons for board tags. Keyed by tag.id so we don't have to
// reshape the data files; gameplay/leaderboard/error rendering all flow through
// formatTagLabel/getTagIcon/getTagImageUrl. Missing entries fall back to the
// raw label with the family prefix stripped.
//
// Icon sources:
//   - Systembolaget's own packaging line-art for container types/materials
//     and beverage families that have a matching asset.
//   - flagcdn.com (CC0) for country flags.
//   - @expo/vector-icons (MaterialCommunityIcons) for everything else.

const SB = "https://www.systembolaget.se/images/packaging/";
const FLAG = (iso: string) => `https://flagcdn.com/w80/${iso}.png`;

type TagDisplay = {
  label: string;
  // Remote image (rendered with <Image>). Used for Systembolaget assets and flags.
  imageUrl?: string;
  // MaterialCommunityIcons glyph name (rendered with <MaterialCommunityIcons>).
  iconName?: string;
};

const TAG_DISPLAY: Record<string, TagDisplay> = {
  // Countries — flagcdn.com PNGs
  "Country:Sverige":          { label: "Sweden",          imageUrl: FLAG("se") },
  "Country:Frankrike":        { label: "France",          imageUrl: FLAG("fr") },
  "Country:Italien":          { label: "Italy",           imageUrl: FLAG("it") },
  "Country:Spanien":          { label: "Spain",           imageUrl: FLAG("es") },
  "Country:Tyskland":         { label: "Germany",         imageUrl: FLAG("de") },
  "Country:USA":              { label: "USA",             imageUrl: FLAG("us") },
  "Country:Storbritannien":   { label: "United Kingdom",  imageUrl: FLAG("gb") },
  "Country:Sydafrika":        { label: "South Africa",    imageUrl: FLAG("za") },
  "Country:Portugal":         { label: "Portugal",        imageUrl: FLAG("pt") },
  "Country:Argentina":        { label: "Argentina",       imageUrl: FLAG("ar") },
  "Country:Chile":            { label: "Chile",           imageUrl: FLAG("cl") },
  "Country:Australien":       { label: "Australia",       imageUrl: FLAG("au") },

  // Beverages — Systembolaget assets where they fit, MCI fallback otherwise
  "Beverage:Rött vin":                       { label: "Red wine",       imageUrl: SB + "packaging-wine-bottle.png" },
  "Beverage:Vitt vin":                       { label: "White wine",     imageUrl: SB + "packaging-wine-bottle.png" },
  "Beverage:Rosévin":                        { label: "Rosé wine",      imageUrl: SB + "packaging-wine-bottle.png" },
  "Beverage:Mousserande vin":                { label: "Sparkling wine", imageUrl: SB + "packaging-sparkling-bottle.png" },
  "Beverage:Ale":                            { label: "Ale",            imageUrl: SB + "packaging-beer-bottle.png" },
  "Beverage:Ljus lager":                     { label: "Lager",          imageUrl: SB + "packaging-beer-bottle.png" },
  "Beverage:Whisky":                         { label: "Whisky",         imageUrl: SB + "packaging-barrel.png" },
  "Beverage:Gin & Genever":                  { label: "Gin & Genever",  iconName: "glass-cocktail" },
  "Beverage:Likör":                          { label: "Liqueur",        iconName: "glass-tulip" },
  "Beverage:Rom & Lagrad sockerrörssprit":   { label: "Rum",            imageUrl: SB + "packaging-barrel.png" },

  // Container type
  "ContainerType:Bottle": { label: "Bottle", imageUrl: SB + "packaging-wine-bottle.png" },
  "ContainerType:Can":    { label: "Can",    imageUrl: SB + "packaging-beer-can.png" },
  "ContainerType:Box":    { label: "Box",    imageUrl: SB + "packaging-bag-in-box.png" },

  // Container material
  "ContainerMaterial:Glass":            { label: "Glass",           imageUrl: SB + "packaging-wine-bottle.png" },
  "ContainerMaterial:Aluminum/Metal":   { label: "Aluminum/Metal",  imageUrl: SB + "packaging-beer-can.png" },
  "ContainerMaterial:Paper/Cardboard":  { label: "Paper/Cardboard", imageUrl: SB + "packaging-bag-in-box.png" },
  "ContainerMaterial:Plastic":          { label: "Plastic",         imageUrl: SB + "packaging-plastic-bottle.png" },

  // Price — coin/currency
  "price:budget":  { label: "< 100 SEK",   iconName: "cash" },
  "price:mid":     { label: "100–200 SEK", iconName: "cash-multiple" },
  "price:premium": { label: "200–350 SEK", iconName: "cash-multiple" },
  "price:fancy":   { label: "350–700 SEK", iconName: "diamond-stone" },

  // Alcohol % — leaf → flame as strength rises
  "alcohol:light":      { label: "Alcohol < 5%",   iconName: "leaf" },
  "alcohol:medium":     { label: "Alcohol 5–10%",  iconName: "leaf" },
  "alcohol:strong":     { label: "Alcohol 10–13%", iconName: "thermometer" },
  "alcohol:veryStrong": { label: "Alcohol 13–22%", iconName: "fire" },
  "alcohol:liquor":     { label: "Alcohol ≥ 22%",  iconName: "fire" },

  // Volume
  "volume:small":    { label: "50–330 ml",   iconName: "cup-outline" },
  "volume:standard": { label: "330–500 ml",  iconName: "cup" },
  "volume:party":    { label: "500–750 ml",  iconName: "bottle-wine" },
  "volume:large":    { label: "750–1000 ml", iconName: "bottle-tonic" },

  // Taste clock
  "taste:sweetMid":   { label: "Sweetness mid",   iconName: "candy" },
  "taste:sweetHigh":  { label: "Sweetness high",  iconName: "candy-outline" },
  "taste:acidLow":    { label: "Acidity low",     iconName: "fruit-citrus" },
  "taste:acidMid":    { label: "Acidity mid",     iconName: "fruit-citrus" },
  "taste:acidHigh":   { label: "Acidity high",    iconName: "fruit-citrus" },
  "taste:bitterMid":  { label: "Bitterness mid",  iconName: "leaf-maple" },
  "taste:bitterHigh": { label: "Bitterness high", iconName: "leaf-maple" },
  "taste:bodyMid":    { label: "Body medium",     iconName: "weight" },
  "taste:bodyHigh":   { label: "Body full",       iconName: "weight" },
  "taste:roughMid":   { label: "Roughness mid",   iconName: "diamond-stone" },
  "taste:roughHigh":  { label: "Roughness high",  iconName: "diamond-stone" },
  "taste:smokeMid":   { label: "Smokiness mid",   iconName: "weather-windy" },
  "taste:smokeHigh":  { label: "Smokiness high",  iconName: "weather-windy" },
  "taste:oakMid":     { label: "Oak medium",      iconName: "pine-tree" },
  "taste:oakHigh":    { label: "Oak high",        iconName: "pine-tree" },
};

// Family-prefix fallback: when a tag isn't in the explicit map, drop the
// "Family:" prefix so we at least don't render raw IDs like "Country:Foo".
const PREFIX_STRIPS = ["Country:", "Beverage:", "ContainerType:", "ContainerMaterial:"];

function stripPrefix(value: string) {
  for (const prefix of PREFIX_STRIPS) {
    if (value.startsWith(prefix)) {
      return value.slice(prefix.length);
    }
  }
  return value;
}

type LooseTag = { id?: string; label?: string };

export function formatTagLabel(tag: LooseTag | null | undefined) {
  if (!tag) return "";
  const id = String(tag.id ?? "");
  const entry = TAG_DISPLAY[id];
  if (entry) return entry.label;
  return stripPrefix(String(tag.label ?? id));
}

export function getTagImageUrl(tag: LooseTag | null | undefined) {
  if (!tag) return null;
  const entry = TAG_DISPLAY[String(tag.id ?? "")];
  return entry?.imageUrl ?? null;
}

export function getTagIconName(tag: LooseTag | null | undefined) {
  if (!tag) return null;
  const entry = TAG_DISPLAY[String(tag.id ?? "")];
  return entry?.iconName ?? null;
}
