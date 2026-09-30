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

  // Regions
  "Region:Champagne":              { label: "Champagne",        iconName: "map-marker" },
  "Region:Piemonte":               { label: "Piedmont",         iconName: "map-marker" },
  "Region:Skottland":              { label: "Scotland",         iconName: "map-marker" },
  "Region:Västra Götalands län":   { label: "Västra Götaland",  iconName: "map-marker" },
  "Region:Bourgogne":              { label: "Burgundy",         iconName: "map-marker" },
  "Region:Skåne län":              { label: "Skåne",            iconName: "map-marker" },
  "Region:Toscana":                { label: "Tuscany",          iconName: "map-marker" },
  "Region:Western Cape":           { label: "Western Cape",     iconName: "map-marker" },
  "Region:Stockholms län":         { label: "Stockholm",        iconName: "map-marker" },
  "Region:Venetien":               { label: "Veneto",           iconName: "map-marker" },
  "Region:Kalifornien":            { label: "California",       iconName: "map-marker" },
  "Region:Rhonedalen":             { label: "Rhône",            iconName: "map-marker" },
  "Region:Bordeaux":               { label: "Bordeaux",         iconName: "map-marker" },
  "Region:Languedoc-Roussillon":   { label: "Languedoc",        iconName: "map-marker" },
  "Region:Katalonien":             { label: "Catalonia",        iconName: "map-marker" },
  "Region:Rioja":                  { label: "Rioja",            iconName: "map-marker" },
  "Region:Loiredalen":             { label: "Loire",            iconName: "map-marker" },
  "Region:Sicilien":               { label: "Sicily",           iconName: "map-marker" },

  // Grapes
  "Grape:Chardonnay":         { label: "Chardonnay",         iconName: "fruit-grapes" },
  "Grape:Pinot noir":         { label: "Pinot Noir",         iconName: "fruit-grapes" },
  "Grape:Cabernet sauvignon": { label: "Cabernet Sauvignon", iconName: "fruit-grapes" },
  "Grape:Syrah":              { label: "Syrah",              iconName: "fruit-grapes" },
  "Grape:Merlot":             { label: "Merlot",             iconName: "fruit-grapes" },
  "Grape:Riesling":           { label: "Riesling",           iconName: "fruit-grapes" },
  "Grape:Sauvignon blanc":    { label: "Sauvignon Blanc",    iconName: "fruit-grapes" },
  "Grape:Grenache":           { label: "Grenache",           iconName: "fruit-grapes" },
  "Grape:Nebbiolo":           { label: "Nebbiolo",           iconName: "fruit-grapes" },
  "Grape:Sangiovese":         { label: "Sangiovese",         iconName: "fruit-grapes" },
  "Grape:Tempranillo":        { label: "Tempranillo",        iconName: "fruit-grapes" },

  // Styles (categoryLevel3)
  "Style:Torrt vitt":                          { label: "Dry white",          imageUrl: SB + "packaging-wine-bottle.png" },
  "Style:Maltwhisky":                          { label: "Malt whisky",        imageUrl: SB + "packaging-barrel.png" },
  "Style:Gin":                                 { label: "Gin",                iconName: "glass-cocktail" },
  "Style:India pale ale (IPA)":                { label: "IPA",                imageUrl: SB + "packaging-beer-can.png" },
  "Style:New England IPA/Hazy IPA":            { label: "Hazy IPA",           imageUrl: SB + "packaging-beer-can.png" },
  "Style:Imperial/Dubbel IPA":                 { label: "Double IPA",         imageUrl: SB + "packaging-beer-can.png" },
  "Style:Amerikansk pale ale (APA)":           { label: "American Pale Ale",  imageUrl: SB + "packaging-beer-can.png" },
  "Style:Imperial porter och stout":           { label: "Imperial stout",     imageUrl: SB + "packaging-beer-bottle.png" },
  "Style:Övrig syrlig öl":                     { label: "Sour beer",          imageUrl: SB + "packaging-beer-can.png" },
  "Style:Pilsner - tysk stil":                 { label: "German pilsner",     imageUrl: SB + "packaging-beer-bottle.png" },
  "Style:Internationell stil":                 { label: "International lager", imageUrl: SB + "packaging-beer-can.png" },
  "Style:Mörk rom & Lagrad sockerrörssprit":   { label: "Dark rum",           imageUrl: SB + "packaging-barrel.png" },
  "Style:Blended whisky":                      { label: "Blended whisky",     imageUrl: SB + "packaging-barrel.png" },
  "Style:Kryddat brännvin":                    { label: "Spiced aquavit",     iconName: "glass-tulip" },
  "Style:Annan likör":                         { label: "Liqueur",            iconName: "glass-tulip" },
  "Style:Fruktlikör":                          { label: "Fruit liqueur",      iconName: "glass-tulip" },
  "Style:Fruktigt & Smakrikt":                 { label: "Fruity & flavourful (red)", imageUrl: SB + "packaging-wine-bottle.png" },
  "Style:Friskt & Fruktigt":                   { label: "Fresh & fruity (white)",    imageUrl: SB + "packaging-wine-bottle.png" },
  "Style:Kryddigt & Mustigt":                  { label: "Spicy & robust (red)",      imageUrl: SB + "packaging-wine-bottle.png" },
  "Style:Fylligt & Smakrikt":                  { label: "Full-bodied (white)",       imageUrl: SB + "packaging-wine-bottle.png" },
  "Style:Mjukt & Bärigt":                      { label: "Soft & berry (red)",        imageUrl: SB + "packaging-wine-bottle.png" },
  "Style:Rosé":                                { label: "Rosé",               imageUrl: SB + "packaging-wine-bottle.png" },
  "Style:Söt":                                 { label: "Sweet",              iconName: "candy" },
  "Style:Sött":                                { label: "Sweet",              iconName: "candy" },
  "Style:Torr/halvtorr":                       { label: "Dry / off-dry",      imageUrl: SB + "packaging-wine-bottle.png" },

  // Flags
  "flag:organic":         { label: "Organic",              iconName: "leaf" },
  "flag:regularShelf":    { label: "On the regular shelf", iconName: "store" },
  "flag:localSmallScale": { label: "Local & small-scale",  iconName: "home-heart" },

  // Seal
  "seal:screwCap":    { label: "Screw cap",    iconName: "bottle-tonic" },
  "seal:naturalCork": { label: "Natural cork", iconName: "bottle-wine-outline" },

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
const PREFIX_STRIPS = [
  "Country:",
  "Beverage:",
  "ContainerType:",
  "ContainerMaterial:",
  "Region:",
  "Grape:",
  "Style:",
];

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
